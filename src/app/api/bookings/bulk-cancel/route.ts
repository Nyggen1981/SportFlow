import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { sendEmail, getBookingCancelledByUserEmail, formatBookingDateTime } from "@/lib/email"

/**
 * Bulk cancel bookings for the logged-in user (owner check).
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: {
    bookingIds: string[]
    reason?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { bookingIds, reason } = body

  if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
    return NextResponse.json({ error: "No booking IDs provided" }, { status: 400 })
  }

  const bookings = await prisma.booking.findMany({
    where: {
      id: { in: bookingIds },
      organizationId: session.user.organizationId,
      status: { in: ["pending", "approved"] },
      OR: [
        { userId: session.user.id },
        { coOwners: { some: { userId: session.user.id } } },
      ],
    },
    include: { resource: true },
  })

  if (bookings.length === 0) {
    return NextResponse.json({ error: "No valid bookings found" }, { status: 404 })
  }

  await prisma.booking.updateMany({
    where: { id: { in: bookings.map((b) => b.id) } },
    data: {
      status: "cancelled",
      statusNote: reason || null,
    },
  })

  // Send notification emails to admins (non-blocking)
  if (bookings.length > 0) {
    const firstBooking = bookings[0]
    const orgId = session.user.organizationId

    try {
      const admins = await prisma.user.findMany({
        where: { organizationId: orgId, role: "admin" },
        select: { email: true },
      })

      const { date, time } = formatBookingDateTime(
        new Date(firstBooking.startTime),
        new Date(firstBooking.endTime)
      )

      const bookingTitle =
        bookings.length > 1
          ? `${firstBooking.title} (${bookings.length} bookinger)`
          : firstBooking.title

      for (const admin of admins) {
        const emailContent = await getBookingCancelledByUserEmail(
          orgId,
          bookingTitle,
          firstBooking.resource.name,
          date,
          time,
          session.user.name || "Ukjent",
          session.user.email || "",
          reason
        )
        await sendEmail(orgId, { to: admin.email, ...emailContent, category: "booking_bulk_cancel_admin" })
      }
    } catch (error) {
      console.error("Failed to send cancellation notification emails:", error)
    }
  }

  return NextResponse.json({
    success: true,
    cancelledCount: bookings.length,
  })
}
