import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { sendEmail, getBookingApprovedEmail, getBookingRejectedEmail } from "@/lib/email"
import { format } from "date-fns"
import { nb } from "date-fns/locale"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { action, statusNote, applyToAll } = await request.json()

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      user: true,
      resource: true,
      resourcePart: true
    }
  })

  if (!booking || booking.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  // Determine which bookings to update
  let bookingIdsToUpdate: string[] = [id]

  if (applyToAll && booking.isRecurring) {
    // Find all related recurring bookings (same parent or this is the parent)
    const parentId = booking.parentBookingId || booking.id
    
    const relatedBookings = await prisma.booking.findMany({
      where: {
        organizationId: session.user.organizationId,
        status: "pending",
        OR: [
          { id: parentId },
          { parentBookingId: parentId }
        ]
      },
      select: { id: true }
    })
    
    bookingIdsToUpdate = relatedBookings.map(b => b.id)
  }

  // Update all selected bookings
  await prisma.booking.updateMany({
    where: { id: { in: bookingIdsToUpdate } },
    data: {
      status: action === "approve" ? "approved" : "rejected",
      statusNote: statusNote || null,
      approvedAt: action === "approve" ? new Date() : null,
      approvedById: action === "approve" ? session.user.id : null
    }
  })

  // Get the updated booking to return
  const updatedBooking = await prisma.booking.findUnique({
    where: { id }
  })

  // Send email notification
  const userEmail = booking.contactEmail || booking.user.email
  if (userEmail) {
    const date = format(new Date(booking.startTime), "EEEE d. MMMM yyyy", { locale: nb })
    const time = `${format(new Date(booking.startTime), "HH:mm")} - ${format(new Date(booking.endTime), "HH:mm")}`
    const resourceName = booking.resourcePart 
      ? `${booking.resource.name} → ${booking.resourcePart.name}`
      : booking.resource.name

    if (action === "approve") {
      const count = bookingIdsToUpdate.length
      const emailContent = await getBookingApprovedEmail(
        booking.organizationId,
        booking.title, 
        resourceName, 
        count > 1 ? `${date} (og ${count - 1} andre datoer)` : date, 
        time
      )
      await sendEmail(booking.organizationId, { to: userEmail, ...emailContent })
    } else {
      const count = bookingIdsToUpdate.length
      const emailContent = await getBookingRejectedEmail(
        booking.organizationId,
        booking.title, 
        resourceName, 
        count > 1 ? `${date} (og ${count - 1} andre datoer)` : date, 
        time, 
        statusNote
      )
      await sendEmail(booking.organizationId, { to: userEmail, ...emailContent })
    }
  }

  return NextResponse.json({ 
    ...updatedBooking, 
    updatedCount: bookingIdsToUpdate.length 
  })
}
