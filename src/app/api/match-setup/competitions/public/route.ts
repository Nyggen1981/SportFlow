import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isMatchSetupEnabled } from "@/lib/match-setup"

export const dynamic = 'force-dynamic'

// GET - Hent alle offentlige konkurranser (for innloggede brukere)
export async function GET() {
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

    // Hent alle konkurranser for organisasjonen som ikke er CANCELLED
    // Vis DRAFT, SCHEDULED, ACTIVE og COMPLETED
    const competitions = await prisma.competition.findMany({
      where: {
        organizationId: session.user.organizationId,
        status: {
          not: "CANCELLED"
        }
      },
      include: {
        _count: {
          select: {
            teams: true,
            matches: true
          }
        }
      },
      orderBy: [
        { status: "asc" }, // ACTIVE først
        { startDate: "desc" }
      ]
    })

    // Sorter slik at ACTIVE kommer først, deretter SCHEDULED, DRAFT, og til slutt COMPLETED
    const statusOrder = { ACTIVE: 0, SCHEDULED: 1, DRAFT: 2, COMPLETED: 3 }
    competitions.sort((a, b) => {
      const orderA = statusOrder[a.status as keyof typeof statusOrder] ?? 4
      const orderB = statusOrder[b.status as keyof typeof statusOrder] ?? 4
      if (orderA !== orderB) return orderA - orderB
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    })

    return NextResponse.json(competitions)
  } catch (error) {
    console.error("[MatchSetup] Error fetching public competitions:", error)
    return NextResponse.json(
      { error: "Kunne ikke hente konkurranser" },
      { status: 500 }
    )
  }
}

