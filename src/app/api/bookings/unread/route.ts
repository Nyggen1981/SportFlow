import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET unread booking counts for the current user
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()

  // Get counts of unread bookings (status changed but user hasn't seen it)
  // Approved bookings the user hasn't seen
  const unreadApproved = await prisma.booking.count({
    where: {
      userId: session.user.id,
      status: "approved",
      userSeenAt: null,
      startTime: { gte: now } // Only upcoming bookings
    }
  })

  // Rejected bookings the user hasn't seen
  const unreadRejected = await prisma.booking.count({
    where: {
      userId: session.user.id,
      status: "rejected",
      userSeenAt: null
    }
  })

  // Total unread
  const total = unreadApproved + unreadRejected

  return NextResponse.json({
    total,
    upcoming: unreadApproved, // For "Kommende" tab
    history: unreadRejected   // For "Historikk" tab
  })
}

