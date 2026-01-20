import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isMatchSetupEnabled } from "@/lib/match-setup"
import { canAccessMatchSetup } from "@/lib/roles"

// GET - Hent alle påmeldinger for en konkurranse (admin)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Ikke autentisert" }, { status: 401 })
    }
    
    // Sjekk om brukeren har tilgang til kampoppsett
    const hasAccess = await canAccessMatchSetup(session.user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: "Ingen tilgang" }, { status: 403 })
    }
    
    // Sjekk om modulen er aktivert
    const enabled = await isMatchSetupEnabled()
    if (!enabled) {
      return NextResponse.json(
        { error: "Kampoppsett-modulen er ikke aktivert" },
        { status: 403 }
      )
    }
    
    const { id: competitionId } = await params
    
    // Verifiser at konkurransen tilhører brukerens organisasjon
    const competition = await prisma.competition.findFirst({
      where: {
        id: competitionId,
        organizationId: session.user.organizationId
      }
    })
    
    if (!competition) {
      return NextResponse.json(
        { error: "Konkurranse ikke funnet" },
        { status: 404 }
      )
    }
    
    const registrations = await prisma.competitionRegistration.findMany({
      where: {
        competitionId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: [
        { status: "asc" }, // pending først
        { createdAt: "desc" }
      ]
    })
    
    return NextResponse.json(registrations)
  } catch (error) {
    console.error("[Competition Registrations GET] Error:", error)
    return NextResponse.json(
      { error: "Kunne ikke hente påmeldinger" },
      { status: 500 }
    )
  }
}
