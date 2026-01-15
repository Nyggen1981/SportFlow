import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isMatchSetupEnabled } from "@/lib/match-setup"
import { canAccessMatchSetup } from "@/lib/roles"

// GET - Hent alle lag i en konkurranse
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
    
    // Verifiser tilgang til konkurransen
    const competition = await prisma.competition.findFirst({
      where: { id, organizationId: session.user.organizationId }
    })
    
    if (!competition) {
      return NextResponse.json({ error: "Konkurranse ikke funnet" }, { status: 404 })
    }
    
    const teams = await prisma.competitionTeam.findMany({
      where: { competitionId: id },
      include: {
        group: { select: { id: true, name: true } }
      },
      orderBy: [{ seed: "asc" }, { name: "asc" }]
    })
    
    return NextResponse.json(teams)
  } catch (error) {
    console.error("[Teams GET] Error:", error)
    return NextResponse.json(
      { error: "Kunne ikke hente lag" },
      { status: 500 }
    )
  }
}

// POST - Legg til lag i konkurranse
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
      return NextResponse.json({ error: "Du har ikke tilgang til å legge til lag" }, { status: 403 })
    }
    
    const enabled = await isMatchSetupEnabled()
    if (!enabled) {
      return NextResponse.json(
        { error: "Kampoppsett-modulen er ikke aktivert" },
        { status: 403 }
      )
    }
    
    const body = await request.json()
    
    // Verifiser tilgang til konkurransen
    const competition = await prisma.competition.findFirst({
      where: { id, organizationId: session.user.organizationId }
    })
    
    if (!competition) {
      return NextResponse.json({ error: "Konkurranse ikke funnet" }, { status: 404 })
    }
    
    // Sjekk om konkurransen tillater endringer
    if (competition.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Kan ikke legge til lag etter at konkurransen har startet. Nullstill først." },
        { status: 400 }
      )
    }
    
    // Sjekk om det er en enkelt lag eller en liste
    const teamsToAdd = Array.isArray(body) ? body : [body]
    
    const createdTeams = await prisma.$transaction(
      teamsToAdd.map((team, index) => 
        prisma.competitionTeam.create({
          data: {
            name: team.name,
            shortName: team.shortName,
            color: team.color,
            logo: team.logo,
            contactName: team.contactName,
            contactEmail: team.contactEmail,
            contactPhone: team.contactPhone,
            seed: team.seed || null,
            groupId: team.groupId,
            competitionId: id
          }
        })
      )
    )
    
    return NextResponse.json(createdTeams, { status: 201 })
  } catch (error) {
    console.error("[Teams POST] Error:", error)
    return NextResponse.json(
      { error: "Kunne ikke legge til lag" },
      { status: 500 }
    )
  }
}

// DELETE - Fjern alle lag fra konkurranse
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
      return NextResponse.json({ error: "Du har ikke tilgang til å fjerne lag" }, { status: 403 })
    }
    
    const enabled = await isMatchSetupEnabled()
    if (!enabled) {
      return NextResponse.json(
        { error: "Kampoppsett-modulen er ikke aktivert" },
        { status: 403 }
      )
    }
    
    // Verifiser tilgang til konkurransen
    const competition = await prisma.competition.findFirst({
      where: { id, organizationId: session.user.organizationId }
    })
    
    if (!competition) {
      return NextResponse.json({ error: "Konkurranse ikke funnet" }, { status: 404 })
    }
    
    // Slett alle lag (cascade sletter kamper også)
    await prisma.competitionTeam.deleteMany({
      where: { competitionId: id }
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Teams DELETE] Error:", error)
    return NextResponse.json(
      { error: "Kunne ikke fjerne lag" },
      { status: 500 }
    )
  }
}

