import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { sendEmail, getBookingApprovedEmail, getBookingRejectedEmail } from "@/lib/email"
import { nb } from "date-fns/locale"
import { formatInTimeZone } from "date-fns-tz"

const TIMEZONE = "Europe/Oslo"

/**
 * Bulk update bookings (approve/reject multiple at once)
 * Much more efficient than individual API calls
 */
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const isAdmin = session.user.role === "admin"
  const isModerator = session.user.role === "moderator"
  
  if (!isAdmin && !isModerator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { 
    bookingIds: string[]
    action: "approve" | "reject"
    statusNote?: string
  }
  
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { bookingIds, action, statusNote } = body

  if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
    return NextResponse.json({ error: "No booking IDs provided" }, { status: 400 })
  }

  if (!action || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  // Fetch all bookings to verify access and get details for email
  const bookings = await prisma.booking.findMany({
    where: {
      id: { in: bookingIds },
      organizationId: session.user.organizationId
    },
    include: {
      user: true,
      resource: true,
      resourcePart: true
    }
  })

  if (bookings.length === 0) {
    return NextResponse.json({ error: "No valid bookings found" }, { status: 404 })
  }

  // If moderator, verify access to all resources
  if (isModerator) {
    const resourceIds = [...new Set(bookings.map(b => b.resourceId))]
    const moderatorAccess = await prisma.resourceModerator.findMany({
      where: {
        userId: session.user.id,
        resourceId: { in: resourceIds }
      }
    })
    const accessibleResourceIds = new Set(moderatorAccess.map(m => m.resourceId))
    
    const unauthorizedBookings = bookings.filter(b => !accessibleResourceIds.has(b.resourceId))
    if (unauthorizedBookings.length > 0) {
      return NextResponse.json({ 
        error: "Du har ikke tilgang til alle valgte bookinger" 
      }, { status: 403 })
    }
  }

  const newStatus = action === "approve" ? "approved" : "rejected"
  const validBookingIds = bookings.map(b => b.id)

  // Update all bookings in a single database operation
  await prisma.booking.updateMany({
    where: { id: { in: validBookingIds } },
    data: {
      status: newStatus,
      statusNote: statusNote || null,
      approvedAt: action === "approve" ? new Date() : null,
      approvedById: action === "approve" ? session.user.id : null
    }
  })

  // Send email notifications (non-blocking)
  // Group by user to send one email per user
  const bookingsByUser = bookings.reduce((acc, booking) => {
    const email = booking.contactEmail || booking.user.email
    if (!email) return acc
    
    if (!acc[email]) {
      acc[email] = {
        email,
        bookings: [],
        organizationId: booking.organizationId
      }
    }
    acc[email].bookings.push(booking)
    return acc
  }, {} as Record<string, { email: string; bookings: typeof bookings; organizationId: string }>)

  // Fire and forget email sending
  void (async () => {
    for (const { email, bookings: userBookings, organizationId } of Object.values(bookingsByUser)) {
      try {
        const firstBooking = userBookings[0]
        const date = formatInTimeZone(new Date(firstBooking.startTime), TIMEZONE, "EEEE d. MMMM yyyy", { locale: nb })
        const time = `${formatInTimeZone(new Date(firstBooking.startTime), TIMEZONE, "HH:mm")} - ${formatInTimeZone(new Date(firstBooking.endTime), TIMEZONE, "HH:mm")}`
        const resourceName = firstBooking.resourcePart 
          ? `${firstBooking.resource.name} → ${firstBooking.resourcePart.name}`
          : firstBooking.resource.name
        const count = userBookings.length

        if (action === "approve") {
          const adminNote = (firstBooking.resourcePart as any)?.adminNote || null
          const emailContent = await getBookingApprovedEmail(
            organizationId,
            firstBooking.title, 
            resourceName, 
            count > 1 ? `${date} (og ${count - 1} andre datoer)` : date, 
            time,
            adminNote
          )
          await sendEmail(organizationId, { to: email, ...emailContent })
        } else {
          const emailContent = await getBookingRejectedEmail(
            organizationId,
            firstBooking.title, 
            resourceName, 
            count > 1 ? `${date} (og ${count - 1} andre datoer)` : date, 
            time, 
            statusNote
          )
          await sendEmail(organizationId, { to: email, ...emailContent })
        }
      } catch (error) {
        console.error("Failed to send bulk email:", error)
      }
    }
  })()

  return NextResponse.json({ 
    success: true,
    updatedCount: validBookingIds.length 
  })
}
