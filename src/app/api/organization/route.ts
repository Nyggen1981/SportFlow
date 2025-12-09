import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

// Cache for 5 minutes
export const revalidate = 300

export async function GET() {
  try {
    const org = await prisma.organization.findFirst({
      select: {
        id: true,
        name: true,
        logo: true,
        tagline: true,
        primaryColor: true,
      }
    })

    // Add cache headers
    return NextResponse.json(org, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      }
    })
  } catch {
    return NextResponse.json(null)
  }
}

