import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getBookingApprovedEmail } from "@/lib/email"
import { getInvoiceEmailPreview, getVippsPaymentEmailPreview } from "@/lib/email-preview"
import { nb } from "date-fns/locale"
import { formatInTimeZone } from "date-fns-tz"

const TIMEZONE = "Europe/Oslo"
import { isPricingEnabled } from "@/lib/pricing"
import { createInvoiceForBooking } from "@/lib/invoice"

export async function GET(
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

  const { id } = await params

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

  // Check if moderator has access
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
        error: "Du har ikke tilgang til denne booking" 
      }, { status: 403 })
    }
  }

  const pricingEnabled = await isPricingEnabled()
  const hasCost = pricingEnabled && booking.totalAmount && Number(booking.totalAmount) > 0

  if (!hasCost) {
    // Ingen kostnad - returner standard godkjenningsmail
    const date = formatInTimeZone(new Date(booking.startTime), TIMEZONE, "EEEE d. MMMM yyyy", { locale: nb })
    const time = `${formatInTimeZone(new Date(booking.startTime), TIMEZONE, "HH:mm")} - ${formatInTimeZone(new Date(booking.endTime), TIMEZONE, "HH:mm")}`
    const resourceName = booking.resourcePart 
      ? `${booking.resource.name} → ${booking.resourcePart.name}`
      : booking.resource.name
    const adminNote = (booking.resourcePart as any)?.adminNote || null

    const emailContent = await getBookingApprovedEmail(
      booking.organizationId,
      booking.title,
      resourceName,
      date,
      time,
      adminNote
    )

    return NextResponse.json({
      type: "approved",
      subject: emailContent.subject,
      html: emailContent.html
    })
  }

  // Booking har kostnad - hent preview basert på betalingsmetode
  const method = booking.preferredPaymentMethod || "INVOICE"
  const date = formatInTimeZone(new Date(booking.startTime), TIMEZONE, "EEEE d. MMMM yyyy", { locale: nb })
  const time = `${formatInTimeZone(new Date(booking.startTime), TIMEZONE, "HH:mm")} - ${formatInTimeZone(new Date(booking.endTime), TIMEZONE, "HH:mm")}`
  const resourceName = booking.resourcePart 
    ? `${booking.resource.name} → ${booking.resourcePart.name}`
    : booking.resource.name

  if (method === "INVOICE") {
    // Opprett faktura (men ikke send) for å få preview
    try {
      const { invoiceId } = await createInvoiceForBooking(booking.id, booking.organizationId)
      const preview = await getInvoiceEmailPreview(invoiceId, booking.organizationId)
      
      // Slett fakturaen igjen (den vil bli opprettet på nytt ved faktisk godkjenning)
      await prisma.invoice.delete({ where: { id: invoiceId } })
      await prisma.booking.update({ 
        where: { id: booking.id }, 
        data: { invoiceId: null } 
      })

      return NextResponse.json({
        type: "invoice",
        subject: preview.subject,
        html: preview.html
      })
    } catch (error) {
      console.error("Error generating invoice preview:", error)
      return NextResponse.json({ 
        error: "Kunne ikke generere faktura preview" 
      }, { status: 500 })
    }
  } else if (method === "VIPPS") {
    // Sjekk om Vipps er konfigurert
    const organization = await prisma.organization.findUnique({
      where: { id: booking.organizationId }
    })

    if (!organization?.vippsClientId || !organization?.vippsClientSecret || !organization?.vippsSubscriptionKey) {
      return NextResponse.json({ 
        error: "Vipps er ikke konfigurert",
        requiresConfiguration: true
      }, { status: 400 })
    }

    // Generer preview av Vipps e-post (uten å opprette faktisk betaling)
    try {
      const preview = await getVippsPaymentEmailPreview(
        booking.id,
        booking.organizationId,
        Number(booking.totalAmount)
      )

      return NextResponse.json({
        type: "vipps",
        subject: preview.subject,
        html: preview.html
      })
    } catch (error) {
      console.error("Error generating Vipps preview:", error)
      return NextResponse.json({ 
        error: "Kunne ikke generere Vipps preview" 
      }, { status: 500 })
    }
  } else if (method === "CARD") {
    // Kortbetaling ikke implementert ennå
    return NextResponse.json({ 
      error: "Kortbetaling er ikke implementert ennå",
      fallbackToInvoice: true
    }, { status: 400 })
  }

  return NextResponse.json({ 
    error: "Ukjent betalingsmetode" 
  }, { status: 400 })
}

