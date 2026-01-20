import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isMatchSetupEnabled } from "@/lib/match-setup"

export const dynamic = 'force-dynamic'

// GET - Hent en konkurranse for offentlig visning (tilgjengelig for alle, inkl. ikke-innloggede)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Sjekk om modulen er aktivert
    const moduleEnabled = await isMatchSetupEnabled()
    if (!moduleEnabled) {
      return NextResponse.json({ error: "Modul ikke aktivert" }, { status: 403 })
    }

    const { id } = await params
    const session = await getServerSession(authOptions)

    // Hent organisasjons-ID fra session eller bruk standard-organisasjon
    let organizationId = session?.user?.organizationId

    // Hvis ikke innlogget, hent første (eneste) organisasjon
    if (!organizationId) {
      const org = await prisma.organization.findFirst()
      organizationId = org?.id
    }

    if (!organizationId) {
      return NextResponse.json({ error: "Ingen organisasjon funnet" }, { status: 404 })
    }

    const competition = await prisma.competition.findFirst({
      where: {
        id,
        organizationId,
        // For ikke-innloggede: vis kun ACTIVE og COMPLETED
        status: session?.user 
          ? { not: "CANCELLED" }
          : { in: ["ACTIVE", "COMPLETED"] }
      },
      include: {
        teams: {
          orderBy: [
            { points: "desc" },
            { goalDifference: "desc" },
            { goalsFor: "desc" }
          ]
        },
        matches: {
          include: {
            homeTeam: true,
            awayTeam: true,
            winner: true
          },
          orderBy: [
            { round: "asc" },
            { matchNumber: "asc" }
          ]
        },
        _count: {
          select: {
            registrations: true
          }
        }
      }
    })

    if (!competition) {
      return NextResponse.json(
        { error: "Konkurranse ikke funnet" },
        { status: 404 }
      )
    }

    return NextResponse.json(competition)
  } catch (error) {
    console.error("[MatchSetup] Error fetching public competition:", error)
    return NextResponse.json(
      { error: "Kunne ikke hente konkurranse" },
      { status: 500 }
    )
  }
}

