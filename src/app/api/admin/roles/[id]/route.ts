import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { updateCustomRole, deleteCustomRole } from "@/lib/roles"

// PUT - Oppdater rolle
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.systemRole !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, color, hasModeratorAccess, hasMatchSetupAccess } = body

    const role = await updateCustomRole(id, session.user.organizationId, {
      name: name?.trim(),
      description: description?.trim() || null,
      color: color || null,
      hasModeratorAccess: hasModeratorAccess !== undefined ? Boolean(hasModeratorAccess) : undefined,
      hasMatchSetupAccess: hasMatchSetupAccess !== undefined ? Boolean(hasMatchSetupAccess) : undefined
    })

    return NextResponse.json(role)
  } catch (error: any) {
    console.error("Error updating role:", error)
    
    if (error.message?.includes("not found")) {
      return NextResponse.json(
        { error: "Rolle ikke funnet" },
        { status: 404 }
      )
    }

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "En rolle med dette navnet eksisterer allerede" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || "Kunne ikke oppdatere rolle" },
      { status: 500 }
    )
  }
}

// DELETE - Slett rolle
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.systemRole !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    await deleteCustomRole(id, session.user.organizationId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting role:", error)
    
    if (error.message?.includes("not found")) {
      return NextResponse.json(
        { error: "Rolle ikke funnet" },
        { status: 404 }
      )
    }

    if (error.message?.includes("assigned users")) {
      return NextResponse.json(
        { error: "Kan ikke slette rolle som har tildelte brukere" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || "Kunne ikke slette rolle" },
      { status: 500 }
    )
  }
}

