import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { 
  isMatchSetupEnabled, 
  generateLeagueSchedule, 
  generateTournamentBracket,
  generateGroupStageSchedule
} from "@/lib/match-setup"
import { canAccessMatchSetup } from "@/lib/roles"

// POST - Generer kampoppsett automatisk
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
      return NextResponse.json({ error: "Du har ikke tilgang til å generere kampoppsett" }, { status: 403 })
    }
    
    const enabled = await isMatchSetupEnabled()
    if (!enabled) {
      return NextResponse.json(
        { error: "Kampoppsett-modulen er ikke aktivert" },
        { status: 403 }
      )
    }
    
    const body = await request.json()
    const { venues = ["Bane 1"] } = body
    
    // Hent konkurranse med lag
    const competition = await prisma.competition.findFirst({
      where: { id, organizationId: session.user.organizationId },
      include: {
        teams: { orderBy: { seed: "asc" } },
        groups: { 
          include: { 
            teams: { orderBy: { seed: "asc" } }
          },
          orderBy: { sortOrder: "asc" }
        }
      }
    })
    
    if (!competition) {
      return NextResponse.json({ error: "Konkurranse ikke funnet" }, { status: 404 })
    }
    
    if (competition.teams.length < 2) {
      return NextResponse.json(
        { error: "Minst 2 lag kreves for å generere kampoppsett" },
        { status: 400 }
      )
    }
    
    // Blokkér regenerering etter at konkurransen har startet (ACTIVE/COMPLETED)
    if (competition.status === "ACTIVE" || competition.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Kan ikke regenerere kamper etter at konkurransen har startet. Nullstill først." },
        { status: 400 }
      )
    }
    
    // Slett alltid eksisterende kamper før regenerering (for DRAFT og SCHEDULED)
    await prisma.match.deleteMany({ where: { competitionId: id } })
    
    let scheduledMatches: Array<{
      matchNumber: number
      round: number
      roundName?: string
      homeTeamId: string | null
      awayTeamId: string | null
      homeTeamPlaceholder?: string | null
      awayTeamPlaceholder?: string | null
      scheduledTime: Date
      venue?: string
      groupId?: string
      isBye?: boolean
    }> = []
    
    // Generer basert på konkurransetype
    if (competition.type === "LEAGUE") {
      // Seriespill - alle mot alle
      const teamIds = competition.teams.map(t => t.id)
      scheduledMatches = generateLeagueSchedule(
        teamIds,
        competition.startDate,
        competition.matchDuration,
        competition.breakDuration,
        competition.matchesPerDay || 10,
        venues
      )
    } else if (competition.type === "TOURNAMENT") {
      if (competition.hasGroups && competition.groups.length > 0) {
        // Turnering med gruppespill
        const groupsWithTeams = competition.groups.map(g => ({
          id: g.id,
          teamIds: g.teams.map(t => t.id)
        }))
        
        scheduledMatches = generateGroupStageSchedule(
          groupsWithTeams,
          competition.startDate,
          competition.matchDuration,
          competition.breakDuration,
          competition.matchesPerDay || 10
        )
        
        // TODO: Legg til sluttspillkamper etter gruppespill
      } else {
        // Ren sluttspill-turnering
        const teamIds = competition.teams.map(t => t.id)
        scheduledMatches = generateTournamentBracket(
          teamIds,
          competition.startDate,
          competition.matchDuration,
          competition.breakDuration,
          competition.thirdPlaceMatch
        )
      }
    }
    
    // Filtrer ut BYE-kamper og opprett i databasen
    const matchesToCreate = scheduledMatches
      .filter(m => !m.isBye)
      .map(m => ({
        matchNumber: m.matchNumber,
        round: m.round,
        roundName: m.roundName || null,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        homeTeamPlaceholder: m.homeTeamPlaceholder || null,
        awayTeamPlaceholder: m.awayTeamPlaceholder || null,
        scheduledTime: m.scheduledTime,
        venue: m.venue || null,
        groupId: m.groupId || null,
        competitionId: id,
        status: "SCHEDULED" as const
      }))
    
    // Opprett alle kamper
    await prisma.match.createMany({
      data: matchesToCreate
    })
    
    // Oppdater konkurranse-status
    await prisma.competition.update({
      where: { id },
      data: { status: "SCHEDULED" }
    })
    
    // Hent de opprettede kampene
    const createdMatches = await prisma.match.findMany({
      where: { competitionId: id },
      include: {
        homeTeam: { select: { id: true, name: true, shortName: true, color: true } },
        awayTeam: { select: { id: true, name: true, shortName: true, color: true } }
      },
      orderBy: [{ round: "asc" }, { matchNumber: "asc" }]
    })
    
    return NextResponse.json({
      success: true,
      matchCount: createdMatches.length,
      matches: createdMatches
    })
  } catch (error) {
    console.error("[Generate Matches] Error:", error)
    return NextResponse.json(
      { error: "Kunne ikke generere kampoppsett" },
      { status: 500 }
    )
  }
}

