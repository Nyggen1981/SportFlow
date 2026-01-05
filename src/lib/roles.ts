import { prisma } from "./prisma"

export interface RoleInfo {
  isAdmin: boolean
  isModerator: boolean
  hasMatchSetupAccess: boolean
  isUser: boolean
  customRole: {
    id: string
    name: string
    description: string | null
    color: string | null
    hasModeratorAccess: boolean
    hasMatchSetupAccess: boolean
  } | null
  roleName: string // "Admin", "Bruker", eller custom role name
  systemRole: "admin" | "user"
}

/**
 * Henter rolleinformasjon for en bruker
 * Sjekker både systemroller og egendefinerte roller
 */
export async function getUserRoleInfo(
  userId: string
): Promise<RoleInfo> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { 
      customRole: true,
      organization: true
    }
  })
  
  if (!user) {
    throw new Error("User not found")
  }
  
  // Systemrolle: Admin
  if (user.systemRole === "admin") {
    return {
      isAdmin: true,
      isModerator: true, // Admin kan alltid moderere
      hasMatchSetupAccess: true, // Admin har alltid tilgang
      isUser: false,
      customRole: null,
      roleName: "Admin",
      systemRole: "admin"
    }
  }
  
  // Systemrolle: User (uten custom role)
  if (user.systemRole === "user" && !user.customRole) {
    return {
      isAdmin: false,
      isModerator: false,
      hasMatchSetupAccess: false,
      isUser: true,
      customRole: null,
      roleName: "Bruker",
      systemRole: "user"
    }
  }
  
  // Egendefinert rolle
  if (user.customRole) {
    return {
      isAdmin: false,
      isModerator: user.customRole.hasModeratorAccess,
      hasMatchSetupAccess: user.customRole.hasMatchSetupAccess,
      isUser: false,
      customRole: {
        id: user.customRole.id,
        name: user.customRole.name,
        description: user.customRole.description,
        color: user.customRole.color,
        hasModeratorAccess: user.customRole.hasModeratorAccess,
        hasMatchSetupAccess: user.customRole.hasMatchSetupAccess
      },
      roleName: user.customRole.name,
      systemRole: user.systemRole as "admin" | "user"
    }
  }
  
  // Fallback
  return {
    isAdmin: false,
    isModerator: false,
    hasMatchSetupAccess: false,
    isUser: true,
    customRole: null,
    roleName: "Bruker",
    systemRole: "user"
  }
}

/**
 * Sjekker om en bruker er admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const roleInfo = await getUserRoleInfo(userId)
  return roleInfo.isAdmin
}

/**
 * Sjekker om en bruker kan moderere (admin eller custom role med moderator-tilgang)
 */
export async function canModerate(userId: string): Promise<boolean> {
  const roleInfo = await getUserRoleInfo(userId)
  return roleInfo.isModerator
}

/**
 * Sjekker om en bruker har tilgang til kampoppsett-administrasjon
 */
export async function canAccessMatchSetup(userId: string): Promise<boolean> {
  const roleInfo = await getUserRoleInfo(userId)
  return roleInfo.isAdmin || roleInfo.hasMatchSetupAccess
}

/**
 * Henter alle roller for en organisasjon
 */
export async function getOrganizationRoles(organizationId: string) {
  return await prisma.customRole.findMany({
    where: { organizationId },
    include: {
      _count: {
        select: { users: true }
      }
    },
    orderBy: { name: "asc" }
  })
}

/**
 * Oppretter en ny custom role
 */
export async function createCustomRole(
  organizationId: string,
  data: {
    name: string
    description?: string | null
    color?: string | null
    hasModeratorAccess: boolean
    hasMatchSetupAccess?: boolean
  }
) {
  return await prisma.customRole.create({
    data: {
      ...data,
      organizationId
    }
  })
}

/**
 * Oppdaterer en custom role
 */
export async function updateCustomRole(
  roleId: string,
  organizationId: string,
  data: {
    name?: string
    description?: string | null
    color?: string | null
    hasModeratorAccess?: boolean
    hasMatchSetupAccess?: boolean
  }
) {
  // Sjekk at rollen tilhører organisasjonen
  const role = await prisma.customRole.findFirst({
    where: { 
      id: roleId,
      organizationId 
    }
  })
  
  if (!role) {
    throw new Error("Role not found or access denied")
  }
  
  return await prisma.customRole.update({
    where: { id: roleId },
    data
  })
}

/**
 * Sletter en custom role
 */
export async function deleteCustomRole(
  roleId: string,
  organizationId: string
) {
  // Sjekk at rollen tilhører organisasjonen
  const role = await prisma.customRole.findFirst({
    where: { 
      id: roleId,
      organizationId 
    },
    include: {
      _count: {
        select: { users: true }
      }
    }
  })
  
  if (!role) {
    throw new Error("Role not found or access denied")
  }
  
  if (role._count.users > 0) {
    throw new Error("Cannot delete role with assigned users")
  }
  
  return await prisma.customRole.delete({
    where: { id: roleId }
  })
}

