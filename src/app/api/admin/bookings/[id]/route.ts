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
  
  // Log request details
  console.log("=== REQUEST DETAILS ===")
  console.log("Method:", request.method)
  console.log("URL:", request.url)
  console.log("Content-Type:", request.headers.get("content-type"))
  
  // Parse request body - try request.json() first, fallback to text parsing
  let body: { action?: string; statusNote?: string; applyToAll?: boolean } = {}
  try {
    // Try to get body as JSON directly
    body = await request.json()
    console.log("Parsed body (from json):", body)
  } catch (jsonError) {
    // If JSON parsing fails, try text parsing
    try {
      const bodyText = await request.text()
      console.log("Raw body text:", bodyText)
      if (bodyText && bodyText.trim()) {
        body = JSON.parse(bodyText)
        console.log("Parsed body (from text):", body)
      } else {
        console.log("Body is empty or whitespace")
        return NextResponse.json({ 
          error: "Request body is required",
          details: "No body was sent with the request"
        }, { status: 400 })
      }
    } catch (textError) {
      console.error("Error parsing request body:", { jsonError, textError })
      return NextResponse.json({ 
        error: "Invalid request body", 
        details: String(textError || jsonError)
      }, { status: 400 })
    }
  }

  const { action, statusNote, applyToAll } = body
  console.log("Extracted values:", { action, statusNote, applyToAll, actionType: typeof action })

  // Validate action
  if (!action || (action !== "approve" && action !== "reject")) {
    console.error("Invalid action received:", action, "Type:", typeof action)
    return NextResponse.json({ 
      error: "Invalid action. Must be 'approve' or 'reject'",
      received: action,
      receivedType: typeof action,
      fullBody: body
    }, { status: 400 })
  }

  // Debug logging
  console.log("=== BOOKING ACTION DEBUG ===")
  console.log("Booking ID:", id)
  console.log("Action received:", action)
  console.log("Status note:", statusNote)
  console.log("Apply to all:", applyToAll)
  console.log("============================")

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

  // Determine the new status
  const newStatus = action === "approve" ? "approved" : "rejected"
  console.log("Setting status to:", newStatus)
  console.log("Updating booking IDs:", bookingIdsToUpdate)

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

  // Get the updated booking to return
  const updatedBooking = await prisma.booking.findUnique({
    where: { id }
  })
  
  console.log("Updated booking status:", updatedBooking?.status)

  // Send email notification
  const userEmail = booking.contactEmail || booking.user.email
  if (userEmail) {
    const date = format(new Date(booking.startTime), "EEEE d. MMMM yyyy", { locale: nb })
    const time = `${format(new Date(booking.startTime), "HH:mm")} - ${format(new Date(booking.endTime), "HH:mm")}`
    const resourceName = booking.resourcePart 
      ? `${booking.resource.name} → ${booking.resourcePart.name}`
      : booking.resource.name

    if (action === "approve") {
      console.log("Sending APPROVED email to:", userEmail)
      const count = bookingIdsToUpdate.length
      const emailContent = await getBookingApprovedEmail(
        booking.organizationId,
        booking.title, 
        resourceName, 
        count > 1 ? `${date} (og ${count - 1} andre datoer)` : date, 
        time
      )
      console.log("Approved email subject:", emailContent.subject)
      await sendEmail(booking.organizationId, { to: userEmail, ...emailContent })
    } else {
      console.log("Sending REJECTED email to:", userEmail)
      const count = bookingIdsToUpdate.length
      const emailContent = await getBookingRejectedEmail(
        booking.organizationId,
        booking.title, 
        resourceName, 
        count > 1 ? `${date} (og ${count - 1} andre datoer)` : date, 
        time, 
        statusNote
      )
      console.log("Rejected email subject:", emailContent.subject)
      await sendEmail(booking.organizationId, { to: userEmail, ...emailContent })
    }
  }

  return NextResponse.json({ 
    ...updatedBooking, 
    updatedCount: bookingIdsToUpdate.length 
  })
}
