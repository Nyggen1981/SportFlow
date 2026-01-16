import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { format } from "date-fns"
import { nb } from "date-fns/locale"
import { sendEmail, getNewBookingRequestEmail } from "@/lib/email"

// GET single booking
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      resource: true,
      resourcePart: true,
      user: {
        select: { id: true, name: true, email: true }
      }
    }
  })

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  // Check if user owns the booking or is admin
  const isAdmin = session.user.role === "admin"
  const isOwner = booking.userId === session.user.id

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 })
  }

  return NextResponse.json(booking)
}

// PATCH - Edit booking
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const {
      title,
      description,
      startTime,
      endTime,
      resourceId,
      resourcePartId,
      contactName,
      contactEmail,
      contactPhone
    } = body

    // Get the existing booking
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        resource: true,
        resourcePart: true,
        user: true
      }
    })

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const isAdmin = session.user.role === "admin"
    const isOwner = booking.userId === session.user.id

    // Check permissions
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 })
    }

    // Check if booking belongs to same organization (for admin)
    if (isAdmin && booking.resource.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 })
    }

    // Validate times if changed
    const newStartTime = startTime ? new Date(startTime) : booking.startTime
    const newEndTime = endTime ? new Date(endTime) : booking.endTime

    if (newStartTime >= newEndTime) {
      return NextResponse.json(
        { error: "Sluttid må være etter starttid" },
        { status: 400 }
      )
    }

    // Check for conflicts if time or resource changed
    const newResourceId = resourceId || booking.resourceId
    const newResourcePartId = resourcePartId !== undefined ? resourcePartId : booking.resourcePartId

    // If resource is changed, verify the new resource exists and belongs to the same organization
    if (resourceId && resourceId !== booking.resourceId) {
      const newResource = await prisma.resource.findUnique({
        where: { id: resourceId },
        select: { organizationId: true }
      })

      if (!newResource) {
        return NextResponse.json(
          { error: "Ugyldig fasilitet" },
          { status: 400 }
        )
      }

      if (newResource.organizationId !== session.user.organizationId) {
        return NextResponse.json(
          { error: "Ikke tilgang til denne fasiliteten" },
          { status: 403 }
        )
      }
    }

    if (startTime || endTime || resourcePartId !== undefined || resourceId) {
      const activeStatusFilter = { status: { notIn: ["cancelled", "rejected"] } }
      
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

      const conflictingBookings = await prisma.booking.findMany({
        where: {
          id: { not: id }, // Exclude current booking
          resourceId: newResourceId,
          ...activeStatusFilter,
          OR: [
            { resourcePartId: newResourcePartId },
            { resourcePartId: null }
          ],
          AND: {
            OR: getTimeOverlapConditions(newStartTime, newEndTime)
          }
        }
      })

      if (conflictingBookings.length > 0) {
        return NextResponse.json(
          { error: "Det finnes en konflikt med en annen booking på dette tidspunktet" },
          { status: 409 }
        )
      }

      // Sjekk også for konkurranser som blokkerer denne fasiliteten (kun hvis kampoppsett-modulen er aktivert)
      const { isMatchSetupEnabled } = await import("@/lib/match-setup")
      const matchSetupEnabled = await isMatchSetupEnabled()
      
      if (matchSetupEnabled) {
        const conflictingCompetitions = await prisma.competition.findMany({
          where: {
            resourceId: newResourceId,
            status: { in: ["DRAFT", "SCHEDULED", "ACTIVE"] },
            dailyStartTime: { not: null },
            dailyEndTime: { not: null },
            startDate: { lte: newEndTime },
            OR: [
              { endDate: { gte: newStartTime } },
              { endDate: null }
            ]
          },
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            dailyStartTime: true,
            dailyEndTime: true,
            matchDuration: true,
            matches: {
              select: { scheduledTime: true }
            }
          }
        })

        // Sjekk om noen av konkurransene faktisk overlapper med booking-tiden
        for (const comp of conflictingCompetitions) {
          // Sjekk individuelle kamper
          for (const match of comp.matches) {
            if (match.scheduledTime) {
              const matchStart = new Date(match.scheduledTime)
              const matchEnd = new Date(matchStart.getTime() + (comp.matchDuration * 60 * 1000))
              
              if (matchStart < newEndTime && matchEnd > newStartTime) {
                return NextResponse.json(
                  { error: `Konflikt: Fasiliteten er reservert for konkurransen "${comp.name}"` },
                  { status: 409 }
                )
              }
            }
          }

          // Sjekk daglige blokkeringer
          if (comp.dailyStartTime && comp.dailyEndTime) {
            const compStart = new Date(comp.startDate)
            const compEnd = comp.endDate ? new Date(comp.endDate) : compStart
            
            const bookingDate = new Date(newStartTime)
            bookingDate.setHours(0, 0, 0, 0)
            
            if (bookingDate >= compStart && bookingDate <= compEnd) {
              const [startHour, startMin] = comp.dailyStartTime.split(":").map(Number)
              const [endHour, endMin] = comp.dailyEndTime.split(":").map(Number)
              
              const blockStart = new Date(bookingDate)
              blockStart.setHours(startHour, startMin, 0, 0)
              
              const blockEnd = new Date(bookingDate)
              blockEnd.setHours(endHour, endMin, 0, 0)
              
              if (blockStart < newEndTime && blockEnd > newStartTime) {
                return NextResponse.json(
                  { error: `Konflikt: Fasiliteten er reservert for konkurransen "${comp.name}" (${comp.dailyStartTime}-${comp.dailyEndTime})` },
                  { status: 409 }
                )
              }
            }
          }
        }
      }
    }

    // Determine new status
    // If user edits, it goes back to pending for admin approval
    // If admin edits, it stays approved (or pending if it was pending)
    let newStatus = booking.status
    if (!isAdmin && booking.status === "approved") {
      // User is editing an approved booking - needs re-approval
      newStatus = "pending"
    }

    // Update the booking
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        title: title || booking.title,
        description: description !== undefined ? description : booking.description,
        startTime: newStartTime,
        endTime: newEndTime,
        resourceId: newResourceId,
        resourcePartId: newResourcePartId,
        contactName: contactName !== undefined ? contactName : booking.contactName,
        contactEmail: contactEmail !== undefined ? contactEmail : booking.contactEmail,
        contactPhone: contactPhone !== undefined ? contactPhone : booking.contactPhone,
        status: newStatus,
        approvedAt: newStatus === "pending" ? null : booking.approvedAt,
        approvedById: newStatus === "pending" ? null : booking.approvedById
      },
      include: {
        resource: true,
        resourcePart: true
      }
    })

    // If user edited and needs re-approval, notify admins and moderators
    if (!isAdmin && newStatus === "pending") {
      // Hent alle admin-brukere
      const admins = await prisma.user.findMany({
        where: {
          organizationId: booking.resource.organizationId,
          role: "admin"
        },
        select: { email: true }
      })

      // Hent alle moderatorer som har tilgang til denne ressursen
      const resourceModerators = await prisma.resourceModerator.findMany({
        where: { resourceId: booking.resourceId },
        include: {
          user: {
            select: { email: true, role: true }
          }
        }
      })

      // Kombiner admin og moderator e-poster (unngå duplikater)
      const adminEmails = admins.map(a => a.email)
      const moderatorEmails = resourceModerators
        .filter(rm => rm.user.role === "moderator")
        .map(rm => rm.user.email)
      
      const allRecipients = [...new Set([...adminEmails, ...moderatorEmails])]

      const date = format(newStartTime, "EEEE d. MMMM yyyy", { locale: nb })
      const time = `${format(newStartTime, "HH:mm")} - ${format(newEndTime, "HH:mm")}`
      const resourceName = updatedBooking.resourcePart 
        ? `${updatedBooking.resource.name} → ${updatedBooking.resourcePart.name}`
        : updatedBooking.resource.name

      for (const email of allRecipients) {
        const emailContent = await getNewBookingRequestEmail(
          session.user.organizationId,
          `${updatedBooking.title} (Endret)`,
          resourceName,
          date,
          time,
          session.user.name || contactName || "Ukjent",
          session.user.email || contactEmail || "",
          description || undefined
        )
        await sendEmail(session.user.organizationId, { to: email, ...emailContent })
      }
    }

    return NextResponse.json({
      ...updatedBooking,
      needsReapproval: !isAdmin && newStatus === "pending"
    })
  } catch (error) {
    console.error("Error updating booking:", error)
    return NextResponse.json(
      { error: "Kunne ikke oppdatere booking" },
      { status: 500 }
    )
  }
}

// DELETE - Permanently delete a booking (only past/cancelled/rejected bookings)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        resource: true
      }
    })

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const isAdmin = session.user.role === "admin"
    const isOwner = booking.userId === session.user.id
    const isPast = new Date(booking.startTime) < new Date()
    const isInactive = booking.status === "cancelled" || booking.status === "rejected"

    // Only owner can delete their own bookings
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 })
    }

    // Can only delete past bookings or cancelled/rejected bookings
    if (!isPast && !isInactive) {
      return NextResponse.json(
        { error: "Kan kun slette tidligere bookinger eller kansellerte/avslåtte bookinger" },
        { status: 400 }
      )
    }

    await prisma.booking.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting booking:", error)
    return NextResponse.json(
      { error: "Kunne ikke slette booking" },
      { status: 500 }
    )
  }
}
