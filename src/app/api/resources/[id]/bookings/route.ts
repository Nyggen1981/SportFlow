import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

// Public API to get bookings for a specific resource
// Used by ResourceCalendar for client-side fetching
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: resourceId } = await params
  const { searchParams } = new URL(request.url)
  
  // Default: 2 weeks back, 2 months ahead
  const now = new Date()
  const defaultStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const defaultEnd = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
  
  const startDateParam = searchParams.get("startDate")
  const endDateParam = searchParams.get("endDate")
  
  const startDate = startDateParam ? new Date(startDateParam) : defaultStart
  const endDate = endDateParam ? new Date(endDateParam) : defaultEnd

  try {
    // Check if resource exists
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      select: { id: true, name: true }
    })

    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 })
    }

    // Get bookings for this resource
    const bookings = await prisma.booking.findMany({
      where: {
        resourceId,
        status: { in: ["approved", "pending"] },
        startTime: { gte: startDate, lte: endDate }
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        status: true,
        isRecurring: true,
        parentBookingId: true,
        userId: true,
        resourcePartId: true,
        resourcePart: {
          select: {
            id: true,
            name: true,
            parentId: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { startTime: "asc" }
    })

    // Get competitions/matches for this resource
    let matchEvents: Array<{
      id: string
      title: string
      startTime: string
      endTime: string
      status: string
      resourcePartId: string | null
      resourcePartName: string | null
      isCompetition: boolean
    }> = []

    try {
      const competitions = await prisma.competition.findMany({
        where: {
          resourceId,
          status: { in: ["DRAFT", "SCHEDULED", "ACTIVE"] },
          startDate: { lte: endDate },
          OR: [
            { endDate: { gte: startDate } },
            { endDate: null }
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
          matches: {
            where: {
              scheduledTime: { gte: startDate, lte: endDate }
            },
            select: {
              id: true,
              matchNumber: true,
              roundName: true,
              scheduledTime: true,
              status: true,
              homeTeam: { select: { name: true, shortName: true } },
              awayTeam: { select: { name: true, shortName: true } },
              homeTeamPlaceholder: true,
              awayTeamPlaceholder: true,
              resourcePart: { select: { id: true, name: true } }
            },
            orderBy: { scheduledTime: "asc" }
          }
        }
      })

      for (const comp of competitions) {
        if (comp.matches.length > 0) {
          for (const match of comp.matches) {
            if (match.scheduledTime) {
              const homeTeam = match.homeTeam?.shortName || match.homeTeam?.name || match.homeTeamPlaceholder || "TBD"
              const awayTeam = match.awayTeam?.shortName || match.awayTeam?.name || match.awayTeamPlaceholder || "TBD"
              const matchStart = new Date(match.scheduledTime)
              const matchEnd = new Date(matchStart.getTime() + (comp.matchDuration * 60 * 1000))

              matchEvents.push({
                id: `match-${match.id}`,
                title: `🏆 ${homeTeam} vs ${awayTeam}`,
                startTime: matchStart.toISOString(),
                endTime: matchEnd.toISOString(),
                status: "competition",
                resourcePartId: match.resourcePart?.id || null,
                resourcePartName: match.resourcePart?.name || null,
                isCompetition: true
              })
            }
          }
        } else if (comp.dailyStartTime && comp.dailyEndTime) {
          const compStartDate = new Date(comp.startDate)
          const compEndDate = comp.endDate ? new Date(comp.endDate) : compStartDate
          const currentDate = new Date(Math.max(compStartDate.getTime(), startDate.getTime()))
          const lastDate = new Date(Math.min(compEndDate.getTime(), endDate.getTime()))

          while (currentDate <= lastDate) {
            const [startHour, startMin] = comp.dailyStartTime.split(":").map(Number)
            const [endHour, endMin] = comp.dailyEndTime.split(":").map(Number)

            const blockStart = new Date(currentDate)
            blockStart.setHours(startHour, startMin, 0, 0)

            const blockEnd = new Date(currentDate)
            blockEnd.setHours(endHour, endMin, 0, 0)

            matchEvents.push({
              id: `comp-block-${comp.id}-${currentDate.toISOString().split("T")[0]}`,
              title: `🏆 ${comp.name}`,
              startTime: blockStart.toISOString(),
              endTime: blockEnd.toISOString(),
              status: "competition",
              resourcePartId: null,
              resourcePartName: null,
              isCompetition: true
            })

            currentDate.setDate(currentDate.getDate() + 1)
          }
        }
      }
    } catch {
      // Competition table might not exist
    }

    // Format bookings for client
    const formattedBookings = bookings.map(b => ({
      id: b.id,
      title: b.title,
      startTime: b.startTime.toISOString(),
      endTime: b.endTime.toISOString(),
      status: b.status,
      resourcePartId: b.resourcePartId,
      resourcePartName: b.resourcePart?.name || null,
      resourcePartParentId: b.resourcePart?.parentId || null,
      userId: b.userId,
      userName: b.user?.name || null,
      userEmail: b.user?.email || null,
      isRecurring: b.isRecurring || false,
      parentBookingId: b.parentBookingId
    }))

    return NextResponse.json({
      bookings: [...formattedBookings, ...matchEvents]
    })
  } catch (error) {
    console.error("[Resource Bookings API] Error:", error)
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 })
  }
}

