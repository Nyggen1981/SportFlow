import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { isPricingEnabled, getPricingConfig, findPricingRuleForUser } from "@/lib/pricing"

// API to get pricing info for a specific resource (for the logged-in user)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: resourceId } = await params
  
  try {
    // Check if pricing module is enabled
    const pricingEnabled = await isPricingEnabled()
    if (!pricingEnabled) {
      return NextResponse.json({ enabled: false })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ enabled: true, noSession: true })
    }

    // Get resource with parts
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      select: {
        id: true,
        name: true,
        organizationId: true,
        allowWholeBooking: true,
        visPrislogikk: true,
        parts: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            parentId: true,
            pricingRules: true
          }
        }
      }
    })

    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 })
    }

    // If visPrislogikk is false, don't show pricing
    if (!resource.visPrislogikk) {
      return NextResponse.json({ enabled: true, hidden: true })
    }

    const userId = session.user.id
    const userSystemRole = (session.user as any).systemRole || session.user.role || "user"
    const userRoleId = (session.user as any).customRoleId
    const isMember = (session.user as any).isMember
    const isNonMember = !isMember && userSystemRole !== "admin"

    // Helper function to filter packages by user role
    const filterPackagesByRole = <T extends { forRoles: string | null }>(packages: T[]): T[] => {
      return packages.filter(pkg => {
        if (!pkg.forRoles) {
          return userSystemRole !== "admin"
        }
        try {
          const allowedRoles: string[] = JSON.parse(pkg.forRoles)
          if (allowedRoles.length === 0) {
            return userSystemRole !== "admin"
          }
          
          if (userSystemRole === "admin") {
            return allowedRoles.includes("admin")
          }
          
          if (userRoleId && allowedRoles.includes(userRoleId)) return true
          if (isMember && allowedRoles.includes("member")) return true
          if (!userRoleId && !isMember && allowedRoles.includes("user")) return true
          
          return false
        } catch {
          return userSystemRole !== "admin"
        }
      })
    }

    // Helper to find member packages
    const filterMemberPackages = <T extends { forRoles: string | null }>(packages: T[]): T[] => {
      return packages.filter(pkg => {
        if (!pkg.forRoles) return false
        try {
          const allowedRoles: string[] = JSON.parse(pkg.forRoles)
          return allowedRoles.includes("member")
        } catch {
          return false
        }
      })
    }

    // Helper to find member price for a package
    const findMemberPriceForPackage = <T extends { name: string; price: any; forRoles: string | null }>(
      pkg: T,
      allPackages: T[]
    ): number | null => {
      const memberPackages = filterMemberPackages(allPackages)
      const matchingPackage = memberPackages.find(mp => mp.name === pkg.name)
      return matchingPackage ? Number(matchingPackage.price) : null
    }

    // Helper to find member rule
    const findMemberRule = (rules: any[]): any | null => {
      if (!Array.isArray(rules)) return null
      return rules.find(r => r.forRoles?.includes("member")) || null
    }

    const partIds = resource.parts.map(p => p.id)

    // Parallel queries for performance
    const [
      customRoles,
      wholeResourcePackages,
      allPartPackages,
      pricingConfig
    ] = await Promise.all([
      // Custom roles
      prisma.customRole.findMany({
        where: { organizationId: resource.organizationId },
        select: { id: true, name: true }
      }),
      // Whole resource packages
      resource.allowWholeBooking
        ? prisma.fixedPricePackage.findMany({
            where: { resourceId, resourcePartId: null, isActive: true },
            select: { id: true, name: true, description: true, durationMinutes: true, price: true, forRoles: true },
            orderBy: { sortOrder: "asc" }
          })
        : Promise.resolve([]),
      // Part packages
      partIds.length > 0
        ? prisma.fixedPricePackage.findMany({
            where: { resourcePartId: { in: partIds }, isActive: true },
            select: { id: true, name: true, description: true, durationMinutes: true, price: true, forRoles: true, resourcePartId: true },
            orderBy: { sortOrder: "asc" }
          })
        : Promise.resolve([]),
      // Pricing config for whole resource
      resource.allowWholeBooking ? getPricingConfig(resourceId, null) : Promise.resolve(null)
    ])

    // Find relevant rule for whole resource
    let relevantRule: any = null
    let memberRule: any = null
    
    if (resource.allowWholeBooking && pricingConfig?.rules) {
      const ruleResult = await findPricingRuleForUser(userId, pricingConfig.rules)
      relevantRule = ruleResult?.rule || null
      if (isNonMember) {
        memberRule = findMemberRule(pricingConfig.rules)
      }
    }

    // Filter and format whole resource packages
    const resourceFixedPackages = filterPackagesByRole(wholeResourcePackages).map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      durationMinutes: pkg.durationMinutes,
      price: Number(pkg.price),
      memberPrice: isNonMember ? findMemberPriceForPackage(pkg, wholeResourcePackages) : null
    }))

    // Group part packages by partId
    const packagesByPartId = new Map<string, typeof allPartPackages>()
    for (const pkg of allPartPackages) {
      if (!pkg.resourcePartId) continue
      const existing = packagesByPartId.get(pkg.resourcePartId) || []
      existing.push(pkg)
      packagesByPartId.set(pkg.resourcePartId, existing)
    }

    // Process parts pricing
    const partsPricing: Array<{
      partId: string
      partName: string
      parentId: string | null
      rule: any
      fixedPackages: any[]
      memberRule: any
    }> = []

    for (const part of resource.parts) {
      const partPackages = packagesByPartId.get(part.id) || []
      
      const fixedPackages = filterPackagesByRole(partPackages).map(pkg => ({
        id: pkg.id,
        name: pkg.name,
        description: pkg.description,
        durationMinutes: pkg.durationMinutes,
        price: Number(pkg.price),
        memberPrice: isNonMember ? findMemberPriceForPackage(pkg, partPackages) : null
      }))

      let partRule: any = null
      let partMemberRule: any = null

      if (part.pricingRules) {
        try {
          const rules = JSON.parse(part.pricingRules as string)
          if (Array.isArray(rules) && rules.length > 0) {
            const ruleResult = await findPricingRuleForUser(userId, rules)
            partRule = ruleResult?.rule || null
            if (isNonMember) {
              partMemberRule = findMemberRule(rules)
            }
          }
        } catch {
          // Ignore parse errors
        }
      }

      if (partRule || fixedPackages.length > 0) {
        partsPricing.push({
          partId: part.id,
          partName: part.name,
          parentId: part.parentId,
          rule: partRule,
          fixedPackages,
          memberRule: partMemberRule
        })
      }
    }

    // Sort parts hierarchically
    const sortedPartsPricing = partsPricing.sort((a, b) => {
      if (!a.parentId && b.parentId) return -1
      if (a.parentId && !b.parentId) return 1
      return a.partName.localeCompare(b.partName, 'no')
    })

    return NextResponse.json({
      enabled: true,
      allowWholeBooking: resource.allowWholeBooking,
      relevantRule,
      resourceFixedPackages,
      partsPricing: sortedPartsPricing,
      customRoles,
      isNonMember,
      memberRule
    })
  } catch (error) {
    console.error("[Resource Pricing API] Error:", error)
    return NextResponse.json({ error: "Failed to fetch pricing" }, { status: 500 })
  }
}
