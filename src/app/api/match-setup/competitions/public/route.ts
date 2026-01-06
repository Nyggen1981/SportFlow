import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isMatchSetupEnabled } from "@/lib/match-setup"

export const dynamic = 'force-dynamic'

// GET - Hent alle offentlige konkurranser (tilgjengelig for alle, inkl. ikke-innloggede)
export async function GET() {
  try {
    // Sjekk om modulen er aktivert
    const moduleEnabled = await isMatchSetupEnabled()
    if (!moduleEnabled) {
      return NextResponse.json({ error: "Modul ikke aktivert" }, { status: 403 })
    }

    // Hent organisasjons-ID fra session eller bruk standard-organisasjon
    const session = await getServerSession(authOptions)
    let organizationId = session?.user?.organizationId

    // Hvis ikke innlogget, hent første (eneste) organisasjon
    if (!organizationId) {
      const org = await prisma.organization.findFirst()
      organizationId = org?.id
    }

    if (!organizationId) {
      return NextResponse.json({ error: "Ingen organisasjon funnet" }, { status: 404 })
    }

    // Hent alle konkurranser for organisasjonen som ikke er CANCELLED
    // For ikke-innloggede: vis kun ACTIVE og COMPLETED (ikke DRAFT/SCHEDULED)
    const competitions = await prisma.competition.findMany({
      where: {
        organizationId,
        status: session?.user 
          ? { not: "CANCELLED" }  // Innloggede ser alt unntatt CANCELLED
          : { in: ["ACTIVE", "COMPLETED"] }  // Ikke-innloggede ser kun ACTIVE/COMPLETED
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

