import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const resource = await prisma.resource.findUnique({
    where: { id },
    include: {
      category: true,
      parts: true
    }
  })

  if (!resource || resource.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(resource)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  const resource = await prisma.resource.findUnique({ where: { id } })

  if (!resource || resource.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const updated = await prisma.resource.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
      location: body.location,
      categoryId: body.categoryId,
      isActive: body.isActive,
      minBookingMinutes: body.minBookingMinutes,
      maxBookingMinutes: body.maxBookingMinutes,
      requiresApproval: body.requiresApproval,
      advanceBookingDays: body.advanceBookingDays,
      openingHours: body.openingHours ? JSON.stringify(body.openingHours) : undefined
    }
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const resource = await prisma.resource.findUnique({ where: { id } })

  if (!resource || resource.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.resource.delete({ where: { id } })

  return NextResponse.json({ success: true })
}

