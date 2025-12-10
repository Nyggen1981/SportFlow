import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Delete user's own account and all associated data (GDPR - Right to be forgotten)
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  try {
    // Verify user exists and get their organization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        organizationId: true,
        organization: {
          select: {
            users: {
              select: {
                id: true,
                role: true,
              }
            }
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Prevent deletion if user is the only admin in the organization
    if (user.role === "admin") {
      const adminCount = user.organization.users.filter(u => u.role === "admin").length
      if (adminCount === 1) {
        return NextResponse.json(
          { 
            error: "Kan ikke slette konto", 
            message: "Du er den eneste administratoren. Opprett en annen administrator først, eller kontakt support." 
          },
          { status: 400 }
        )
      }
    }

    // Delete user and all associated data (cascade deletes will handle bookings, preferences, etc.)
    await prisma.user.delete({
      where: { id: userId }
    })

    return NextResponse.json({ 
      success: true,
      message: "Din konto og alle tilknyttede data har blitt slettet."
    })
  } catch (error: any) {
    console.error("Error deleting user:", error)
    return NextResponse.json(
      { error: "Failed to delete account", message: error.message },
      { status: 500 }
    )
  }
}

