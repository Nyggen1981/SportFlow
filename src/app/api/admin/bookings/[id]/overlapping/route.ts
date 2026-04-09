import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getAllRelatedPartIds } from "@/lib/resource-parts"

/**
 * Find bookings that overlap with a given booking (same resource, same/related parts, overlapping time).
 * Used by admin to see what will be cancelled if they approve an overlap booking.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "moderator")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      resourceId: true,
      resourcePartId: true,
      organizationId: true,
    },
  })

  if (!booking || booking.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  const timeOverlap = [
    { AND: [{ startTime: { lte: booking.startTime } }, { endTime: { gt: booking.startTime } }] },
    { AND: [{ startTime: { lt: booking.endTime } }, { endTime: { gte: booking.endTime } }] },
    { AND: [{ startTime: { gte: booking.startTime } }, { endTime: { lte: booking.endTime } }] },
  ]

  let conflictWhere: any

  if (booking.resourcePartId) {
    const partIdsToCheck = await getAllRelatedPartIds(booking.resourcePartId, booking.resourceId)

    conflictWhere = {
      resourceId: booking.resourceId,
      id: { not: booking.id },
      status: { in: ["pending", "approved"] },
      OR: [
        { resourcePartId: { in: partIdsToCheck }, AND: { OR: timeOverlap } },
        { resourcePartId: null, AND: { OR: timeOverlap } },
      ],
    }
  } else {
    conflictWhere = {
      resourceId: booking.resourceId,
      id: { not: booking.id },
      status: { in: ["pending", "approved"] },
      OR: timeOverlap,
    }
  }

  const overlapping = await prisma.booking.findMany({
    where: conflictWhere,
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true,
      status: true,
      user: { select: { name: true, email: true } },
      resourcePart: { select: { name: true } },
    },
    orderBy: { startTime: "asc" },
  })

  return NextResponse.json(overlapping)
}
