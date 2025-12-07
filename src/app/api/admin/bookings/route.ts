import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")

  const bookings = await prisma.booking.findMany({
    where: {
      organizationId: session.user.organizationId,
      ...(status === "pending" ? { status: "pending" } : {})
    },
    include: {
      resource: true,
      resourcePart: true,
      user: {
        select: { name: true, email: true }
      }
    },
    orderBy: [
      { status: "asc" },
      { startTime: "asc" }
    ]
  })

  return NextResponse.json(bookings)
}

