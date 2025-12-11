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
    
    // Helper function to check if two time ranges overlap
    const timeRangesOverlap = (start1: Date, end1: Date, start2: Date, end2: Date): boolean => {
      return start1 < end2 && start2 < end1
    }

    // Get all booking dates time range for efficient query
    const allBookingStarts = bookingDates.map(bd => bd.start)
    const allBookingEnds = bookingDates.map(bd => bd.end)
    const earliestStart = new Date(Math.min(...allBookingStarts.map(d => d.getTime())))
    const latestEnd = new Date(Math.max(...allBookingEnds.map(d => d.getTime())))

    // Get part hierarchy if booking a specific part (only once, not in loop)
    let partIdsToCheck: string[] | null = null
    if (resourcePartId) {
      const bookingPart = await prisma.resourcePart.findUnique({
        where: { id: resourcePartId },
        include: {
          parent: true,
          children: true
        }
      })
      
      if (!bookingPart) {
        return NextResponse.json(
          { error: "Del ikke funnet" },
          { status: 404 }
        )
      }
      
      // Build list of part IDs to check:
      // 1. The part itself
      // 2. All children (if booking parent, children are blocked)
      // 3. The parent (if booking child, parent is blocked)
      partIdsToCheck = [resourcePartId]
      
      if (bookingPart.children && bookingPart.children.length > 0) {
        const childIds = bookingPart.children.map(c => c.id)
        partIdsToCheck.push(...childIds)
      }
      
      if (bookingPart.parentId) {
        partIdsToCheck.push(bookingPart.parentId)
      }
    }

    // Fetch ALL potentially conflicting bookings in ONE query (much faster)
    // This covers the entire time range of all booking dates
    const whereClause: any = {
      resourceId,
      status: { notIn: ["cancelled", "rejected"] },
      // Time range that overlaps with any of our booking dates
      OR: [
        { startTime: { lt: latestEnd } },
        { endTime: { gt: earliestStart } }
      ]
    }

    // Add part filtering based on booking type
    if (!resourcePartId) {
      // Booking whole facility - check if ANY part is booked (or whole facility)
      // No additional filter needed - we want to check all bookings
    } else {
      // Booking a specific part - check conflicts with:
      // 1. Same parts (including parent/children)
      // 2. Whole facility bookings
      whereClause.OR = [
        {
          resourcePartId: { in: partIdsToCheck },
          AND: [
            { startTime: { lt: latestEnd } },
            { endTime: { gt: earliestStart } }
          ]
        },
        {
          resourcePartId: null,
          AND: [
            { startTime: { lt: latestEnd } },
            { endTime: { gt: earliestStart } }
          ]
        }
      ]
    }

    const allPotentialConflicts = await prisma.booking.findMany({
      where: whereClause,
      select: { 
        id: true, 
        status: true, 
        startTime: true,
        endTime: true,
        resourcePartId: true,
        resourcePart: { select: { name: true } } 
      }
    })

    // Now check each booking date against the fetched conflicts (in-memory check)
    for (const { start: bookingStart, end: bookingEnd } of bookingDates) {
      const conflicts = allPotentialConflicts.filter(existing => {
        // Check time overlap
        if (!timeRangesOverlap(bookingStart, bookingEnd, existing.startTime, existing.endTime)) {
          return false
        }

        // Check part conflict
        if (!resourcePartId) {
          // Booking whole facility - conflicts with ANY booking (part or whole)
          return true
        } else {
          // Booking a specific part - conflicts with:
          // 1. Same part or parent/children
          // 2. Whole facility bookings
          return existing.resourcePartId === null || 
                 (partIdsToCheck && partIdsToCheck.includes(existing.resourcePartId))
        }
      })

      if (conflicts.length > 0) {
        const conflictDate = bookingStart.toLocaleDateString("nb-NO")
        const conflict = conflicts[0]
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
    // First, create the parent booking
    const isRecurringBooking = isRecurring && bookingDates.length > 1
    
    const parentBooking = await prisma.booking.create({
      data: {
        title,
        description,
        startTime: bookingDates[0].start,
        endTime: bookingDates[0].end,
        status: resource.requiresApproval ? "pending" : "approved",
        approvedAt: resource.requiresApproval ? null : new Date(),
        contactName,
        contactEmail,
        contactPhone,
        organizationId: session.user.organizationId,
        resourceId,
        resourcePartId: resourcePartId || null,
        userId: session.user.id,
        isRecurring: isRecurringBooking,
        recurringPattern: isRecurringBooking ? recurringType : null,
        recurringEndDate: isRecurringBooking ? new Date(recurringEndDate) : null
      }
    })

    // Then create child bookings if recurring
    const childBookings = isRecurringBooking && bookingDates.length > 1
      ? await prisma.$transaction(
          bookingDates.slice(1).map(({ start: bookingStart, end: bookingEnd }) =>
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
                userId: session.user.id,
                isRecurring: true,
                recurringPattern: recurringType,
                recurringEndDate: new Date(recurringEndDate),
                parentBookingId: parentBooking.id
              }
            })
          )
        )
      : []

    const createdBookings = [parentBooking, ...childBookings]

    // Send email notification to admins if booking requires approval (non-blocking)
    if (resource.requiresApproval && createdBookings.length > 0) {
      const firstBooking = createdBookings[0]
      const orgId = session.user.organizationId
      const userName = session.user.name || contactName || "Ukjent"
      const userEmail = session.user.email || contactEmail || ""
      
      // Fire and forget - don't block the response
      const sendEmailsAsync = async () => {
        try {
          const admins = await prisma.user.findMany({
            where: { organizationId: orgId, role: "admin" },
            select: { email: true }
          })

          const date = format(new Date(firstBooking.startTime), "EEEE d. MMMM yyyy", { locale: nb })
          const time = `${format(new Date(firstBooking.startTime), "HH:mm")} - ${format(new Date(firstBooking.endTime), "HH:mm")}`
          
          let resourceName = resource.name
          if (resourcePartId) {
            const part = await prisma.resourcePart.findUnique({ 
              where: { id: resourcePartId },
              select: { name: true }
            })
            if (part) resourceName = `${resource.name} → ${part.name}`
          }

          // Send emails in parallel
          await Promise.all(admins.map(async (admin) => {
            const emailContent = await getNewBookingRequestEmail(
              orgId, title, resourceName, date, time, userName, userEmail, description
            )
            await sendEmail(orgId, { to: admin.email, ...emailContent })
          }))
        } catch (error) {
          console.error("Failed to send booking notification emails:", error)
        }
      }
      
      void sendEmailsAsync()
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
    select: {
      id: true,
      title: true,
      description: true,
      startTime: true,
      endTime: true,
      status: true,
      statusNote: true,
      resource: {
        select: {
          id: true,
          name: true,
          location: true,
          color: true
        }
      },
      resourcePart: {
        select: { name: true }
      }
    },
    orderBy: { startTime: "desc" }
  })

  return NextResponse.json(bookings)
}

