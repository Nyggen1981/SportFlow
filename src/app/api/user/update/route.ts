import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

/**
 * Update user's own information
 * PATCH /api/user/update
 */
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { name, phone } = await request.json()

    const updateData: {
      name?: string
      phone?: string
    } = {}

    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    // isMember kan kun settes av admin via /api/admin/users/[id]

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isMember: true,
        emailVerified: true,
        emailVerifiedAt: true,
        role: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("Error updating user:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update user" },
      { status: 500 }
    )
  }
}

