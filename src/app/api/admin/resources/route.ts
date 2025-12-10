import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const resources = await prisma.resource.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      category: true,
      parts: true,
      _count: {
        select: { bookings: true }
      }
    },
    orderBy: { name: "asc" }
  })

  return NextResponse.json(resources)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const {
    name,
    description,
    location,
    image,
    mapImage,
    color,
    categoryId,
    minBookingMinutes,
    maxBookingMinutes,
    requiresApproval,
    advanceBookingDays,
    blockPartsWhenWholeBooked,
    blockWholeWhenPartBooked,
    showOnPublicCalendar,
    openingHours,
    parts
  } = body

  const resource = await prisma.resource.create({
    data: {
      name,
      description,
      location,
      image,
      mapImage,
      color,
      categoryId,
      blockPartsWhenWholeBooked: blockPartsWhenWholeBooked ?? true,
      blockWholeWhenPartBooked: blockWholeWhenPartBooked ?? true,
      showOnPublicCalendar: showOnPublicCalendar ?? true,
      minBookingMinutes: minBookingMinutes,
      maxBookingMinutes: maxBookingMinutes,
      requiresApproval: requiresApproval ?? true,
      advanceBookingDays: advanceBookingDays || 30,
      openingHours: openingHours ? JSON.stringify(openingHours) : null,
      organizationId: session.user.organizationId,
      parts: parts ? {
        create: parts.map((p: { name: string; description?: string; capacity?: number; mapCoordinates?: string; adminNote?: string }) => ({
          name: p.name,
          description: p.description,
          capacity: p.capacity,
          mapCoordinates: p.mapCoordinates,
          adminNote: p.adminNote || null
        }))
      } : undefined
    },
    include: {
      category: true,
      parts: true
    }
  })

  return NextResponse.json(resource, { status: 201 })
}

