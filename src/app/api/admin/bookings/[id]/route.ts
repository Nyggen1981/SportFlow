import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { sendEmail, getBookingApprovedEmail, getBookingRejectedEmail, formatBookingDateTime } from "@/lib/email"
import { nb } from "date-fns/locale"
import { formatInTimeZone } from "date-fns-tz"

const TIMEZONE = "Europe/Oslo"
import { isPricingEnabled } from "@/lib/pricing"
import { createInvoiceForBooking, createInvoiceWithPDF, sendInvoiceEmail } from "@/lib/invoice"
import { getVippsClient, sendVippsPaymentEmail } from "@/lib/vipps"
import { format } from "date-fns"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  
  // Parse request body
  let body: { 
    action?: string
    status?: string
    statusNote?: string
    applyToAll?: boolean
  } = {}
  try {
    body = await request.json()
  } catch (jsonError) {
    try {
      const bodyText = await request.text()
      if (bodyText && bodyText.trim()) {
        body = JSON.parse(bodyText)
      } else {
        return NextResponse.json({ 
          error: "Request body is required"
        }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ 
        error: "Invalid request body"
      }, { status: 400 })
    }
  }

  // Support both 'action' and 'status' fields for backward compatibility
  let action: string | undefined = body.action
  const status = body.status as string | undefined
  
  // If action is not provided but status is, convert status to action
  if (!action && status) {
    if (status === "approved") {
      action = "approve"
    } else if (status === "rejected") {
      action = "reject"
    }
  }
  
  const { statusNote, applyToAll } = body

  // Validate action
  if (!action || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ 
      error: "Invalid action. Must be 'approve' or 'reject'"
    }, { status: 400 })
  }

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

  // Check if user has permission to approve/reject this booking
  const isAdmin = session.user.role === "admin"
  const isModerator = session.user.role === "moderator"
  
  if (!isAdmin && !isModerator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
        error: "Du har ikke tilgang til å godkjenne bookinger for denne fasiliteten" 
      }, { status: 403 })
    }
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

  // Determine the new status
  const newStatus = action === "approve" ? "approved" : "rejected"

  // Store invoice data for email attachment
  let invoiceData: { invoiceNumber: string; pdfBuffer: Buffer; dueDate: Date; totalAmount: number } | null = null

  // Håndter betaling hvis booking godkjennes og har kostnad (kun hvis pricing er aktivert)
  const pricingEnabled = await isPricingEnabled()
  if (action === "approve" && pricingEnabled && booking.totalAmount && Number(booking.totalAmount) > 0) {
    // Bruk brukerens foretrukne betalingsmetode fra booking, eller faktura som standard
    const method = booking.preferredPaymentMethod || "INVOICE"
    
    try {
      if (method === "INVOICE") {
        // Opprett faktura og generer PDF for vedlegg i godkjennings-e-post
        const { invoiceId, invoiceNumber, pdfBuffer, dueDate } = await createInvoiceWithPDF(
          booking.id,
          booking.organizationId
        )
        console.log(`[Booking Approval] Created invoice ${invoiceNumber} for booking ${booking.id} with PDF attachment`)
        invoiceData = { invoiceNumber, pdfBuffer, dueDate, totalAmount: Number(booking.totalAmount) }
      } else if (method === "VIPPS") {
        // Opprett Vipps-betaling
        const organization = await prisma.organization.findUnique({
          where: { id: booking.organizationId }
        })
        
        // La admin godkjenne selv om Vipps ikke er konfigurert (kan sendes senere)
        if (!organization?.vippsClientId || !organization?.vippsClientSecret || !organization?.vippsSubscriptionKey) {
          // Opprett faktura i stedet hvis Vipps ikke er konfigurert
          console.log(`[Booking Approval] Vipps ikke konfigurert, oppretter faktura i stedet for booking ${booking.id}`)
          const { invoiceId, invoiceNumber } = await createInvoiceForBooking(
            booking.id,
            booking.organizationId
          )
          console.log(`[Booking Approval] Created invoice ${invoiceNumber} for booking ${booking.id} (Vipps fallback)`)
          // Ikke send faktura automatisk - admin kan sende den senere
        } else {
          // Opprett payment record
          const payment = await prisma.payment.create({
            data: {
              organizationId: booking.organizationId,
              bookingId: booking.id,
              paymentType: "BOOKING",
              amount: booking.totalAmount,
              currency: "NOK",
              status: "PENDING",
              paymentMethod: "VIPPS",
              description: `Betaling for booking: ${booking.title} - ${booking.resource.name}`
            }
          })
          
          // Opprett Vipps payment
          const vippsClient = await getVippsClient(booking.organizationId)
          const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
          
          const vippsPayment = await vippsClient.createPayment({
            amount: Math.round(Number(booking.totalAmount) * 100), // Convert to øre
            currency: "NOK",
            reference: payment.id,
            userFlow: "WEB_REDIRECT",
            returnUrl: `${baseUrl}/payment/success?paymentId=${payment.id}`,
            cancelUrl: `${baseUrl}/payment/cancel?paymentId=${payment.id}`,
            paymentDescription: `Betaling for booking: ${booking.title} - ${booking.resource.name}`,
            userDetails: {
              userId: booking.user.email,
              phoneNumber: booking.user.phone || undefined,
              email: booking.user.email
            }
          })
          
          // Update payment with Vipps order ID
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              vippsOrderId: vippsPayment.orderId
            }
          })
          
          console.log(`[Booking Approval] Created Vipps payment ${vippsPayment.orderId} for booking ${booking.id}`)
          
          // Send Vipps betalingslink via e-post (non-blocking)
          void sendVippsPaymentEmail(payment.id, vippsPayment.url, booking.organizationId).catch((error) => {
            console.error(`[Booking Approval] Failed to send Vipps payment email for booking ${booking.id}:`, error)
          })
        }
      } else if (method === "CARD") {
        // Opprett kortbetaling (TODO: Implementer kortbetaling når kortbetaling-API er klar)
        // For nå, fallback til faktura
        console.log(`[Booking Approval] Card payment not yet implemented, creating invoice instead`)
        const { invoiceId, invoiceNumber } = await createInvoiceForBooking(booking.id, booking.organizationId)
        console.log(`[Booking Approval] Created invoice ${invoiceNumber} for booking ${booking.id} (Card fallback)`)
        // Faktura sendes ikke automatisk - admin kan sende den manuelt fra booking-detaljer
      }
    } catch (error) {
      console.error(`[Booking Approval] Error creating payment for booking ${booking.id}:`, error)
      // Fortsett med booking-godkjenning selv om betalingsopprettelse feiler
      // Admin kan håndtere betaling manuelt senere
    }
  }

  // Update all selected bookings
  await prisma.booking.updateMany({
    where: { id: { in: bookingIdsToUpdate } },
    data: {
      status: newStatus,
      statusNote: statusNote || null,
      approvedAt: action === "approve" ? new Date() : null,
      approvedById: action === "approve" ? session.user.id : null
    }
  })

  // Send email notification (non-blocking - don't await)
  const userEmail = booking.contactEmail || booking.user.email
  if (userEmail) {
    const { date, time } = formatBookingDateTime(new Date(booking.startTime), new Date(booking.endTime))
    const resourceName = booking.resourcePart 
      ? `${booking.resource.name} → ${booking.resourcePart.name}`
      : booking.resource.name
    const count = bookingIdsToUpdate.length

    // Fire and forget - don't block the response
    const sendEmailAsync = async () => {
      try {
        if (action === "approve") {
          const adminNote = (booking.resourcePart as any)?.adminNote || null
          
          // Prepare invoice info if we have invoice data
          const invoiceInfo = invoiceData ? {
            invoiceNumber: invoiceData.invoiceNumber,
            dueDate: format(invoiceData.dueDate, "d. MMMM yyyy", { locale: nb }),
            totalAmount: invoiceData.totalAmount
          } : null
          
          const emailContent = await getBookingApprovedEmail(
            booking.organizationId,
            booking.title, 
            resourceName, 
            count > 1 ? `${date} (og ${count - 1} andre datoer)` : date, 
            time,
            adminNote,
            invoiceInfo
          )
          
          // Attach invoice PDF if available
          const attachments = invoiceData ? [{
            filename: `Faktura_${invoiceData.invoiceNumber}.pdf`,
            content: invoiceData.pdfBuffer,
            contentType: "application/pdf"
          }] : undefined
          
          await sendEmail(booking.organizationId, { to: userEmail, ...emailContent, attachments })
        } else {
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
      } catch (error) {
        console.error("Failed to send email:", error)
      }
    }

    // Don't await - let it run in background
    void sendEmailAsync()
  }

  return NextResponse.json({ 
    id,
    status: newStatus,
    updatedCount: bookingIdsToUpdate.length 
  })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  
  // Check for deleteAll query parameter
  const url = new URL(request.url)
  const deleteAll = url.searchParams.get('deleteAll') === 'true'

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      resourceId: true,
      isRecurring: true,
      parentBookingId: true,
      status: true,
      endTime: true
    }
  })

  if (!booking || booking.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  // Check if user has permission to delete this booking
  const isAdmin = session.user.role === "admin"
  const isModerator = session.user.role === "moderator"
  
  if (!isAdmin && !isModerator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
        error: "Du har ikke tilgang til å slette bookinger for denne fasiliteten" 
      }, { status: 403 })
    }
  }

  // Validate that booking can be deleted - must be cancelled, rejected, or past
  const isPast = new Date(booking.endTime) < new Date()
  const isInactive = booking.status === "cancelled" || booking.status === "rejected"
  
  if (!isPast && !isInactive) {
    return NextResponse.json({ 
      error: "Kan kun slette kansellerte, avslåtte eller passerte bookinger" 
    }, { status: 400 })
  }

  // If deleteAll and this is a recurring booking, delete all in the series
  if (deleteAll && booking.isRecurring) {
    const groupId = booking.parentBookingId || booking.id
    
    // Delete all bookings in the series that are cancelled, rejected, or past
    await prisma.booking.deleteMany({
      where: {
        AND: [
          {
            OR: [
              { id: groupId },
              { parentBookingId: groupId }
            ]
          },
          { organizationId: session.user.organizationId },
          {
            OR: [
              { status: { in: ["cancelled", "rejected"] } },
              { endTime: { lt: new Date() } }
            ]
          }
        ]
      }
    })
    
    return NextResponse.json({ success: true, deletedAll: true })
  }

  // Delete single booking
  await prisma.booking.delete({
    where: { id }
  })

  return NextResponse.json({ success: true })
}
