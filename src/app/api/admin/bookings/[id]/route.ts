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
  const { action, statusNote } = await request.json()

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

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: {
      status: action === "approve" ? "approved" : "rejected",
      statusNote: statusNote || null,
      approvedAt: action === "approve" ? new Date() : null,
      approvedById: action === "approve" ? session.user.id : null
    }
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
      const emailContent = getBookingApprovedEmail(booking.title, resourceName, date, time)
      await sendEmail({ to: userEmail, ...emailContent })
    } else {
      const emailContent = getBookingRejectedEmail(booking.title, resourceName, date, time, statusNote)
      await sendEmail({ to: userEmail, ...emailContent })
    }
  }

  return NextResponse.json(updatedBooking)
}
