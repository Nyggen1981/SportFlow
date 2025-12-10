import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId }
  })

  return NextResponse.json(org)
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { 
    name, 
    slug, 
    logo, 
    tagline, 
    primaryColor, 
    secondaryColor,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpFrom
  } = await request.json()

  // Check if slug is already taken by another org
  if (slug) {
    const existing = await prisma.organization.findFirst({
      where: {
        slug,
        NOT: { id: session.user.organizationId }
      }
    })
    if (existing) {
      return NextResponse.json({ error: "Denne klubbkoden er allerede i bruk" }, { status: 400 })
    }
  }

  const updated = await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: {
      name,
      slug,
      logo,
      tagline,
      primaryColor,
      secondaryColor,
      smtpHost: smtpHost || null,
      smtpPort: smtpPort ? parseInt(smtpPort) : null,
      smtpUser: smtpUser || null,
      smtpPass: smtpPass || null, // Note: In production, consider encrypting this
      smtpFrom: smtpFrom || null,
    }
  })

  return NextResponse.json(updated)
}

