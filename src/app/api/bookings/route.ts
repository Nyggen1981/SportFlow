import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { addWeeks, addMonths } from "date-fns"

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

    if (durationMinutes < resource.minBookingMinutes) {
      return NextResponse.json(
        { error: `Minimum varighet er ${resource.minBookingMinutes} minutter` },
        { status: 400 }
      )
    }

    if (durationMinutes > resource.maxBookingMinutes) {
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
    for (const { start: bookingStart, end: bookingEnd } of bookingDates) {
      const conflictingBookings = await prisma.booking.findMany({
        where: {
          resourceId,
          resourcePartId: resourcePartId || null,
          status: { in: ["approved", "pending"] },
          OR: [
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
        }
      })

      if (conflictingBookings.length > 0) {
        const conflictDate = bookingStart.toLocaleDateString("nb-NO")
        return NextResponse.json(
          { error: `Det finnes allerede en booking ${conflictDate} i dette tidsrommet` },
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

