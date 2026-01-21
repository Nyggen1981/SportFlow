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

  // Fetch admin note using type assertion to bypass Prisma client type checking
  try {
    const booking = await (prisma.booking.findFirst as any)({
      where: {
        id,
        organizationId: session.user.organizationId
      },
      select: { adminNote: true }
    })

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    return NextResponse.json({ adminNote: booking.adminNote || null })
  } catch (error) {
    console.error("Failed to fetch admin note:", error)
    return NextResponse.json({ adminNote: null })
  }
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

  // Update admin note - use type assertion to bypass Prisma client type checking
  try {
    await (prisma.booking.update as any)({
      where: { id },
      data: { adminNote: adminNote || null }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update admin note:", error)
    return NextResponse.json({ error: "Failed to save note", details: String(error) }, { status: 500 })
  }
}
