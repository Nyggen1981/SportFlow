import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { canCreateResource } from "@/lib/license"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const resources = await prisma.resource.findMany({
      where: { organizationId: session.user.organizationId },
      select: {
        id: true,
        name: true,
        description: true,
        location: true,
        image: true,
        mapImage: true,
        color: true,
        isActive: true,
        showOnPublicCalendar: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        parts: {
          select: {
            id: true,
            name: true,
            description: true,
            capacity: true,
            mapCoordinates: true,
            adminNote: true,
            parentId: true
          },
          orderBy: { name: "asc" }
        },
        _count: {
          select: { bookings: true }
        }
      },
      orderBy: { name: "asc" }
    })

    return NextResponse.json(resources)
  } catch (error: any) {
    console.error("Error fetching resources:", error)
    return NextResponse.json(
      { 
        error: "Kunne ikke laste fasiliteter",
        details: error?.message || "Unknown error",
        code: error?.code || "UNKNOWN"
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Sjekk lisensgrenser for ressursantall
  const licenseCheck = await canCreateResource()
  if (!licenseCheck.allowed) {
    return NextResponse.json(
      { error: licenseCheck.message || "Kan ikke opprette flere ressurser med gjeldende lisens" },
      { status: 403 }
    )
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

