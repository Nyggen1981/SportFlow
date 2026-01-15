import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.systemRole !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { systemRole, customRoleId, name, phone, isApproved, emailVerified, isMember } = await request.json()

  const user = await prisma.user.findUnique({ 
    where: { id },
    include: { customRole: true }
  })

  if (!user || user.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Prevent changing own role
  if (id === session.user.id && systemRole && systemRole !== session.user.systemRole) {
    return NextResponse.json({ error: "Kan ikke endre egen rolle" }, { status: 400 })
  }

  // Build update data
  const updateData: {
    systemRole?: "admin" | "user"
    customRoleId?: string | null
    role?: string // Legacy field - settes automatisk
    name?: string
    phone?: string | null
    isApproved?: boolean
    approvedAt?: Date | null
    emailVerified?: boolean
    emailVerifiedAt?: Date | null
    isMember?: boolean
  } = {}

  if (systemRole !== undefined) {
    updateData.systemRole = systemRole
    // Sett role for bakoverkompatibilitet
    if (systemRole === "admin") {
      updateData.role = "admin"
      updateData.customRoleId = null // Admin kan ikke ha custom role
    } else if (systemRole === "user") {
      // Hvis customRoleId ikke er satt, sett role til "user"
      if (customRoleId === undefined || customRoleId === null) {
        updateData.role = "user"
        updateData.customRoleId = null
      }
    }
  }

  if (customRoleId !== undefined) {
    // Valider at customRoleId tilhører organisasjonen
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
      updateData.customRoleId = customRoleId
      updateData.role = customRoleId // Legacy: sett role til customRoleId
    } else {
      updateData.customRoleId = null
      if (systemRole === "user") {
        updateData.role = "user"
      }
    }
  }

  if (name !== undefined) updateData.name = name
  if (phone !== undefined) updateData.phone = phone
  if (isApproved !== undefined) {
    updateData.isApproved = isApproved
    updateData.approvedAt = isApproved ? new Date() : null
  }
  if (emailVerified !== undefined) {
    updateData.emailVerified = emailVerified
    updateData.emailVerifiedAt = emailVerified ? new Date() : null
  }
  if (isMember !== undefined) updateData.isMember = isMember

  // Hvis brukeren får en rolle uten moderator-tilgang, fjern resource assignments
  const newSystemRole = systemRole !== undefined ? systemRole : user.systemRole
  const newCustomRoleId = customRoleId !== undefined ? customRoleId : user.customRoleId
  
  // Sjekk om brukeren mister moderator-tilgang
  const hadModeratorAccess = user.systemRole === "admin" || user.customRole?.hasModeratorAccess
  const willHaveModeratorAccess = newSystemRole === "admin" || 
    (newCustomRoleId && (await prisma.customRole.findUnique({ where: { id: newCustomRoleId } }))?.hasModeratorAccess)
  
  if (hadModeratorAccess && !willHaveModeratorAccess) {
    await prisma.resourceModerator.deleteMany({
      where: { userId: id }
    })
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
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
          hasModeratorAccess: true
        }
      },
      role: true, // Legacy
      isApproved: true,
      isMember: true
    }
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.systemRole !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Prevent self-deletion
  if (id === session.user.id) {
    return NextResponse.json({ error: "Kan ikke slette egen bruker" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id } })

  if (!user || user.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.user.delete({ where: { id } })

  return NextResponse.json({ success: true })
}

