import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"

const TIMEZONE = "Europe/Oslo"

/**
 * Bulk edit bookings for the logged-in user (owner check).
 * Supports: title, resource, absolute time change.
 * Resets status to pending so admin must re-approve.
 */
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: {
    bookingIds: string[]
    title?: string
    resourceId?: string
    resourcePartId?: string | null
    newStartTime?: string
    newEndTime?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { bookingIds, title, resourceId, resourcePartId, newStartTime, newEndTime } = body

  if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
    return NextResponse.json({ error: "No booking IDs provided" }, { status: 400 })
  }

  const hasUpdate = title || resourceId || (newStartTime && newEndTime)
  if (!hasUpdate) {
    return NextResponse.json({ error: "No changes specified" }, { status: 400 })
  }

  // Fetch bookings and verify ownership
  const bookings = await prisma.booking.findMany({
    where: {
      id: { in: bookingIds },
      organizationId: session.user.organizationId,
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

  if (bookings.length !== bookingIds.length) {
    return NextResponse.json({ error: "Du har ikke tilgang til alle valgte bookinger" }, { status: 403 })
  }

  if (resourceId) {
    const newResource = await prisma.resource.findFirst({
      where: { id: resourceId, organizationId: session.user.organizationId },
    })
    if (!newResource) {
      return NextResponse.json({ error: "Fasilitet ikke funnet" }, { status: 404 })
    }
  }

  if (resourcePartId) {
    const newPart = await prisma.resourcePart.findFirst({
      where: { id: resourcePartId, resourceId: resourceId || bookings[0].resourceId },
    })
    if (!newPart) {
      return NextResponse.json({ error: "Del ikke funnet" }, { status: 404 })
    }
  }

  const updatePromises = bookings.map(async (booking) => {
    const updateData: Record<string, unknown> = {
      status: "pending",
      approvedAt: null,
      approvedById: null,
    }

    if (title) {
      updateData.title = title
    }

    if (resourceId) {
      updateData.resourceId = resourceId
      if (!resourcePartId) {
        updateData.resourcePartId = null
      }
    }

    if (resourcePartId !== undefined) {
      updateData.resourcePartId = resourcePartId
    }

    if (newStartTime && newEndTime) {
      const originalDate = formatInTimeZone(booking.startTime, TIMEZONE, "yyyy-MM-dd")
      const startTime = fromZonedTime(`${originalDate}T${newStartTime}:00`, TIMEZONE)
      let endTime = fromZonedTime(`${originalDate}T${newEndTime}:00`, TIMEZONE)

      if (endTime <= startTime) {
        endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000)
      }

      updateData.startTime = startTime
      updateData.endTime = endTime
    }

    return prisma.booking.update({
      where: { id: booking.id },
      data: updateData,
    })
  })

  try {
    await Promise.all(updatePromises)
  } catch (error) {
    console.error("Failed to bulk update bookings:", error)
    return NextResponse.json({ error: "Kunne ikke oppdatere bookinger" }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    updatedCount: bookings.length,
  })
}
