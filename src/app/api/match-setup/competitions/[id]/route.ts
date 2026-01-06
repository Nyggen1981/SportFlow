import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isMatchSetupEnabled } from "@/lib/match-setup"
import { canAccessMatchSetup } from "@/lib/roles"

// GET - Hent enkelt konkurranse med detaljer
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
      where: {
        id,
        organizationId: session.user.organizationId
      },
      include: {
        teams: {
          orderBy: [{ points: "desc" }, { goalDifference: "desc" }, { goalsFor: "desc" }]
        },
        matches: {
          include: {
            homeTeam: { select: { id: true, name: true, shortName: true, color: true } },
            awayTeam: { select: { id: true, name: true, shortName: true, color: true } },
            winner: { select: { id: true, name: true } },
            group: { select: { id: true, name: true } }
          },
          orderBy: [{ round: "asc" }, { matchNumber: "asc" }]
        },
        groups: {
          include: {
            teams: {
              orderBy: [{ points: "desc" }, { goalDifference: "desc" }, { goalsFor: "desc" }]
            }
          },
          orderBy: { sortOrder: "asc" }
        }
      }
    })
    
    if (!competition) {
      return NextResponse.json({ error: "Konkurranse ikke funnet" }, { status: 404 })
    }
    
    return NextResponse.json(competition)
  } catch (error) {
    console.error("[Competition GET] Error:", error)
    return NextResponse.json(
      { error: "Kunne ikke hente konkurranse" },
      { status: 500 }
    )
  }
}

// PATCH - Oppdater konkurranse
export async function PATCH(
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
      return NextResponse.json({ error: "Du har ikke tilgang til å oppdatere konkurranser" }, { status: 403 })
    }
    
    const enabled = await isMatchSetupEnabled()
    if (!enabled) {
      return NextResponse.json(
        { error: "Kampoppsett-modulen er ikke aktivert" },
        { status: 403 }
      )
    }
    
    const body = await request.json()
    
    // Finn eksisterende konkurranse
    const existing = await prisma.competition.findFirst({
      where: { id, organizationId: session.user.organizationId }
    })
    
    if (!existing) {
      return NextResponse.json({ error: "Konkurranse ikke funnet" }, { status: 404 })
    }
    
    // Sjekk om innstillinger kan endres
    // Status-endringer er alltid tillatt, men andre endringer blokkeres etter start
    const isStatusChangeOnly = Object.keys(body).length === 1 && body.status !== undefined
    const isCompetitionStarted = existing.status === "ACTIVE" || existing.status === "COMPLETED"
    
    if (isCompetitionStarted && !isStatusChangeOnly) {
      return NextResponse.json(
        { error: "Innstillinger kan ikke endres etter at konkurransen har startet. Nullstill først." },
        { status: 400 }
      )
    }
    
    const competition = await prisma.competition.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.status && { status: body.status }),
        ...(body.venue !== undefined && { venue: body.venue }),
        ...(body.resourceId !== undefined && { resourceId: body.resourceId }),
        ...(body.startDate && { startDate: new Date(body.startDate) }),
        ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
        ...(body.dailyStartTime !== undefined && { dailyStartTime: body.dailyStartTime }),
        ...(body.dailyEndTime !== undefined && { dailyEndTime: body.dailyEndTime }),
        ...(body.pointsForWin !== undefined && { pointsForWin: body.pointsForWin }),
        ...(body.pointsForDraw !== undefined && { pointsForDraw: body.pointsForDraw }),
        ...(body.pointsForLoss !== undefined && { pointsForLoss: body.pointsForLoss }),
        ...(body.hasOvertime !== undefined && { hasOvertime: body.hasOvertime }),
        ...(body.overtimeMinutes !== undefined && { overtimeMinutes: body.overtimeMinutes }),
        ...(body.hasPenalties !== undefined && { hasPenalties: body.hasPenalties }),
        ...(body.matchDuration !== undefined && { matchDuration: body.matchDuration }),
        ...(body.breakDuration !== undefined && { breakDuration: body.breakDuration }),
        ...(body.matchesPerDay !== undefined && { matchesPerDay: body.matchesPerDay }),
        ...(body.thirdPlaceMatch !== undefined && { thirdPlaceMatch: body.thirdPlaceMatch })
      }
    })
    
    return NextResponse.json(competition)
  } catch (error) {
    console.error("[Competition PATCH] Error:", error)
    return NextResponse.json(
      { error: "Kunne ikke oppdatere konkurranse" },
      { status: 500 }
    )
  }
}

// DELETE - Slett konkurranse
export async function DELETE(
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
      return NextResponse.json({ error: "Du har ikke tilgang til å slette konkurranser" }, { status: 403 })
    }
    
    const enabled = await isMatchSetupEnabled()
    if (!enabled) {
      return NextResponse.json(
        { error: "Kampoppsett-modulen er ikke aktivert" },
        { status: 403 }
      )
    }
    
    // Finn eksisterende konkurranse
    const existing = await prisma.competition.findFirst({
      where: { id, organizationId: session.user.organizationId }
    })
    
    if (!existing) {
      return NextResponse.json({ error: "Konkurranse ikke funnet" }, { status: 404 })
    }
    
    // Slett (cascade sletter teams, matches, groups)
    await prisma.competition.delete({ where: { id } })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Competition DELETE] Error:", error)
    return NextResponse.json(
      { error: "Kunne ikke slette konkurranse" },
      { status: 500 }
    )
  }
}

