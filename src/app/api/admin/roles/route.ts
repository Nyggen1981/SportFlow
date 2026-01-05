import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { 
  getOrganizationRoles, 
  createCustomRole, 
  updateCustomRole, 
  deleteCustomRole 
} from "@/lib/roles"

// GET - Hent alle roller for organisasjonen
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.systemRole !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const roles = await getOrganizationRoles(session.user.organizationId)
    return NextResponse.json(roles)
  } catch (error) {
    console.error("Error fetching roles:", error)
    return NextResponse.json(
      { error: "Kunne ikke hente roller" },
      { status: 500 }
    )
  }
}

// POST - Opprett ny rolle
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.systemRole !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, description, color, hasModeratorAccess, hasMatchSetupAccess } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Rollenavn er påkrevd" },
        { status: 400 }
      )
    }

    const role = await createCustomRole(session.user.organizationId, {
      name: name.trim(),
      description: description?.trim() || null,
      color: color || null,
      hasModeratorAccess: Boolean(hasModeratorAccess),
      hasMatchSetupAccess: Boolean(hasMatchSetupAccess)
    })

    return NextResponse.json(role, { status: 201 })
  } catch (error: any) {
    console.error("Error creating role:", error)
    
    // Håndter unik constraint-feil
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "En rolle med dette navnet eksisterer allerede" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || "Kunne ikke opprette rolle" },
      { status: 500 }
    )
  }
}

