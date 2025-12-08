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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  const resource = await prisma.resource.findUnique({ 
    where: { id },
    include: { parts: true }
  })

  if (!resource || resource.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Update resource
  const updated = await prisma.resource.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
      location: body.location,
      image: body.image,
      mapImage: body.mapImage,
      color: body.color,
      categoryId: body.categoryId,
      minBookingMinutes: body.minBookingMinutes,
      maxBookingMinutes: body.maxBookingMinutes,
      requiresApproval: body.requiresApproval,
      advanceBookingDays: body.advanceBookingDays,
      blockPartsWhenWholeBooked: body.blockPartsWhenWholeBooked ?? true,
      blockWholeWhenPartBooked: body.blockWholeWhenPartBooked ?? true,
      showOnPublicCalendar: body.showOnPublicCalendar ?? true
    }
  })

  // Handle parts
  if (body.parts) {
    const existingPartIds = resource.parts.map(p => p.id)
    const newPartIds = body.parts.filter((p: { id?: string }) => p.id).map((p: { id: string }) => p.id)
    
    // Delete removed parts
    const partsToDelete = existingPartIds.filter(id => !newPartIds.includes(id))
    if (partsToDelete.length > 0) {
      await prisma.resourcePart.deleteMany({
        where: { id: { in: partsToDelete } }
      })
    }

    // Update or create parts
    for (const part of body.parts) {
      if (part.id) {
        await prisma.resourcePart.update({
          where: { id: part.id },
          data: {
            name: part.name,
            description: part.description,
            capacity: part.capacity,
            mapCoordinates: part.mapCoordinates
          }
        })
      } else {
        await prisma.resourcePart.create({
          data: {
            name: part.name,
            description: part.description,
            capacity: part.capacity,
            mapCoordinates: part.mapCoordinates,
            resourceId: id
          }
        })
      }
    }
  }

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

