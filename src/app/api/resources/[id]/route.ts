import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const resource = await prisma.resource.findUnique({
    where: { id },
    include: {
      category: true,
      parts: true
    }
  })

  if (!resource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 })
  }

  return NextResponse.json(resource)
}

