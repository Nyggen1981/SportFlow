import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isMatchSetupEnabled } from "@/lib/match-setup"

// GET - Hent alle konkurranser for organisasjonen
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Ikke autentisert" }, { status: 401 })
    }
    
    // Sjekk om modulen er aktivert
    const enabled = await isMatchSetupEnabled()
    if (!enabled) {
      return NextResponse.json(
        { error: "Kampoppsett-modulen er ikke aktivert" },
        { status: 403 }
      )
    }
    
    const competitions = await prisma.competition.findMany({
      where: {
        organizationId: session.user.organizationId
      },
      include: {
        _count: {
          select: {
            teams: true,
            matches: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    })
    
    return NextResponse.json(competitions)
  } catch (error) {
    console.error("[Competitions GET] Error:", error)
    return NextResponse.json(
      { error: "Kunne ikke hente konkurranser" },
      { status: 500 }
    )
  }
}

// POST - Opprett ny konkurranse
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Ikke autentisert" }, { status: 401 })
    }
    
    // Kun admin kan opprette konkurranser
    const isAdmin = session.user.systemRole === "admin" || session.user.role === "admin"
    if (!isAdmin) {
      return NextResponse.json({ error: "Kun admin kan opprette konkurranser" }, { status: 403 })
    }
    
    // Sjekk om modulen er aktivert
    const enabled = await isMatchSetupEnabled()
    if (!enabled) {
      return NextResponse.json(
        { error: "Kampoppsett-modulen er ikke aktivert" },
        { status: 403 }
      )
    }
    
    const body = await request.json()
    
    const {
      name,
      description,
      type,
      startDate,
      endDate,
      venue,
      pointsForWin = 3,
      pointsForDraw = 1,
      pointsForLoss = 0,
      hasOvertime = false,
      overtimeMinutes,
      hasPenalties = false,
      matchDuration = 60,
      breakDuration = 15,
      matchesPerDay,
      hasGroups = false,
      groupCount,
      teamsPerGroup,
      advancePerGroup,
      playoffRounds,
      thirdPlaceMatch = false,
      resourceId
    } = body
    
    if (!name || !type || !startDate) {
      return NextResponse.json(
        { error: "Navn, type og startdato er påkrevd" },
        { status: 400 }
      )
    }
    
    const competition = await prisma.competition.create({
      data: {
        name,
        description,
        type,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        venue,
        pointsForWin,
        pointsForDraw,
        pointsForLoss,
        hasOvertime,
        overtimeMinutes,
        hasPenalties,
        matchDuration,
        breakDuration,
        matchesPerDay,
        hasGroups,
        groupCount,
        teamsPerGroup,
        advancePerGroup,
        playoffRounds,
        thirdPlaceMatch,
        resourceId,
        organizationId: session.user.organizationId,
        status: "DRAFT"
      }
    })
    
    return NextResponse.json(competition, { status: 201 })
  } catch (error) {
    console.error("[Competitions POST] Error:", error)
    return NextResponse.json(
      { error: "Kunne ikke opprette konkurranse" },
      { status: 500 }
    )
  }
}

