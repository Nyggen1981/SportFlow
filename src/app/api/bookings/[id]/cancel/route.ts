import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { sendEmail, getBookingCancelledByAdminEmail, getBookingCancelledByUserEmail } from "@/lib/email"
import { format } from "date-fns"
import { nb } from "date-fns/locale"

export async function POST(
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
    const { reason } = body

    // Get the booking with user and resource info
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        user: true,
        resource: {
          include: {
            organization: true
          }
        },
        resourcePart: true
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

    // Update booking status to cancelled
    await prisma.booking.update({
      where: { id },
      data: { 
        status: "cancelled",
        statusNote: reason || (isAdmin ? "Kansellert av administrator" : "Kansellert av bruker")
      }
    })

    // Format date and time for email
    const date = format(new Date(booking.startTime), "EEEE d. MMMM yyyy", { locale: nb })
    const time = `${format(new Date(booking.startTime), "HH:mm")} - ${format(new Date(booking.endTime), "HH:mm")}`
    const resourceName = booking.resourcePart 
      ? `${booking.resource.name} → ${booking.resourcePart.name}`
      : booking.resource.name

    // Send email notification (non-blocking)
    const orgId = booking.resource.organizationId
    const sendEmailsAsync = async () => {
      try {
        if (isAdmin) {
          // Admin cancelled - notify the booker
          const userEmail = booking.contactEmail || booking.user.email
          if (userEmail) {
            const emailContent = await getBookingCancelledByAdminEmail(
              orgId, booking.title, resourceName, date, time, reason
            )
            await sendEmail(orgId, { to: userEmail, ...emailContent })
          }
        } else {
          // User cancelled - notify admin(s) in parallel
          const admins = await prisma.user.findMany({
            where: { organizationId: orgId, role: "admin" },
            select: { email: true }
          })
          
          const userName = booking.user.name || booking.contactName || "Ukjent"
          await Promise.all(admins.map(async (admin) => {
            const emailContent = await getBookingCancelledByUserEmail(
              orgId, booking.title, resourceName, date, time, userName, booking.user.email, reason
            )
            await sendEmail(orgId, { to: admin.email, ...emailContent })
          }))
        }
      } catch (error) {
        console.error("Failed to send cancellation emails:", error)
      }
    }
    
    void sendEmailsAsync()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error cancelling booking:", error)
    return NextResponse.json(
      { error: "Kunne ikke kansellere booking" },
      { status: 500 }
    )
  }
}


