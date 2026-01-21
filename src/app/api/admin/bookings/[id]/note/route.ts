import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET admin note for a booking
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const isAdmin = session.user.role === "admin"
  const isModerator = session.user.role === "moderator"

  if (!isAdmin && !isModerator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Fetch admin note using raw SQL
  const result = await prisma.$queryRaw<{ adminNote: string | null }[]>`
    SELECT "adminNote" FROM "Booking" WHERE id = ${id} AND "organizationId" = ${session.user.organizationId}
  `

  if (!result || result.length === 0) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  return NextResponse.json({ adminNote: result[0].adminNote })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const isAdmin = session.user.role === "admin"
  const isModerator = session.user.role === "moderator"

  if (!isAdmin && !isModerator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { adminNote } = await request.json()

  // Verify booking belongs to organization
  const booking = await prisma.booking.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId
    }
  })

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  // Update admin note using raw SQL to avoid Prisma client type issues
  await prisma.$executeRaw`UPDATE "Booking" SET "adminNote" = ${adminNote || null} WHERE id = ${id}`

  return NextResponse.json({ success: true })
}
