import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET - Hent et spesifikt lag
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 })
    }

    const { id: competitionId, teamId } = await params

    const team = await prisma.competitionTeam.findFirst({
      where: {
        id: teamId,
        competitionId: competitionId
      }
    })

    if (!team) {
      return NextResponse.json({ error: "Lag ikke funnet" }, { status: 404 })
    }

    return NextResponse.json(team)
  } catch (error) {
    console.error("[MatchSetup] Error fetching team:", error)
    return NextResponse.json(
      { error: "Kunne ikke hente lag" },
      { status: 500 }
    )
  }
}

// PATCH - Oppdater et lag
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 })
    }

    const { id: competitionId, teamId } = await params
    const body = await request.json()

    // Sjekk at laget eksisterer
    const existingTeam = await prisma.competitionTeam.findFirst({
      where: {
        id: teamId,
        competitionId: competitionId
      },
      include: {
        competition: true
      }
    })

    if (!existingTeam) {
      return NextResponse.json({ error: "Lag ikke funnet" }, { status: 404 })
    }

    // Oppdater laget
    const updatedTeam = await prisma.competitionTeam.update({
      where: { id: teamId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.shortName !== undefined && { shortName: body.shortName }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.contactName !== undefined && { contactName: body.contactName }),
        ...(body.contactEmail !== undefined && { contactEmail: body.contactEmail }),
        ...(body.contactPhone !== undefined && { contactPhone: body.contactPhone }),
        ...(body.players !== undefined && { players: body.players }),
        ...(body.seed !== undefined && { seed: body.seed })
      }
    })

    return NextResponse.json(updatedTeam)
  } catch (error) {
    console.error("[MatchSetup] Error updating team:", error)
    const errorMessage = error instanceof Error ? error.message : "Ukjent feil"
    return NextResponse.json(
      { error: `Kunne ikke oppdatere lag: ${errorMessage}` },
      { status: 500 }
    )
  }
}

// DELETE - Slett et lag
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 })
    }

    const { id: competitionId, teamId } = await params

    // Sjekk at laget eksisterer og at konkurransen ikke er startet
    const existingTeam = await prisma.competitionTeam.findFirst({
      where: {
        id: teamId,
        competitionId: competitionId
      },
      include: {
        competition: true
      }
    })

    if (!existingTeam) {
      return NextResponse.json({ error: "Lag ikke funnet" }, { status: 404 })
    }

    if (existingTeam.competition.status === "ACTIVE" || existingTeam.competition.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Kan ikke slette lag etter at konkurransen har startet" },
        { status: 400 }
      )
    }

    await prisma.competitionTeam.delete({
      where: { id: teamId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[MatchSetup] Error deleting team:", error)
    return NextResponse.json(
      { error: "Kunne ikke slette lag" },
      { status: 500 }
    )
  }
}

