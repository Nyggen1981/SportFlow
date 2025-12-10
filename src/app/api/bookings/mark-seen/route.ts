import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// POST - Mark bookings as seen by the user
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { type } = body // "all", "upcoming", "history", or specific booking id

  const now = new Date()

  if (type === "all") {
    // Mark all unread bookings as seen
    await prisma.booking.updateMany({
      where: {
        userId: session.user.id,
        userSeenAt: null,
        status: { in: ["approved", "rejected"] }
      },
      data: {
        userSeenAt: now
      }
    })
  } else if (type === "upcoming") {
    // Mark upcoming approved bookings as seen
    await prisma.booking.updateMany({
      where: {
        userId: session.user.id,
        status: "approved",
        userSeenAt: null,
        startTime: { gte: now }
      },
      data: {
        userSeenAt: now
      }
    })
  } else if (type === "history") {
    // Mark rejected bookings as seen
    await prisma.booking.updateMany({
      where: {
        userId: session.user.id,
        status: "rejected",
        userSeenAt: null
      },
      data: {
        userSeenAt: now
      }
    })
  } else if (type) {
    // Mark specific booking as seen
    await prisma.booking.updateMany({
      where: {
        id: type,
        userId: session.user.id,
        userSeenAt: null
      },
      data: {
        userSeenAt: now
      }
    })
  }

  return NextResponse.json({ success: true })
}

