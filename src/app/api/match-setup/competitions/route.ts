import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isMatchSetupEnabled } from "@/lib/match-setup"
import { canAccessMatchSetup } from "@/lib/roles"

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
        resource: {
          select: {
            id: true,
            name: true,
            location: true
          }
        },
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
    
    // Sjekk om brukeren har tilgang til kampoppsett (admin eller hasMatchSetupAccess)
    const hasAccess = await canAccessMatchSetup(session.user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: "Du har ikke tilgang til å opprette konkurranser" }, { status: 403 })
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
      dailyStartTime,
      dailyEndTime,
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

    // Sjekk for booking-konflikter hvis fasilitet og tidspunkter er valgt
    if (resourceId && dailyStartTime && dailyEndTime) {
      const compStartDate = new Date(startDate)
      const compEndDate = endDate ? new Date(endDate) : compStartDate
      
      // Generer alle datoer i konkurranseperioden
      const currentDate = new Date(compStartDate)
      const conflictingBookings: any[] = []
      
      while (currentDate <= compEndDate) {
        const [startHour, startMin] = dailyStartTime.split(":").map(Number)
        const [endHour, endMin] = dailyEndTime.split(":").map(Number)
        
        const blockStart = new Date(currentDate)
        blockStart.setHours(startHour, startMin, 0, 0)
        
        const blockEnd = new Date(currentDate)
        blockEnd.setHours(endHour, endMin, 0, 0)
        
        // Sjekk for eksisterende bookinger på denne dagen
        const dayConflicts = await prisma.booking.findMany({
          where: {
            resourceId,
            status: { in: ["approved", "pending"] },
            startTime: { lt: blockEnd },
            endTime: { gt: blockStart }
          },
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true
          }
        })
        
        if (dayConflicts.length > 0) {
          conflictingBookings.push(...dayConflicts.map(b => ({
            ...b,
            date: currentDate.toLocaleDateString("nb-NO")
          })))
        }
        
        // Sjekk for andre konkurranser på denne dagen
        const competitionConflicts = await prisma.competition.findMany({
          where: {
            resourceId,
            status: { in: ["DRAFT", "SCHEDULED", "ACTIVE"] },
            dailyStartTime: { not: null },
            dailyEndTime: { not: null },
            startDate: { lte: blockEnd },
            OR: [
              { endDate: { gte: blockStart } },
              { endDate: null }
            ]
          },
          select: {
            id: true,
            name: true,
            dailyStartTime: true,
            dailyEndTime: true,
            startDate: true,
            endDate: true
          }
        })
        
        for (const comp of competitionConflicts) {
          if (comp.dailyStartTime && comp.dailyEndTime) {
            const [cStartHour, cStartMin] = comp.dailyStartTime.split(":").map(Number)
            const [cEndHour, cEndMin] = comp.dailyEndTime.split(":").map(Number)
            
            const compBlockStart = new Date(currentDate)
            compBlockStart.setHours(cStartHour, cStartMin, 0, 0)
            
            const compBlockEnd = new Date(currentDate)
            compBlockEnd.setHours(cEndHour, cEndMin, 0, 0)
            
            if (compBlockStart < blockEnd && compBlockEnd > blockStart) {
              return NextResponse.json(
                { error: `Konflikt: Fasiliteten er allerede reservert av konkurransen "${comp.name}" den ${currentDate.toLocaleDateString("nb-NO")}` },
                { status: 409 }
              )
            }
          }
        }
        
        // Gå til neste dag
        currentDate.setDate(currentDate.getDate() + 1)
      }
      
      if (conflictingBookings.length > 0) {
        const firstConflict = conflictingBookings[0]
        return NextResponse.json(
          { error: `Konflikt: Det finnes en booking "${firstConflict.title}" den ${firstConflict.date} som overlapper med konkurranseperioden` },
          { status: 409 }
        )
      }
    }
    
    const competition = await prisma.competition.create({
      data: {
        name,
        description,
        type,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        dailyStartTime,
        dailyEndTime,
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

