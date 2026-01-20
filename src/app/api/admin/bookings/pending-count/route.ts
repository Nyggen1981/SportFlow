import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ count: 0 })
  }

  const isAdmin = session.user.role === "admin"
  const isModerator = session.user.role === "moderator"

  if (!isAdmin && !isModerator) {
    return NextResponse.json({ count: 0 })
  }

  // Get moderator's assigned resources
  let resourceIds: string[] | undefined
  if (isModerator) {
    const moderatorResources = await prisma.resourceModerator.findMany({
      where: { userId: session.user.id },
      select: { resourceId: true }
    })
    resourceIds = moderatorResources.map(mr => mr.resourceId)
    if (resourceIds.length === 0) {
      return NextResponse.json({ count: 0 })
    }
  }

  const count = await prisma.booking.count({
    where: {
      status: "pending",
      organizationId: session.user.organizationId,
      // Only show future bookings (not past)
      endTime: { gte: new Date() },
      ...(isModerator && resourceIds ? { resourceId: { in: resourceIds } } : {})
    }
  })

  return NextResponse.json({ count })
}





