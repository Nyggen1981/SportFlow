import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isMatchSetupEnabled, calculateTeamStats } from "@/lib/match-setup"
import { canAccessMatchSetup } from "@/lib/roles"

// GET - Hent alle kamper i en konkurranse
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params
    
    if (!session?.user) {
      return NextResponse.json({ error: "Ikke autentisert" }, { status: 401 })
    }
    
    const enabled = await isMatchSetupEnabled()
    if (!enabled) {
      return NextResponse.json(
        { error: "Kampoppsett-modulen er ikke aktivert" },
        { status: 403 }
      )
    }
    
    const competition = await prisma.competition.findFirst({
      where: { id, organizationId: session.user.organizationId }
    })
    
    if (!competition) {
      return NextResponse.json({ error: "Konkurranse ikke funnet" }, { status: 404 })
    }
    
    const matches = await prisma.match.findMany({
      where: { competitionId: id },
      include: {
        homeTeam: { select: { id: true, name: true, shortName: true, color: true } },
        awayTeam: { select: { id: true, name: true, shortName: true, color: true } },
        winner: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } }
      },
      orderBy: [{ round: "asc" }, { scheduledTime: "asc" }, { matchNumber: "asc" }]
    })
    
    return NextResponse.json(matches)
  } catch (error) {
    console.error("[Matches GET] Error:", error)
    return NextResponse.json(
      { error: "Kunne ikke hente kamper" },
      { status: 500 }
    )
  }
}

// PATCH - Oppdater kampresultat
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id: competitionId } = await params
    
    if (!session?.user) {
      return NextResponse.json({ error: "Ikke autentisert" }, { status: 401 })
    }
    
    // Sjekk om brukeren har tilgang til kampoppsett
    const hasAccess = await canAccessMatchSetup(session.user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: "Du har ikke tilgang til å oppdatere kamper" }, { status: 403 })
    }
    
    const enabled = await isMatchSetupEnabled()
    if (!enabled) {
      return NextResponse.json(
        { error: "Kampoppsett-modulen er ikke aktivert" },
        { status: 403 }
      )
    }
    
    const body = await request.json()
    const { matchId, homeScore, awayScore, status, homeOvertimeScore, awayOvertimeScore, homePenaltyScore, awayPenaltyScore, notes } = body
    
    if (!matchId) {
      return NextResponse.json({ error: "matchId er påkrevd" }, { status: 400 })
    }
    
    // Sjekk om konkurransen har startet
    const competition = await prisma.competition.findFirst({
      where: { id: competitionId, organizationId: session.user.organizationId }
    })
    
    if (!competition) {
      return NextResponse.json({ error: "Konkurranse ikke funnet" }, { status: 404 })
    }
    
    if (competition.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Resultater kan kun registreres når konkurransen er aktiv" },
        { status: 400 }
      )
    }
    
    // Finn kampen
    const match = await prisma.match.findFirst({
      where: { id: matchId, competitionId },
      include: {
        competition: true,
        homeTeam: true,
        awayTeam: true
      }
    })
    
    if (!match) {
      return NextResponse.json({ error: "Kamp ikke funnet" }, { status: 404 })
    }
    
    // Beregn vinner
    let winnerId: string | null = null
    let isDraw = false
    
    if (homeScore !== undefined && awayScore !== undefined && homeScore !== null && awayScore !== null) {
      let homeTotal = homeScore
      let awayTotal = awayScore
      
      // Legg til overtid
      if (homeOvertimeScore !== undefined && awayOvertimeScore !== undefined) {
        homeTotal += homeOvertimeScore
        awayTotal += awayOvertimeScore
      }
      
      // Sjekk straffespark
      if (homePenaltyScore !== undefined && awayPenaltyScore !== undefined) {
        if (homePenaltyScore > awayPenaltyScore) {
          winnerId = match.homeTeamId
        } else if (awayPenaltyScore > homePenaltyScore) {
          winnerId = match.awayTeamId
        }
      } else if (homeTotal > awayTotal) {
        winnerId = match.homeTeamId
      } else if (awayTotal > homeTotal) {
        winnerId = match.awayTeamId
      } else {
        isDraw = true
      }
    }
    
    // Oppdater kampen
    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: {
        ...(homeScore !== undefined && { homeScore }),
        ...(awayScore !== undefined && { awayScore }),
        ...(status && { status }),
        ...(homeOvertimeScore !== undefined && { homeOvertimeScore }),
        ...(awayOvertimeScore !== undefined && { awayOvertimeScore }),
        ...(homePenaltyScore !== undefined && { homePenaltyScore }),
        ...(awayPenaltyScore !== undefined && { awayPenaltyScore }),
        ...(notes !== undefined && { notes }),
        winnerId,
        isDraw,
        ...(status === "COMPLETED" && { actualEndTime: new Date() }),
        ...(status === "LIVE" && !match.actualStartTime && { actualStartTime: new Date() })
      }
    })
    
    // Oppdater lagstatistikk hvis kampen er fullført
    if (status === "COMPLETED" && match.homeTeam && match.awayTeam && homeScore !== undefined && awayScore !== undefined) {
      const competition = match.competition
      
      // Oppdater hjemmelag
      const homeStats = calculateTeamStats(
        {
          played: match.homeTeam.played,
          wins: match.homeTeam.wins,
          draws: match.homeTeam.draws,
          losses: match.homeTeam.losses,
          goalsFor: match.homeTeam.goalsFor,
          goalsAgainst: match.homeTeam.goalsAgainst,
          goalDifference: match.homeTeam.goalDifference,
          points: match.homeTeam.points
        },
        homeScore,
        awayScore,
        competition.pointsForWin,
        competition.pointsForDraw,
        competition.pointsForLoss
      )
      
      await prisma.competitionTeam.update({
        where: { id: match.homeTeamId! },
        data: homeStats
      })
      
      // Oppdater bortelag
      const awayStats = calculateTeamStats(
        {
          played: match.awayTeam.played,
          wins: match.awayTeam.wins,
          draws: match.awayTeam.draws,
          losses: match.awayTeam.losses,
          goalsFor: match.awayTeam.goalsFor,
          goalsAgainst: match.awayTeam.goalsAgainst,
          goalDifference: match.awayTeam.goalDifference,
          points: match.awayTeam.points
        },
        awayScore,
        homeScore,
        competition.pointsForWin,
        competition.pointsForDraw,
        competition.pointsForLoss
      )
      
      await prisma.competitionTeam.update({
        where: { id: match.awayTeamId! },
        data: awayStats
      })
    }
    
    // For turneringer: Oppdater neste rundes kamp med vinneren
    if (status === "COMPLETED" && winnerId && match.competition.type === "TOURNAMENT") {
      // Finn kamper i neste runde som har placeholder som refererer til denne kampen
      const nextRoundMatches = await prisma.match.findMany({
        where: {
          competitionId,
          round: (match.round || 1) + 1,
          OR: [
            { homeTeamPlaceholder: { contains: `kamp ${match.matchNumber}` } },
            { awayTeamPlaceholder: { contains: `kamp ${match.matchNumber}` } }
          ]
        }
      })
      
      for (const nextMatch of nextRoundMatches) {
        const isHomeSlot = nextMatch.homeTeamPlaceholder?.toLowerCase().includes(`kamp ${match.matchNumber}`)
        const isAwaySlot = nextMatch.awayTeamPlaceholder?.toLowerCase().includes(`kamp ${match.matchNumber}`)
        
        if (isHomeSlot) {
          await prisma.match.update({
            where: { id: nextMatch.id },
            data: { 
              homeTeamId: winnerId,
              homeTeamPlaceholder: null
            }
          })
        } else if (isAwaySlot) {
          await prisma.match.update({
            where: { id: nextMatch.id },
            data: { 
              awayTeamId: winnerId,
              awayTeamPlaceholder: null
            }
          })
        }
      }
    }
    
    return NextResponse.json(updatedMatch)
  } catch (error) {
    console.error("[Matches PATCH] Error:", error)
    return NextResponse.json(
      { error: "Kunne ikke oppdatere kamp" },
      { status: 500 }
    )
  }
}

