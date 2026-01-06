import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isMatchSetupEnabled } from "@/lib/match-setup"
import { canAccessMatchSetup } from "@/lib/roles"

// POST - Nullstill konkurranse (reset alle resultater)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params
    
    if (!session?.user) {
      return NextResponse.json({ error: "Ikke autentisert" }, { status: 401 })
    }
    
    // Sjekk om brukeren har tilgang til kampoppsett
    const hasAccess = await canAccessMatchSetup(session.user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: "Du har ikke tilgang til å nullstille konkurranser" }, { status: 403 })
    }
    
    const enabled = await isMatchSetupEnabled()
    if (!enabled) {
      return NextResponse.json(
        { error: "Kampoppsett-modulen er ikke aktivert" },
        { status: 403 }
      )
    }
    
    // Finn konkurransen
    const competition = await prisma.competition.findFirst({
      where: { id, organizationId: session.user.organizationId }
    })
    
    if (!competition) {
      return NextResponse.json({ error: "Konkurranse ikke funnet" }, { status: 404 })
    }
    
    // For turneringer: Finn første-runde kamper (de som har faktiske lag, ikke placeholders)
    // og nullstill lag-koblinger i senere runder
    if (competition.type === "TOURNAMENT") {
      // Hent alle kamper
      const allMatches = await prisma.match.findMany({
        where: { competitionId: id },
        orderBy: { round: "asc" }
      })
      
      // Finn minste runde (første runde)
      const minRound = Math.min(...allMatches.map(m => m.round || 1))
      
      // For kamper i senere runder: Sett tilbake til placeholder og fjern lag
      for (const match of allMatches) {
        if ((match.round || 1) > minRound) {
          // Rekonstruer placeholder basert på kampnummer
          // Finn hvilke kamper fra forrige runde som fører til denne
          const prevRound = (match.round || 1) - 1
          const prevRoundMatches = allMatches.filter(m => (m.round || 1) === prevRound)
          
          // Finn kamper som burde lede hit (basert på bracket-posisjon)
          const matchIndex = allMatches.filter(m => m.round === match.round).indexOf(match)
          const sourceMatch1 = prevRoundMatches[matchIndex * 2]
          const sourceMatch2 = prevRoundMatches[matchIndex * 2 + 1]
          
          await prisma.match.update({
            where: { id: match.id },
            data: {
              homeTeamId: null,
              awayTeamId: null,
              homeTeamPlaceholder: sourceMatch1 ? `Vinner kamp ${sourceMatch1.matchNumber}` : match.homeTeamPlaceholder,
              awayTeamPlaceholder: sourceMatch2 ? `Vinner kamp ${sourceMatch2.matchNumber}` : match.awayTeamPlaceholder,
              status: "SCHEDULED",
              homeScore: null,
              awayScore: null,
              winnerId: null,
              isDraw: false,
              actualStartTime: null,
              actualEndTime: null,
              notes: null
            }
          })
        } else {
          // Første runde: Bare nullstill resultater, behold lag
          await prisma.match.update({
            where: { id: match.id },
            data: {
              status: "SCHEDULED",
              homeScore: null,
              awayScore: null,
              homeOvertimeScore: null,
              awayOvertimeScore: null,
              homePenaltyScore: null,
              awayPenaltyScore: null,
              winnerId: null,
              isDraw: false,
              actualStartTime: null,
              actualEndTime: null,
              notes: null
            }
          })
        }
      }
    } else {
      // For seriespill: Bare nullstill alle resultater
      await prisma.match.updateMany({
        where: { competitionId: id },
        data: {
          status: "SCHEDULED",
          homeScore: null,
          awayScore: null,
          homeOvertimeScore: null,
          awayOvertimeScore: null,
          homePenaltyScore: null,
          awayPenaltyScore: null,
          winnerId: null,
          isDraw: false,
          actualStartTime: null,
          actualEndTime: null,
          notes: null
        }
      })
    }
    
    // Nullstill all lagstatistikk
    await prisma.competitionTeam.updateMany({
      where: { competitionId: id },
      data: {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0
      }
    })
    
    // Sett konkurransen tilbake til DRAFT status (slik at man kan starte på nytt)
    await prisma.competition.update({
      where: { id },
      data: { status: "DRAFT" }
    })
    
    return NextResponse.json({ 
      success: true, 
      message: "Konkurransen er nullstilt. Alle resultater er fjernet." 
    })
  } catch (error) {
    console.error("[Reset Competition] Error:", error)
    return NextResponse.json(
      { error: "Kunne ikke nullstille konkurransen" },
      { status: 500 }
    )
  }
}

