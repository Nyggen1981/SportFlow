import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isMatchSetupEnabled } from "@/lib/match-setup"

export const dynamic = 'force-dynamic'

// GET - Hent en konkurranse for offentlig visning (read-only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 })
    }

    // Sjekk om modulen er aktivert
    const moduleEnabled = await isMatchSetupEnabled()
    if (!moduleEnabled) {
      return NextResponse.json({ error: "Modul ikke aktivert" }, { status: 403 })
    }

    const { id } = await params

    const competition = await prisma.competition.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
        status: {
          not: "CANCELLED"
        }
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

