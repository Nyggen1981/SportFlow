import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isMatchSetupEnabled } from "@/lib/match-setup"

// POST - Registrer påmelding til konkurranse
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Du må være logget inn for å melde deg på" }, { status: 401 })
    }
    
    // Sjekk om modulen er aktivert
    const enabled = await isMatchSetupEnabled()
    if (!enabled) {
      return NextResponse.json(
        { error: "Kampoppsett-modulen er ikke aktivert" },
        { status: 403 }
      )
    }
    
    const { id: competitionId } = await params
    const body = await request.json()
    
    const {
      teamName,
      contactName,
      contactEmail,
      contactPhone,
      participants,
      notes
    } = body
    
    // Hent konkurransen
    const competition = await prisma.competition.findFirst({
      where: {
        id: competitionId,
        organizationId: session.user.organizationId
      },
      include: {
        _count: {
          select: {
            teams: true,
            registrations: true
          }
        }
      }
    })
    
    if (!competition) {
      return NextResponse.json(
        { error: "Konkurranse ikke funnet" },
        { status: 404 }
      )
    }
    
    // Sjekk om påmelding er åpen
    const now = new Date()
    if (competition.registrationOpenDate && now < competition.registrationOpenDate) {
      return NextResponse.json(
        { error: "Påmeldingen har ikke åpnet ennå" },
        { status: 400 }
      )
    }
    if (competition.registrationCloseDate && now > competition.registrationCloseDate) {
      return NextResponse.json(
        { error: "Påmeldingsfristen har gått ut" },
        { status: 400 }
      )
    }
    
    // Sjekk om det er plass til flere lag
    if (competition.maxTeams) {
      const currentTeamCount = competition._count.teams + competition._count.registrations
      if (currentTeamCount >= competition.maxTeams) {
        return NextResponse.json(
          { error: "Konkurransen er full" },
          { status: 400 }
        )
      }
    }
    
    // Valider input
    if (competition.registrationType === "TEAM" && !teamName?.trim()) {
      return NextResponse.json(
        { error: "Lagnavn er påkrevd" },
        { status: 400 }
      )
    }
    
    if (!contactName?.trim() || !contactEmail?.trim()) {
      return NextResponse.json(
        { error: "Kontaktinformasjon er påkrevd" },
        { status: 400 }
      )
    }
    
    // Valider antall spillere
    const validParticipants = (participants || []).filter((p: { name: string }) => p.name?.trim())
    
    if (competition.minPlayersPerTeam && validParticipants.length < competition.minPlayersPerTeam) {
      return NextResponse.json(
        { error: `Minimum ${competition.minPlayersPerTeam} spillere er påkrevd` },
        { status: 400 }
      )
    }
    
    if (competition.maxPlayersPerTeam && validParticipants.length > competition.maxPlayersPerTeam) {
      return NextResponse.json(
        { error: `Maks ${competition.maxPlayersPerTeam} spillere er tillatt` },
        { status: 400 }
      )
    }
    
    // Sjekk om brukeren allerede har meldt seg på
    const existingRegistration = await prisma.competitionRegistration.findFirst({
      where: {
        competitionId,
        userId: session.user.id,
        status: { notIn: ["CANCELLED", "REJECTED"] }
      }
    })
    
    if (existingRegistration) {
      return NextResponse.json(
        { error: "Du har allerede en aktiv påmelding til denne konkurransen" },
        { status: 400 }
      )
    }
    
    // Beregn avgift (lagre som øre/integer)
    const fee = competition.registrationType === "TEAM" 
      ? competition.teamFee 
      : competition.playerFee
    const feeInOre = fee ? Math.round(Number(fee) * 100) : null
    
    // Opprett påmelding
    const registration = await prisma.competitionRegistration.create({
      data: {
        competitionId,
        userId: session.user.id,
        teamName: competition.registrationType === "TEAM" ? teamName : null,
        contactName,
        contactEmail,
        contactPhone,
        players: validParticipants,
        paymentAmount: feeInOre,
        paymentStatus: feeInOre && feeInOre > 0 ? "PENDING" : "COMPLETED",
        status: "PENDING",
        notes,
        organizationId: session.user.organizationId
      }
    })
    
    // TODO: Send bekreftelsesmail til bruker
    // TODO: Send varsel til admin om ny påmelding
    
    return NextResponse.json(registration, { status: 201 })
  } catch (error) {
    console.error("[Competition Registration] Error:", error)
    return NextResponse.json(
      { error: "Kunne ikke registrere påmelding" },
      { status: 500 }
    )
  }
}

// GET - Hent brukerens påmeldinger til denne konkurransen
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Ikke autentisert" }, { status: 401 })
    }
    
    const { id: competitionId } = await params
    
    const registrations = await prisma.competitionRegistration.findMany({
      where: {
        competitionId,
        userId: session.user.id
      },
      orderBy: { createdAt: "desc" }
    })
    
    return NextResponse.json(registrations)
  } catch (error) {
    console.error("[Competition Registration GET] Error:", error)
    return NextResponse.json(
      { error: "Kunne ikke hente påmeldinger" },
      { status: 500 }
    )
  }
}
