import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET - Hent alle påmeldinger for innlogget bruker
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Ikke autentisert" }, { status: 401 })
    }
    
    const registrations = await prisma.competitionRegistration.findMany({
      where: {
        userId: session.user.id
      },
      include: {
        competition: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            startDate: true,
            endDate: true,
            venue: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    })
    
    return NextResponse.json(registrations)
  } catch (error) {
    console.error("[My Registrations GET] Error:", error)
    return NextResponse.json(
      { error: "Kunne ikke hente påmeldinger" },
      { status: 500 }
    )
  }
}
