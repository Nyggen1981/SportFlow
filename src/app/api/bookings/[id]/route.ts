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

    // Check for conflicts if time changed
    if (startTime || endTime || resourcePartId !== undefined) {
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

      const newResourcePartId = resourcePartId !== undefined ? resourcePartId : booking.resourcePartId

      const conflictingBookings = await prisma.booking.findMany({
        where: {
          id: { not: id }, // Exclude current booking
          resourceId: booking.resourceId,
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
        resourcePartId: resourcePartId !== undefined ? resourcePartId : booking.resourcePartId,
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

    // If user edited and needs re-approval, notify admins
    if (!isAdmin && newStatus === "pending") {
      const admins = await prisma.user.findMany({
        where: {
          organizationId: booking.resource.organizationId,
          role: "admin"
        }
      })

      const date = format(newStartTime, "EEEE d. MMMM yyyy", { locale: nb })
      const time = `${format(newStartTime, "HH:mm")} - ${format(newEndTime, "HH:mm")}`
      const resourceName = updatedBooking.resourcePart 
        ? `${updatedBooking.resource.name} → ${updatedBooking.resourcePart.name}`
        : updatedBooking.resource.name

      for (const admin of admins) {
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
        await sendEmail({ to: admin.email, ...emailContent })
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

