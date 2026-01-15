import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import bcrypt from "bcryptjs"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.systemRole !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const users = await prisma.user.findMany({
    where: { organizationId: session.user.organizationId },
    select: {
      id: true,
      email: true,
      name: true,
      systemRole: true,
      customRoleId: true,
      customRole: {
        select: {
          id: true,
          name: true,
          description: true,
          color: true,
          hasModeratorAccess: true
        }
      },
      role: true, // Legacy
      phone: true,
      isApproved: true,
      approvedAt: true,
      emailVerified: true,
      emailVerifiedAt: true,
      isMember: true,
      createdAt: true,
      _count: {
        select: { bookings: true }
      },
      moderatedResources: {
        select: {
          resource: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    },
    orderBy: [
      { isApproved: "asc" },
      { systemRole: "asc" },
      { name: "asc" }
    ]
  })

  return NextResponse.json(users)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.systemRole !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { email, name, password, systemRole, customRoleId, phone } = await request.json()

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "E-postadressen er allerede i bruk" }, { status: 400 })
  }

  // Valider customRoleId hvis satt
  let finalSystemRole = systemRole || "user"
  let finalCustomRoleId: string | null = null
  let finalRole = "user" // Legacy

  if (customRoleId) {
    const customRole = await prisma.customRole.findFirst({
      where: {
        id: customRoleId,
        organizationId: session.user.organizationId
      }
    })
    if (!customRole) {
      return NextResponse.json({ error: "Ugyldig rolle" }, { status: 400 })
    }
    finalSystemRole = "user" // Custom roles bruker systemRole "user"
    finalCustomRoleId = customRoleId
    finalRole = customRoleId // Legacy
  } else if (systemRole === "admin") {
    finalRole = "admin"
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      systemRole: finalSystemRole,
      customRoleId: finalCustomRoleId,
      role: finalRole, // Legacy
      phone,
      isApproved: true, // Users added by admin are auto-approved
      approvedAt: new Date(),
      emailVerified: finalSystemRole === "admin", // Admin-brukere er automatisk verifisert
      emailVerifiedAt: finalSystemRole === "admin" ? new Date() : null,
      organizationId: session.user.organizationId
    },
    select: {
      id: true,
      email: true,
      name: true,
      systemRole: true,
      customRoleId: true,
      customRole: {
        select: {
          id: true,
          name: true
        }
      },
      role: true // Legacy
    }
  })

  return NextResponse.json(user, { status: 201 })
}

