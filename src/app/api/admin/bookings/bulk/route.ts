import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { sendEmail, getBookingApprovedEmail, getBookingRejectedEmail, getBookingCancelledByAdminEmail, formatBookingDateTime } from "@/lib/email"
import { createMultipleBookingsInvoiceWithPDF } from "@/lib/invoice"
import { getBookingNotificationEmails } from "@/lib/booking-notifications"
import { getAllRelatedPartIds } from "@/lib/resource-parts"
import { isPricingEnabled } from "@/lib/pricing"
import { nb } from "date-fns/locale"
import { format } from "date-fns"
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
    action: "approve" | "reject" | "cancel"
    statusNote?: string
    forceApproveOverlap?: boolean
  }
  
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { bookingIds, action, statusNote, forceApproveOverlap } = body

  if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
    return NextResponse.json({ error: "No booking IDs provided" }, { status: 400 })
  }

  if (!action || (action !== "approve" && action !== "reject" && action !== "cancel")) {
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

  const newStatus = action === "approve" ? "approved" : action === "cancel" ? "cancelled" : "rejected"
  const validBookingIds = bookings.map(b => b.id)

  // Before approving, check for overlapping bookings (same logic as single approve)
  type OverlapEntry = {
    id: string; title: string; startTime: Date; endTime: Date;
    organizationId: string; contactEmail: string | null;
    user: { email: string; name: string | null };
    resource: { name: string }; resourcePart: { name: string } | null;
  }
  let overlappingToCancel: OverlapEntry[] = []

  if (action === "approve") {
    for (const ab of bookings) {
      const timeOverlap = [
        { AND: [{ startTime: { lte: ab.startTime } }, { endTime: { gt: ab.startTime } }] },
        { AND: [{ startTime: { lt: ab.endTime } }, { endTime: { gte: ab.endTime } }] },
        { AND: [{ startTime: { gte: ab.startTime } }, { endTime: { lte: ab.endTime } }] },
      ]

      let conflictWhere: any
      if (ab.resourcePartId) {
        const partIdsToCheck = await getAllRelatedPartIds(ab.resourcePartId, ab.resourceId)
        conflictWhere = {
          resourceId: ab.resourceId,
          id: { notIn: validBookingIds },
          status: { in: ["pending", "approved"] },
          OR: [
            { resourcePartId: { in: partIdsToCheck }, AND: { OR: timeOverlap } },
            { resourcePartId: null, AND: { OR: timeOverlap } },
          ],
        }
      } else {
        conflictWhere = {
          resourceId: ab.resourceId,
          id: { notIn: validBookingIds },
          status: { in: ["pending", "approved"] },
          OR: timeOverlap,
        }
      }

      const found = await prisma.booking.findMany({
        where: conflictWhere,
        include: { user: true, resource: true, resourcePart: true },
      })
      for (const f of found) {
        if (!overlappingToCancel.some((o) => o.id === f.id)) {
          overlappingToCancel.push(f)
        }
      }
    }

    if (overlappingToCancel.length > 0 && !forceApproveOverlap) {
      return NextResponse.json({
        requiresOverlapConfirmation: true,
        overlappingBookings: overlappingToCancel.map((b) => ({
          id: b.id,
          title: b.title,
          startTime: b.startTime,
          endTime: b.endTime,
          status: "approved",
          user: { name: b.user.name, email: b.user.email },
          resourcePart: b.resourcePart ? { name: b.resourcePart.name } : null,
        })),
        message: `Godkjenning vil kansellere ${overlappingToCancel.length} eksisterende booking${overlappingToCancel.length > 1 ? "er" : ""} som overlapper`,
      })
    }
  }

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

  // Cancel overlapping bookings and notify their owners
  if (action === "approve" && overlappingToCancel.length > 0) {
    void (async () => {
      try {
        await prisma.booking.updateMany({
          where: { id: { in: overlappingToCancel.map((b) => b.id) } },
          data: { status: "cancelled", statusNote: "Kansellert fordi en overlappende booking ble prioritert" },
        })

        for (const cancelled of overlappingToCancel) {
          const notifyEmails = await getBookingNotificationEmails(cancelled.id)
          if (notifyEmails.length === 0) continue
          const { date, time } = formatBookingDateTime(new Date(cancelled.startTime), new Date(cancelled.endTime))
          const resName = cancelled.resourcePart
            ? `${cancelled.resource.name} → ${cancelled.resourcePart.name}`
            : cancelled.resource.name
          const emailContent = await getBookingCancelledByAdminEmail(
            cancelled.organizationId,
            cancelled.title,
            resName,
            date,
            time,
            "En annen booking ble prioritert for dette tidsrommet"
          )
          await Promise.all(
            notifyEmails.map((to) =>
              sendEmail(cancelled.organizationId, { to, ...emailContent, category: "booking_overlap_cancelled" })
            )
          )
        }
      } catch (err) {
        console.error("[Bulk Approval] Failed to cancel overlapping bookings:", err)
      }
    })()
  }

  // Check if pricing module is enabled (for invoice creation)
  const pricingEnabled = await isPricingEnabled()

  // Mottakere: hovedeier, kontakt-e-post, medeiere — per mottaker samlet liste bookinger
  const bookingsByRecipient = new Map<
    string,
    { organizationId: string; bookings: typeof bookings }
  >()

  for (const booking of bookings) {
    const emails = await getBookingNotificationEmails(booking.id)
    for (const emailAddr of emails) {
      const key = emailAddr.toLowerCase()
      if (!bookingsByRecipient.has(key)) {
        bookingsByRecipient.set(key, {
          organizationId: booking.organizationId,
          bookings: [],
        })
      }
      const entry = bookingsByRecipient.get(key)!
      if (!entry.bookings.some((b) => b.id === booking.id)) {
        entry.bookings.push(booking)
      }
    }
  }

  // Fire and forget email sending
  void (async () => {
    for (const [email, { bookings: userBookings, organizationId }] of bookingsByRecipient) {
      try {
        const firstBooking = userBookings[0]
        const { date, time } = formatBookingDateTime(new Date(firstBooking.startTime), new Date(firstBooking.endTime))
        const resourceName = firstBooking.resourcePart 
          ? `${firstBooking.resource.name} → ${firstBooking.resourcePart.name}`
          : firstBooking.resource.name
        const count = userBookings.length

        if (action === "approve") {
          const adminNote = (firstBooking.resourcePart as any)?.adminNote || null
          
          let invoiceAttachment: { filename: string; content: Buffer; contentType: string } | undefined
          let invoiceInfo: { invoiceNumber: string; dueDate: string; totalAmount: number } | null = null

          if (pricingEnabled) {
            const approvedBookings = await prisma.booking.findMany({
              where: {
                id: { in: userBookings.map((b) => b.id) },
                totalAmount: { gt: 0 },
                invoiceId: null,
              },
            })

            if (approvedBookings.length > 0) {
              try {
                const { invoiceNumber, pdfBuffer, dueDate, totalAmount } = await createMultipleBookingsInvoiceWithPDF(
                  approvedBookings.map((b) => b.id),
                  organizationId
                )
                invoiceAttachment = {
                  filename: `Faktura_${invoiceNumber}.pdf`,
                  content: pdfBuffer,
                  contentType: "application/pdf",
                }
                invoiceInfo = {
                  invoiceNumber,
                  dueDate: format(dueDate, "d. MMMM yyyy", { locale: nb }),
                  totalAmount,
                }
                console.log(`[Bulk Approval] Created invoice ${invoiceNumber} with PDF for ${approvedBookings.length} bookings`)
              } catch (invoiceError) {
                console.error("Failed to create combined invoice with PDF:", invoiceError)
              }
            }
          }
          
          const emailContent = await getBookingApprovedEmail(
            organizationId,
            firstBooking.title, 
            resourceName, 
            count > 1 ? `${date} (og ${count - 1} andre datoer)` : date, 
            time,
            adminNote,
            invoiceInfo
          )
          await sendEmail(organizationId, { 
            to: email, 
            ...emailContent,
            attachments: invoiceAttachment ? [invoiceAttachment] : undefined,
            category: "booking_approved",
          })
        } else if (action === "cancel") {
          const emailContent = await getBookingCancelledByAdminEmail(
            organizationId,
            firstBooking.title, 
            resourceName, 
            count > 1 ? `${date} (og ${count - 1} andre datoer)` : date, 
            time, 
            statusNote
          )
          await sendEmail(organizationId, { to: email, ...emailContent, category: "booking_cancelled_admin" })
        } else {
          const emailContent = await getBookingRejectedEmail(
            organizationId,
            firstBooking.title, 
            resourceName, 
            count > 1 ? `${date} (og ${count - 1} andre datoer)` : date, 
            time, 
            statusNote
          )
          await sendEmail(organizationId, { to: email, ...emailContent, category: "booking_rejected" })
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
