import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { canCreateUser } from "@/lib/license"
import { sendVerificationEmail } from "@/lib/email-verification"

export async function POST(request: Request) {
  try {
    const { name, email, phone, password, orgSlug, claimsMembership } = await request.json()

    // Validate required fields (orgSlug is now optional - will auto-detect)
    if (!email || !password) {
      return NextResponse.json(
        { error: "E-post og passord er påkrevd" },
        { status: 400 }
      )
    }

    // Sjekk lisensgrenser for brukerantall
    const licenseCheck = await canCreateUser()
    if (!licenseCheck.allowed) {
      return NextResponse.json(
        { error: licenseCheck.message || "Kan ikke opprette flere brukere med gjeldende lisens" },
        { status: 403 }
      )
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ 
      where: { email },
      select: { id: true }
    })
    
    if (existingUser) {
      return NextResponse.json(
        { error: "E-postadressen er allerede registrert" },
        { status: 400 }
      )
    }

    // Find organization - either by slug or auto-detect (single org per instance)
    let organization
    if (orgSlug) {
      organization = await prisma.organization.findUnique({ 
        where: { slug: orgSlug },
        select: {
          id: true,
          name: true,
          requireUserApproval: true
        }
      })
    } else {
      // Auto-detect: get the first (and typically only) organization
      organization = await prisma.organization.findFirst({
        select: {
          id: true,
          name: true,
          requireUserApproval: true
        }
      })
    }
    
    if (!organization) {
      return NextResponse.json(
        { error: "Ingen klubb er satt opp ennå. Kontakt administrator." },
        { status: 404 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Check if user needs approval based on organization settings
    const needsApproval = organization.requireUserApproval

    // Create user
    // Hvis brukeren hevder å være medlem, sett isMember basert på deres valg
    // Admin kan verifisere/endre dette senere ved godkjenning
    const user = await prisma.user.create({
      data: {
        email,
        name,
        phone,
        password: hashedPassword,
        systemRole: "user", // Nye brukere får alltid systemRole "user"
        customRoleId: null, // Ingen custom role ved registrering
        role: "user", // Legacy: beholder for bakoverkompatibilitet
        organizationId: organization.id,
        isApproved: !needsApproval, // Auto-approve if org doesn't require approval
        approvedAt: !needsApproval ? new Date() : null,
        isMember: claimsMembership === true, // Medlemsstatus basert på brukerens valg
        emailVerified: false, // Email must be verified
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isApproved: true,
        emailVerified: true,
        isMember: true,
      }
    })

    // Send verification email
    try {
      await sendVerificationEmail(user.id, user.email, organization.name)
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError)
      // Don't fail registration if email fails, but log it
    }

    return NextResponse.json({
      success: true,
      user,
      needsApproval: needsApproval,
      emailVerificationSent: true,
      message: needsApproval 
        ? `Din konto hos ${organization.name} er opprettet! Sjekk e-posten din for å verifisere kontoen. Du vil få tilgang når administrator godkjenner deg.`
        : `Din konto hos ${organization.name} er opprettet! Sjekk e-posten din for å verifisere kontoen før du logger inn.`
    }, { status: 201 })

  } catch (error) {
    console.error("Registration error:", error)
    
    if (error instanceof Error) {
      const errorCode = (error as any)?.code || ""
      
      // Check for Prisma unique constraint errors
      if (errorCode === "P2002" || error.message.includes("Unique constraint")) {
        if (error.message.includes("email")) {
          return NextResponse.json(
            { error: "E-postadressen er allerede registrert" },
            { status: 400 }
          )
        }
      }
      
      // Check for database connection errors
      if (errorCode === "P1001" || error.message.includes("connect") || error.message.includes("timeout")) {
        return NextResponse.json(
          { error: "Kunne ikke koble til database. Prøv igjen om litt." },
          { status: 503 }
        )
      }
      
      // Check for foreign key constraint errors
      if (errorCode === "P2003" || error.message.includes("Foreign key constraint")) {
        return NextResponse.json(
          { error: "Klubbkoden er ugyldig. Sjekk at du har skrevet riktig kode." },
          { status: 400 }
        )
      }
    }
    
    return NextResponse.json(
      { error: "Kunne ikke opprette bruker. Prøv igjen." },
      { status: 500 }
    )
  }
}
