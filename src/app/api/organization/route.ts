import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

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

    return NextResponse.json(org)
  } catch {
    return NextResponse.json(null)
  }
}

