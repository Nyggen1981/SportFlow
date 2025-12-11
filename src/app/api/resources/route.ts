import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const resources = await prisma.resource.findMany({
      where: {
        isActive: true,
      },
      include: {
        category: true,
        parts: {
          where: {
            isActive: true,
          },
          orderBy: {
            name: 'asc',
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json(resources)
  } catch (error) {
    console.error("Error fetching resources:", error)
    return NextResponse.json(
      { error: "Kunne ikke hente fasiliteter" },
      { status: 500 }
    )
  }
}

