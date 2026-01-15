import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET - List moderators for a resource
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: resourceId } = await params

  const moderators = await prisma.resourceModerator.findMany({
    where: { resourceId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  })

  return NextResponse.json(moderators)
}

// POST - Add a moderator to a resource
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: resourceId } = await params
  const { userId } = await request.json()

  if (!userId) {
    return NextResponse.json({ error: "userId er påkrevd" }, { status: 400 })
  }

  // Verify the resource belongs to this organization
  const resource = await prisma.resource.findFirst({
    where: {
      id: resourceId,
      organizationId: session.user.organizationId
    }
  })

  if (!resource) {
    return NextResponse.json({ error: "Fasilitet ikke funnet" }, { status: 404 })
  }

  // Verify the user belongs to this organization and is a moderator
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId: session.user.organizationId,
      role: "moderator"
    }
  })

  if (!user) {
    return NextResponse.json({ 
      error: "Bruker ikke funnet eller er ikke en moderator" 
    }, { status: 404 })
  }

  // Check if already assigned
  const existing = await prisma.resourceModerator.findUnique({
    where: {
      userId_resourceId: {
        userId,
        resourceId
      }
    }
  })

  if (existing) {
    return NextResponse.json({ 
      error: "Denne moderatoren er allerede tilordnet denne fasiliteten" 
    }, { status: 400 })
  }

  // Create the assignment
  const moderator = await prisma.resourceModerator.create({
    data: {
      userId,
      resourceId
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  })

  return NextResponse.json(moderator, { status: 201 })
}

// DELETE - Remove a moderator from a resource
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: resourceId } = await params
  const { searchParams } = new URL(request.url)
  const moderatorId = searchParams.get("moderatorId")

  if (!moderatorId) {
    return NextResponse.json({ error: "moderatorId er påkrevd" }, { status: 400 })
  }

  // Verify the resource belongs to this organization
  const resource = await prisma.resource.findFirst({
    where: {
      id: resourceId,
      organizationId: session.user.organizationId
    }
  })

  if (!resource) {
    return NextResponse.json({ error: "Fasilitet ikke funnet" }, { status: 404 })
  }

  // Delete the assignment
  await prisma.resourceModerator.delete({
    where: { id: moderatorId }
  })

  return NextResponse.json({ success: true })
}
