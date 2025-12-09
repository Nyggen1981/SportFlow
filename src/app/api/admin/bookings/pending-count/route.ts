import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ count: 0 })
  }

  const count = await prisma.booking.count({
    where: {
      status: "pending",
      resource: {
        organizationId: session.user.organizationId
      }
    }
  })

  return NextResponse.json({ count })
}

