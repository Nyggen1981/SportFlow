import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { name, description, color, isActive } = await request.json()

  const category = await prisma.resourceCategory.update({
    where: { id },
    data: {
      name,
      description,
      color,
      ...(typeof isActive === 'boolean' ? { isActive } : {})
    }
  })

  return NextResponse.json(category)
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

  // Check if category has resources
  const resourceCount = await prisma.resource.count({
    where: { categoryId: id }
  })

  if (resourceCount > 0) {
    return NextResponse.json(
      { error: "Kan ikke slette kategori med fasiliteter" },
      { status: 400 }
    )
  }

  await prisma.resourceCategory.delete({ where: { id } })

  return NextResponse.json({ success: true })
}

