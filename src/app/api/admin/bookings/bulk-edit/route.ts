import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { sendEmail, getNewBookingRequestEmail } from "@/lib/email"

/**
 * Bulk edit bookings - update multiple bookings at once
 * Supports: title, resource, time shift, absolute time change
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
    title?: string
    resourceId?: string
    resourcePartId?: string | null
    // Time options - choose one approach:
    // 1. Shift all times by X minutes
    timeShiftMinutes?: number
    // 2. Set absolute time (same time for all, keeps their original dates)
    newStartTime?: string // HH:mm format
    newEndTime?: string   // HH:mm format
    // Whether to reset status to pending (for non-admin edits)
    resetStatus?: boolean
  }
  
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { 
    bookingIds, 
    title, 
    resourceId, 
    resourcePartId,
    timeShiftMinutes,
    newStartTime,
    newEndTime,
    resetStatus = false
  } = body

  if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
    return NextResponse.json({ error: "No booking IDs provided" }, { status: 400 })
  }

  // Check if any update is actually requested
  const hasUpdate = title || resourceId || timeShiftMinutes !== undefined || newStartTime || newEndTime
  if (!hasUpdate) {
    return NextResponse.json({ error: "No changes specified" }, { status: 400 })
  }

  // Fetch all bookings to verify access
  const bookings = await prisma.booking.findMany({
    where: {
      id: { in: bookingIds },
      organizationId: session.user.organizationId
    },
    include: {
      resource: true,
      user: true
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

  // If changing resource, verify new resource exists
  if (resourceId) {
    const newResource = await prisma.resource.findFirst({
      where: {
        id: resourceId,
        organizationId: session.user.organizationId
      }
    })
    if (!newResource) {
      return NextResponse.json({ error: "Fasilitet ikke funnet" }, { status: 404 })
    }
  }

  // If changing resource part, verify it exists
  if (resourcePartId) {
    const newPart = await prisma.resourcePart.findFirst({
      where: {
        id: resourcePartId,
        resourceId: resourceId || bookings[0].resourceId
      }
    })
    if (!newPart) {
      return NextResponse.json({ error: "Del ikke funnet" }, { status: 404 })
    }
  }

  // Prepare updates for each booking
  const updatePromises = bookings.map(async (booking) => {
    const updateData: any = {}
    
    if (title) {
      updateData.title = title
    }
    
    if (resourceId) {
      updateData.resourceId = resourceId
      // Clear part if changing resource (unless new part is specified)
      if (!resourcePartId) {
        updateData.resourcePartId = null
      }
    }
    
    if (resourcePartId !== undefined) {
      updateData.resourcePartId = resourcePartId
    }
    
    // Handle time changes
    if (timeShiftMinutes !== undefined && timeShiftMinutes !== 0) {
      // Shift times by X minutes
      const startTime = new Date(booking.startTime)
      const endTime = new Date(booking.endTime)
      startTime.setMinutes(startTime.getMinutes() + timeShiftMinutes)
      endTime.setMinutes(endTime.getMinutes() + timeShiftMinutes)
      updateData.startTime = startTime
      updateData.endTime = endTime
    } else if (newStartTime && newEndTime) {
      // Set absolute time (keep original date, change time)
      const [startHours, startMinutes] = newStartTime.split(':').map(Number)
      const [endHours, endMinutes] = newEndTime.split(':').map(Number)
      
      const startTime = new Date(booking.startTime)
      const endTime = new Date(booking.startTime) // Use start date for end time too
      
      startTime.setHours(startHours, startMinutes, 0, 0)
      endTime.setHours(endHours, endMinutes, 0, 0)
      
      // If end time is before start time, assume it's next day
      if (endTime <= startTime) {
        endTime.setDate(endTime.getDate() + 1)
      }
      
      updateData.startTime = startTime
      updateData.endTime = endTime
    }
    
    // Reset status to pending if requested (e.g., after significant changes)
    if (resetStatus) {
      updateData.status = "pending"
      updateData.approvedAt = null
      updateData.approvedById = null
    }
    
    return prisma.booking.update({
      where: { id: booking.id },
      data: updateData
    })
  })

  try {
    await Promise.all(updatePromises)
  } catch (error) {
    console.error("Failed to bulk update bookings:", error)
    return NextResponse.json({ error: "Kunne ikke oppdatere bookinger" }, { status: 500 })
  }

  // If status was reset, send notification email to admins (non-blocking)
  if (resetStatus && bookings.length > 0) {
    const firstBooking = bookings[0]
    void (async () => {
      try {
        // Get admin emails
        const admins = await prisma.user.findMany({
          where: {
            organizationId: session.user.organizationId,
            role: "admin"
          },
          select: { email: true }
        })
        
        for (const admin of admins) {
          const emailContent = await getNewBookingRequestEmail(
            firstBooking.organizationId,
            firstBooking.title,
            firstBooking.resource.name,
            `${bookings.length} bookinger redigert`,
            "Se admin-panel for detaljer",
            firstBooking.user.name || "Ukjent",
            firstBooking.user.email || ""
          )
          await sendEmail(firstBooking.organizationId, { to: admin.email, ...emailContent })
        }
      } catch (error) {
        console.error("Failed to send notification email:", error)
      }
    })()
  }

  return NextResponse.json({ 
    success: true,
    updatedCount: bookings.length 
  })
}
