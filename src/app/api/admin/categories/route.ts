import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Use raw query to ensure isActive is included even if Prisma client isn't regenerated
  const categories = await prisma.$queryRaw`
    SELECT 
      rc.id, 
      rc.name, 
      rc.description, 
      rc.icon, 
      rc.color, 
      COALESCE(rc."isActive", true) as "isActive",
      (SELECT COUNT(*) FROM "Resource" r WHERE r."categoryId" = rc.id)::int as "_resourceCount"
    FROM "ResourceCategory" rc
    ORDER BY rc.name ASC
  ` as Array<{
    id: string
    name: string
    description: string | null
    icon: string | null
    color: string
    isActive: boolean
    _resourceCount: number
  }>

  // Transform to match expected format with _count
  const transformedCategories = categories.map(cat => ({
    id: cat.id,
    name: cat.name,
    description: cat.description,
    icon: cat.icon,
    color: cat.color,
    isActive: cat.isActive,
    _count: {
      resources: cat._resourceCount
    }
  }))

  return NextResponse.json(transformedCategories)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { name, description, icon, color } = await request.json()

  const category = await prisma.resourceCategory.create({
    data: {
      name,
      description,
      icon,
      color: color || "#3b82f6"
    }
  })

  return NextResponse.json(category, { status: 201 })
}

