import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const categories = await prisma.resourceCategory.findMany({
    include: {
      _count: {
        select: { resources: true }
      }
    },
    orderBy: { name: "asc" }
  })

  return NextResponse.json(categories)
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

