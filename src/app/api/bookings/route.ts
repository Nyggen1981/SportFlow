import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { addWeeks, addMonths, format } from "date-fns"
import { nb } from "date-fns/locale"
import { sendEmail, getNewBookingRequestEmail } from "@/lib/email"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      resourceId,
      resourcePartId,
      title,
      description,
      startTime,
      endTime,
      contactName,
      contactEmail,
      contactPhone,
      isRecurring,
      recurringType,
      recurringEndDate
    } = body

    // Validate required fields
    if (!resourceId || !title || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Mangler påkrevde felt" },
        { status: 400 }
      )
    }

    // Get resource to check settings
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId }
    })

    if (!resource) {
      return NextResponse.json(
        { error: "Ressurs ikke funnet" },
        { status: 404 }
      )
    }

    // Validate booking duration
    const start = new Date(startTime)
    const end = new Date(endTime)
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60)

    // Only validate duration if limits are set (0/9999 or null = unlimited)
    const hasMinLimit = resource.minBookingMinutes !== null && resource.minBookingMinutes !== 0
    const hasMaxLimit = resource.maxBookingMinutes !== null && resource.maxBookingMinutes !== 9999

    if (hasMinLimit && durationMinutes < resource.minBookingMinutes!) {
      return NextResponse.json(
        { error: `Minimum varighet er ${resource.minBookingMinutes} minutter` },
        { status: 400 }
      )
    }

    if (hasMaxLimit && durationMinutes > resource.maxBookingMinutes!) {
      return NextResponse.json(
        { error: `Maksimum varighet er ${resource.maxBookingMinutes} minutter` },
        { status: 400 }
      )
    }

    // Generate all booking dates
    const bookingDates: { start: Date; end: Date }[] = [{ start, end }]
    
    if (isRecurring && recurringEndDate) {
      const endDateLimit = new Date(recurringEndDate)
      endDateLimit.setHours(23, 59, 59, 999)
      
      let currentStart = start
      let currentEnd = end
      
      while (true) {
        // Calculate next occurrence
        if (recurringType === "weekly") {
          currentStart = addWeeks(currentStart, 1)
          currentEnd = addWeeks(currentEnd, 1)
        } else if (recurringType === "biweekly") {
          currentStart = addWeeks(currentStart, 2)
          currentEnd = addWeeks(currentEnd, 2)
        } else if (recurringType === "monthly") {
          currentStart = addMonths(currentStart, 1)
          currentEnd = addMonths(currentEnd, 1)
        }
        
        if (currentStart > endDateLimit) break
        
        bookingDates.push({ start: new Date(currentStart), end: new Date(currentEnd) })
        
        // Safety limit to prevent infinite loops
        if (bookingDates.length > 52) break
      }
    }

    // Check for conflicts on all dates
    // Conflict logic:
    // 1. If booking whole facility (resourcePartId = null): conflicts with any part booking
    // 2. If booking a part: conflicts with whole facility booking OR same part booking
    
    const getTimeOverlapConditions = (bookingStart: Date, bookingEnd: Date) => [
      {
        AND: [
          { startTime: { lte: bookingStart } },
          { endTime: { gt: bookingStart } }
        ]
      },
      {
        AND: [
          { startTime: { lt: bookingEnd } },
          { endTime: { gte: bookingEnd } }
        ]
      },
      {
        AND: [
          { startTime: { gte: bookingStart } },
          { endTime: { lte: bookingEnd } }
        ]
      }
    ]

    for (const { start: bookingStart, end: bookingEnd } of bookingDates) {
      let conflictingBookings
      
      if (!resourcePartId) {
        // Booking whole facility
        if (resource.blockPartsWhenWholeBooked) {
          // Check if ANY booking exists (whole or parts)
          conflictingBookings = await prisma.booking.findMany({
            where: {
              resourceId,
              status: { in: ["approved", "pending"] },
              OR: getTimeOverlapConditions(bookingStart, bookingEnd)
            },
            include: { resourcePart: true }
          })
        } else {
          // Only check for whole facility bookings
          conflictingBookings = await prisma.booking.findMany({
            where: {
              resourceId,
              resourcePartId: null,
              status: { in: ["approved", "pending"] },
              OR: getTimeOverlapConditions(bookingStart, bookingEnd)
            },
            include: { resourcePart: true }
          })
        }
      } else {
        // Booking a specific part
        const partConditions: { resourcePartId: string | null }[] = [
          { resourcePartId: resourcePartId } // Same part is always checked
        ]
        
        if (resource.blockWholeWhenPartBooked) {
          partConditions.push({ resourcePartId: null }) // Also check whole facility bookings
        }

        conflictingBookings = await prisma.booking.findMany({
          where: {
            AND: [
              { resourceId },
              { status: { in: ["approved", "pending"] } },
              { OR: partConditions },
              { OR: getTimeOverlapConditions(bookingStart, bookingEnd) }
            ]
          },
          include: { resourcePart: true }
        })
      }

      if (conflictingBookings.length > 0) {
        const conflictDate = bookingStart.toLocaleDateString("nb-NO")
        const conflict = conflictingBookings[0]
        const conflictInfo = conflict.resourcePart 
          ? `"${conflict.resourcePart.name}"` 
          : "hele fasiliteten"
        return NextResponse.json(
          { error: `Konflikt ${conflictDate}: ${conflictInfo} er allerede booket i dette tidsrommet` },
          { status: 409 }
        )
      }
    }

    // Create all bookings
    const createdBookings = await prisma.$transaction(
      bookingDates.map(({ start: bookingStart, end: bookingEnd }) =>
        prisma.booking.create({
          data: {
            title,
            description,
            startTime: bookingStart,
            endTime: bookingEnd,
            status: resource.requiresApproval ? "pending" : "approved",
            approvedAt: resource.requiresApproval ? null : new Date(),
            contactName,
            contactEmail,
            contactPhone,
            organizationId: session.user.organizationId,
            resourceId,
            resourcePartId: resourcePartId || null,
            userId: session.user.id
          }
        })
      )
    )

    // Send email notification to admins if booking requires approval
    if (resource.requiresApproval && createdBookings.length > 0) {
      const firstBooking = createdBookings[0]
      const admins = await prisma.user.findMany({
        where: {
          organizationId: session.user.organizationId,
          role: "admin"
        }
      })

      const date = format(new Date(firstBooking.startTime), "EEEE d. MMMM yyyy", { locale: nb })
      const time = `${format(new Date(firstBooking.startTime), "HH:mm")} - ${format(new Date(firstBooking.endTime), "HH:mm")}`
      const resourceName = resourcePartId 
        ? `${resource.name} → ${resource.parts?.find(p => p.id === resourcePartId)?.name || ''}`
        : resource.name

      // Send email to each admin
      for (const admin of admins) {
        const emailContent = getNewBookingRequestEmail(
          title,
          resourceName,
          date,
          time,
          session.user.name || contactName || "Ukjent",
          session.user.email || contactEmail || "",
          description
        )
        await sendEmail({ to: admin.email, ...emailContent })
      }
    }

    return NextResponse.json(
      { 
        bookings: createdBookings, 
        count: createdBookings.length,
        message: createdBookings.length > 1 
          ? `${createdBookings.length} bookinger opprettet` 
          : "Booking opprettet"
      }, 
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating booking:", error)
    return NextResponse.json(
      { error: "Kunne ikke opprette booking" },
      { status: 500 }
    )
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const bookings = await prisma.booking.findMany({
    where: {
      userId: session.user.id
    },
    include: {
      resource: true,
      resourcePart: true
    },
    orderBy: { startTime: "desc" }
  })

  return NextResponse.json(bookings)
}

