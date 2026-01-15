import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { sendEmail, getBookingPaidEmail } from "@/lib/email"
import { nb } from "date-fns/locale"
import { formatInTimeZone } from "date-fns-tz"

const TIMEZONE = "Europe/Oslo"
import { isPricingEnabled } from "@/lib/pricing"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const isAdmin = session.user.role === "admin"
  const isModerator = session.user.role === "moderator"
  
  if (!isAdmin && !isModerator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Sjekk om pricing modulen er aktivert
  const pricingEnabled = await isPricingEnabled()
  if (!pricingEnabled) {
    return NextResponse.json({ 
      error: "Betalingsmodulen er ikke aktivert" 
    }, { status: 403 })
  }

  const { id } = await params
  
  const body = await request.json()
  const { useTemplate, customMessage } = body

  // Hent booking med relaterte data
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

  // Check if moderator has access to this resource
  if (isModerator) {
    const moderatorAccess = await prisma.resourceModerator.findUnique({
      where: {
        userId_resourceId: {
          userId: session.user.id,
          resourceId: booking.resourceId
        }
      }
    })
    if (!moderatorAccess) {
      return NextResponse.json({ 
        error: "Du har ikke tilgang til å markere bookinger for denne fasiliteten" 
      }, { status: 403 })
    }
  }

  // Opprett eller oppdater payment record som COMPLETED
  const existingPayment = await prisma.payment.findFirst({
    where: {
      bookingId: booking.id,
      status: "COMPLETED"
    }
  })

  if (!existingPayment && booking.totalAmount && Number(booking.totalAmount) > 0) {
    // Opprett ny payment record hvis det ikke finnes en completed payment
    await prisma.payment.create({
      data: {
        organizationId: booking.organizationId,
        bookingId: booking.id,
        paymentType: "BOOKING",
        amount: booking.totalAmount,
        currency: "NOK",
        status: "COMPLETED",
        paymentMethod: "OTHER",
        description: `Manuell betalingsregistrering for booking: ${booking.title}`,
        completedAt: new Date()
      }
    })
  }

  // Oppdater invoice status hvis det finnes en faktura
  if (booking.invoiceId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: booking.invoiceId }
    })
    
    if (invoice && invoice.status !== "PAID") {
      await prisma.invoice.update({
        where: { id: booking.invoiceId },
        data: {
          status: "PAID",
          paidAt: new Date()
        }
      })
    }
  }

  // Send e-post til kunde
  const userEmail = booking.contactEmail || booking.user.email
  if (userEmail) {
    const date = formatInTimeZone(new Date(booking.startTime), TIMEZONE, "EEEE d. MMMM yyyy", { locale: nb })
    const time = `${formatInTimeZone(new Date(booking.startTime), TIMEZONE, "HH:mm")} - ${formatInTimeZone(new Date(booking.endTime), TIMEZONE, "HH:mm")}`
    const resourceName = booking.resourcePart 
      ? `${booking.resource.name} → ${booking.resourcePart.name}`
      : booking.resource.name

    // Hent adminNote fra resourcePart hvis useTemplate er true
    const adminNote = useTemplate && booking.resourcePart?.adminNote 
      ? booking.resourcePart.adminNote 
      : null

    // Fire and forget - don't block the response
    const sendEmailAsync = async () => {
      try {
        const emailContent = await getBookingPaidEmail(
          booking.organizationId,
          booking.title,
          resourceName,
          date,
          time,
          adminNote,
          useTemplate ? null : customMessage
        )
        await sendEmail(booking.organizationId, { to: userEmail, ...emailContent })
      } catch (error) {
        console.error("Failed to send payment confirmation email:", error)
      }
    }

    // Don't await - let it run in background
    void sendEmailAsync()
  }

  return NextResponse.json({ success: true })
}

