import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

export async function POST(request: Request) {
  try {
    const { name, email, phone, password, orgName, orgSlug } = await request.json()

    // Validate required fields
    if (!email || !password || !orgName || !orgSlug) {
      return NextResponse.json(
        { error: "Alle felt markert med * er påkrevd" },
        { status: 400 }
      )
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(orgSlug)) {
      return NextResponse.json(
        { error: "Klubbkoden kan kun inneholde små bokstaver, tall og bindestrek" },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        { error: "E-postadressen er allerede registrert" },
        { status: 400 }
      )
    }

    // Check if org slug already exists
    const existingOrg = await prisma.organization.findUnique({ 
      where: { slug: orgSlug } 
    })
    if (existingOrg) {
      return NextResponse.json(
        { error: "Denne klubbkoden er allerede i bruk. Prøv en annen." },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create organization and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: orgName,
          slug: orgSlug,
          primaryColor: "#2563eb",
          secondaryColor: "#1e40af"
        }
      })

      // Create default categories only if none exist
      // Note: Categories are shared across all organizations
      const existingCategories = await tx.resourceCategory.count()
      if (existingCategories === 0) {
        try {
          await tx.resourceCategory.createMany({
            data: [
              { name: "Utendørs", description: "Utendørs fasiliteter", icon: "Sun", color: "#22c55e" },
              { name: "Innendørs", description: "Innendørs fasiliteter", icon: "Home", color: "#3b82f6" },
              { name: "Møterom", description: "Møterom og sosiale rom", icon: "Users", color: "#f59e0b" },
              { name: "Utstyr", description: "Utstyr som kan lånes", icon: "Package", color: "#8b5cf6" }
            ]
          })
        } catch (categoryError) {
          // Ignore if categories already exist (race condition or already created)
          console.log("Categories may already exist, skipping creation")
        }
      }

      // Create admin user (automatically approved and verified)
      const user = await tx.user.create({
        data: {
          email,
          name,
          phone,
          password: hashedPassword,
          systemRole: "admin", // Brukeren som oppretter klubb blir admin
          customRoleId: null, // Admin kan ikke ha custom role
          role: "admin", // Legacy: beholder for bakoverkompatibilitet
          isApproved: true, // Admin users are automatically approved
          approvedAt: new Date(),
          emailVerified: true, // Admin users are automatically verified
          emailVerifiedAt: new Date(),
          isMember: false, // Medlemsstatus settes av admin
          organizationId: organization.id
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true
        }
      })

      return { organization, user }
    })

    return NextResponse.json({
      success: true,
      user: result.user,
      organization: {
        name: result.organization.name,
        slug: result.organization.slug
      },
      message: `${result.organization.name} er opprettet! Du er nå administrator.`
    }, { status: 201 })

  } catch (error) {
    console.error("Registration error:", error)
    
    // Provide more specific error messages
    if (error instanceof Error) {
      // Check for Prisma unique constraint errors
      if (error.message.includes("Unique constraint") || error.message.includes("P2002")) {
        if (error.message.includes("email")) {
          return NextResponse.json(
            { error: "E-postadressen er allerede registrert" },
            { status: 400 }
          )
        }
        if (error.message.includes("slug")) {
          return NextResponse.json(
            { error: "Denne klubbkoden er allerede i bruk. Prøv en annen." },
            { status: 400 }
          )
        }
      }
      
      // Check for database connection errors
      if (error.message.includes("connect") || error.message.includes("timeout") || error.message.includes("ECONNREFUSED")) {
        return NextResponse.json(
          { error: "Kunne ikke koble til database. Sjekk at DATABASE_URL er riktig konfigurert." },
          { status: 503 }
        )
      }
      
      // Check for foreign key constraint errors
      if (error.message.includes("Foreign key") || error.message.includes("P2003")) {
        return NextResponse.json(
          { error: "Database-feil. Kontakt support." },
          { status: 500 }
        )
      }
      
      // Log full error for debugging
      console.error("Full error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
      
      // Return the actual error message if it's user-friendly
      if (error.message && !error.message.includes("Prisma") && !error.message.includes("P")) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        )
      }
    }
    
    return NextResponse.json(
      { error: "Kunne ikke opprette klubb. Sjekk Vercel-loggene for detaljer." },
      { status: 500 }
    )
  }
}

