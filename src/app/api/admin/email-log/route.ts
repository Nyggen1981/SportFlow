import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const LIMIT = 30

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const organizationId = session.user.organizationId
  if (!organizationId) {
    return NextResponse.json({ error: "Organization ID missing" }, { status: 400 })
  }

  try {
    const logs = await prisma.emailSendLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      select: {
        id: true,
        toAddress: true,
        subject: true,
        category: true,
        success: true,
        errorMessage: true,
        hasAttachments: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error("[email-log] GET error:", error)
    return NextResponse.json(
      { error: "Kunne ikke hente e-postlogg" },
      { status: 500 }
    )
  }
}
