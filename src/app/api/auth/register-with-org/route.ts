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
      const existingCategories = await tx.resourceCategory.count()
      if (existingCategories === 0) {
        await tx.resourceCategory.createMany({
          data: [
            { name: "Utendørs", description: "Utendørs fasiliteter", icon: "Sun", color: "#22c55e" },
            { name: "Innendørs", description: "Innendørs fasiliteter", icon: "Home", color: "#3b82f6" },
            { name: "Møterom", description: "Møterom og sosiale rom", icon: "Users", color: "#f59e0b" },
            { name: "Utstyr", description: "Utstyr som kan lånes", icon: "Package", color: "#8b5cf6" }
          ]
        })
      }

      // Create admin user
      const user = await tx.user.create({
        data: {
          email,
          name,
          phone,
          password: hashedPassword,
          role: "admin",
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
    return NextResponse.json(
      { error: "Kunne ikke opprette klubb. Prøv igjen." },
      { status: 500 }
    )
  }
}

