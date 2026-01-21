import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // GDPR: Only admins and moderators can see user info on bookings
  const canSeeUserInfo = session.user.role === "admin" || session.user.role === "moderator"

  const { searchParams } = new URL(request.url)
  const dateParam = searchParams.get("date")
  const startDateParam = searchParams.get("startDate")
  const endDateParam = searchParams.get("endDate")
  
  let startOfDay: Date
  let endOfDay: Date
  
  if (startDateParam && endDateParam) {
    // Week or month view
    startOfDay = new Date(startDateParam)
    startOfDay.setHours(0, 0, 0, 0)
    endOfDay = new Date(endDateParam)
    endOfDay.setHours(23, 59, 59, 999)
  } else {
    // Day view (backward compatibility)
    const targetDate = dateParam ? new Date(dateParam) : new Date()
    startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)
  }

  const organizationId = session.user.organizationId

  console.log("[Timeline API] Fetching data for org:", organizationId, "dates:", startOfDay, "to", endOfDay)

  // Get all bookings and resources in parallel for better performance
  const [bookings, resources] = await Promise.all([
    prisma.booking.findMany({
      where: {
        organizationId,
        status: { in: ["approved", "pending"] },
        OR: [
          {
            // Bookings that start on this day
            startTime: { gte: startOfDay, lte: endOfDay }
          },
          {
            // Bookings that end on this day
            endTime: { gte: startOfDay, lte: endOfDay }
          },
          {
            // Bookings that span this day
            AND: [
              { startTime: { lte: startOfDay } },
              { endTime: { gte: endOfDay } }
            ]
          }
        ]
      },
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true,
      status: true,
      userId: true,
      isRecurring: true,
      // Internal admin note (NOT shown to users - different from ResourcePart.adminNote which goes in emails)
      ...(canSeeUserInfo ? { adminNote: true } : {}),
      resource: {
        select: {
          id: true,
          name: true,
          color: true,
          allowWholeBooking: true,
          category: {
            select: {
              id: true,
              name: true,
              color: true
            }
          },
          parts: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              parentId: true
            },
            orderBy: { name: "asc" }
          }
        }
      },
      resourcePart: {
        select: {
          id: true,
          name: true,
          parentId: true
        }
      },
      // GDPR: Only include user info for admins/moderators
      ...(canSeeUserInfo ? {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      } : {
        userId: true
      })
    },
      orderBy: { startTime: "asc" }
    }),
    prisma.resource.findMany({
      where: {
        organizationId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        color: true,
        allowWholeBooking: true,
        category: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        parts: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            parentId: true,
            children: {
              where: { isActive: true },
              select: { id: true, name: true }
            }
          },
          orderBy: { name: "asc" }
        }
      },
    orderBy: [
      { category: { name: "asc" } },
      { name: "asc" }
    ]
    })
  ])

  // Hent konkurranser separat med try-catch for å håndtere evt. Prisma-feil
  // Kun hvis kampoppsett-modulen er aktivert
  let competitions: any[] = []
  
  const { isMatchSetupEnabled } = await import("@/lib/match-setup")
  const matchSetupEnabled = await isMatchSetupEnabled()
  
  if (matchSetupEnabled) {
    try {
      competitions = await prisma.competition.findMany({
      where: {
        organizationId,
        status: { in: ["DRAFT", "SCHEDULED", "ACTIVE"] },
        resourceId: { not: null },
        // Vis konkurranser som overlapper med visningsperioden
        OR: [
          // Konkurransen starter i visningsperioden
          { startDate: { gte: startOfDay, lte: endOfDay } },
          // Konkurransen slutter i visningsperioden
          { endDate: { gte: startOfDay, lte: endOfDay } },
          // Konkurransen spenner over hele visningsperioden
          { AND: [{ startDate: { lte: startOfDay } }, { endDate: { gte: endOfDay } }] },
          // Konkurranser uten sluttdato som har startet før/i perioden
          { AND: [{ startDate: { lte: endOfDay } }, { endDate: null }] }
        ]
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        dailyStartTime: true,
        dailyEndTime: true,
        matchDuration: true,
        status: true,
        resourceId: true,
        resource: {
          select: {
            id: true,
            name: true,
            color: true,
            category: {
              select: {
                id: true,
                name: true,
                color: true
              }
            },
            parts: {
              where: { isActive: true },
              select: { id: true, name: true },
              orderBy: { name: "asc" }
            }
          }
        },
        matches: {
          where: {
            scheduledTime: { gte: startOfDay, lte: endOfDay }
          },
          select: {
            id: true,
            matchNumber: true,
            roundName: true,
            scheduledTime: true,
            homeTeam: { select: { name: true, shortName: true } },
            awayTeam: { select: { name: true, shortName: true } },
            homeTeamPlaceholder: true,
            awayTeamPlaceholder: true,
            resourcePart: { select: { id: true, name: true, parentId: true } }
          },
          orderBy: { scheduledTime: "asc" }
        }
      }
    })
    console.log("[Timeline API] Found competitions:", competitions.length, competitions.map((c: any) => ({ id: c.id, name: c.name, dailyStartTime: c.dailyStartTime, dailyEndTime: c.dailyEndTime, matches: c.matches?.length || 0 })))
    } catch (error) {
      console.error("[Timeline API] Error fetching competitions:", error)
      // Continue without competitions if there's an error
    }
  }

  // Generer konkurransehendelser som booking-lignende objekter
  
  const competitionEvents: any[] = []
  
  for (const comp of competitions) {
    if (!comp.resource) continue
    
    // Hvis konkurransen har kamper med tider, vis disse
    if (comp.matches.length > 0) {
      for (const match of comp.matches) {
        if (match.scheduledTime) {
          const homeTeam = match.homeTeam?.shortName || match.homeTeam?.name || match.homeTeamPlaceholder || "TBD"
          const awayTeam = match.awayTeam?.shortName || match.awayTeam?.name || match.awayTeamPlaceholder || "TBD"
          const matchStart = new Date(match.scheduledTime)
          const matchEnd = new Date(matchStart.getTime() + (comp.matchDuration * 60 * 1000))
          
          competitionEvents.push({
            id: `match-${match.id}`,
            title: `🏆 ${homeTeam} vs ${awayTeam}`,
            startTime: matchStart.toISOString(),
            endTime: matchEnd.toISOString(),
            status: "competition",
            userId: null,
            isRecurring: false,
            resource: comp.resource,
            resourcePart: match.resourcePart,
            isCompetition: true,
            competitionName: comp.name,
            roundName: match.roundName
          })
        }
      }
    } else if (comp.dailyStartTime && comp.dailyEndTime) {
      // Hvis ingen kamper, men tidspunkter er satt, vis blokkering for hele perioden
      const compStart = new Date(comp.startDate)
      const compEnd = comp.endDate ? new Date(comp.endDate) : compStart
      
      // Generer blokker for hver dag i visningsperioden som overlapper med konkurransen
      const currentDate = new Date(Math.max(compStart.getTime(), startOfDay.getTime()))
      const lastDate = new Date(Math.min(compEnd.getTime(), endOfDay.getTime()))
      
      while (currentDate <= lastDate) {
        const [startHour, startMin] = comp.dailyStartTime.split(":").map(Number)
        const [endHour, endMin] = comp.dailyEndTime.split(":").map(Number)
        
        const blockStart = new Date(currentDate)
        blockStart.setHours(startHour, startMin, 0, 0)
        
        const blockEnd = new Date(currentDate)
        blockEnd.setHours(endHour, endMin, 0, 0)
        
        competitionEvents.push({
          id: `comp-block-${comp.id}-${currentDate.toISOString().split("T")[0]}`,
          title: `🏆 ${comp.name}`,
          startTime: blockStart.toISOString(),
          endTime: blockEnd.toISOString(),
          status: "competition",
          userId: null,
          isRecurring: false,
          resource: comp.resource,
          resourcePart: null,
          isCompetition: true,
          competitionName: comp.name,
          roundName: comp.status === "DRAFT" ? "Planlagt" : null
        })
        
        // Gå til neste dag
        currentDate.setDate(currentDate.getDate() + 1)
      }
    }
  }

  // Kombiner bookings og konkurransehendelser
  const allBookings = [...bookings, ...competitionEvents].sort((a, b) => 
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )

  return NextResponse.json({
    bookings: allBookings,
    resources,
    date: startOfDay.toISOString()
  })
}

