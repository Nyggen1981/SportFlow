import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const isAdmin = session.user.role === "admin"
  const isModerator = session.user.role === "moderator"

  if (!isAdmin && !isModerator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { bookingIds } = await request.json()

  if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
    return NextResponse.json({ error: "No booking IDs provided" }, { status: 400 })
  }

  // Fetch all bookings to verify ownership, status, and moderator access
  const bookings = await prisma.booking.findMany({
    where: {
      id: { in: bookingIds },
      organizationId: session.user.organizationId
    },
    select: {
      id: true,
      resourceId: true,
      status: true,
      endTime: true,
      title: true
    }
  })

  if (bookings.length === 0) {
    return NextResponse.json({ error: "No valid bookings found" }, { status: 404 })
  }

  // Check that all bookings are deletable (cancelled, rejected, or past)
  const now = new Date()
  const nonDeletableBookings = bookings.filter(b => {
    const isPast = new Date(b.endTime) < now
    const isCancelledOrRejected = b.status === "cancelled" || b.status === "rejected"
    return !isPast && !isCancelledOrRejected
  })

  if (nonDeletableBookings.length > 0) {
    const titles = nonDeletableBookings.slice(0, 3).map(b => b.title).join(", ")
    const moreCount = nonDeletableBookings.length > 3 ? ` og ${nonDeletableBookings.length - 3} til` : ""
    return NextResponse.json({ 
      error: `Kan ikke slette aktive bookinger. Følgende bookinger må først kanselleres eller avslås: ${titles}${moreCount}` 
    }, { status: 400 })
  }

  // If moderator, check they have access to all the resources
  if (isModerator) {
    const resourceIds = [...new Set(bookings.map(b => b.resourceId))]
    
    const moderatorAccess = await prisma.resourceModerator.findMany({
      where: {
        userId: session.user.id,
        resourceId: { in: resourceIds }
      },
      select: { resourceId: true }
    })

    const accessibleResourceIds = new Set(moderatorAccess.map(m => m.resourceId))
    const hasAccessToAll = resourceIds.every(id => accessibleResourceIds.has(id))

    if (!hasAccessToAll) {
      return NextResponse.json({ 
        error: "Du har ikke tilgang til å slette alle de valgte bookingene" 
      }, { status: 403 })
    }
  }

  // Delete the bookings
  const validIds = bookings.map(b => b.id)
  await prisma.booking.deleteMany({
    where: { id: { in: validIds } }
  })

  return NextResponse.json({ 
    success: true,
    deletedCount: validIds.length 
  })
}

