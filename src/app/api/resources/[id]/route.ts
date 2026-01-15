import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { isPricingEnabled, getPricingConfig, findPricingRuleForUser } from "@/lib/pricing"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const pricingEnabled = await isPricingEnabled()
    const session = await getServerSession(authOptions)

    const resource = await prisma.resource.findUnique({
      where: { id },
      include: {
        category: true,
        parts: {
          where: { isActive: true },
          include: {
            parent: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: [
            { parentId: { sort: "asc", nulls: "first" } }, // Parents first
            { name: "asc" }
          ]
        },
      },
    })

    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 })
    }

    // Hvis pricing er aktivert, filtrer ut deler basert på brukerens tilgang
    if (pricingEnabled && resource.parts.length > 0 && session?.user?.id) {
      const accessibleParts = []
      
      for (const part of resource.parts) {
        // Hent pris-konfigurasjon for delen
        const config = await getPricingConfig(id, part.id)
        
        if (!config || config.rules.length === 0) {
          // Ingen prisregler = ingen tilgang når pricing er aktivert
          continue
        }
        
        // Sjekk om brukeren har tilgang basert på prisregler
        const ruleMatch = await findPricingRuleForUser(session.user.id, config.rules)
        
        if (ruleMatch.rule) {
          // Brukeren har en matchende prisregel - gi tilgang
          accessibleParts.push(part)
        } else {
          // Ingen matchende regel - sjekk om det finnes fastprispakker
          const packages = await prisma.fixedPricePackage.findMany({
            where: { resourcePartId: part.id, isActive: true },
            select: { forRoles: true }
          })
          
          if (packages.length > 0) {
            // Sjekk om brukeren har tilgang til minst én pakke
            const user = await prisma.user.findUnique({
              where: { id: session.user.id },
              select: { isMember: true, systemRole: true, customRoleId: true }
            })
            
            const userSystemRole = user?.systemRole || "user"
            const isMember = user?.isMember ?? false
            const customRoleId = user?.customRoleId
            
            const hasPackageAccess = packages.some(pkg => {
              if (!pkg.forRoles) return true
              try {
                const allowedRoles: string[] = JSON.parse(pkg.forRoles)
                if (allowedRoles.length === 0) return true
                if (userSystemRole === "admin" && allowedRoles.includes("admin")) return true
                if (isMember && allowedRoles.includes("member")) return true
                if (!isMember && allowedRoles.includes("user")) return true
                if (customRoleId && allowedRoles.includes(customRoleId)) return true
                return false
              } catch {
                return true
              }
            })
            
            if (hasPackageAccess) {
              accessibleParts.push(part)
            }
          }
        }
      }
      
      resource.parts = accessibleParts
      
      // Sjekk også om brukeren kan booke hele fasiliteten
      if (resource.allowWholeBooking) {
        const wholeResourceConfig = await getPricingConfig(id, null)
        let canBookWholeResource = false
        
        if (wholeResourceConfig && wholeResourceConfig.rules.length > 0) {
          const ruleMatch = await findPricingRuleForUser(session.user.id, wholeResourceConfig.rules)
          if (ruleMatch.rule) {
            canBookWholeResource = true
          }
        }
        
        // Sjekk også fastprispakker for hele fasiliteten
        if (!canBookWholeResource) {
          const wholeResourcePackages = await prisma.fixedPricePackage.findMany({
            where: { resourceId: id, resourcePartId: null, isActive: true },
            select: { forRoles: true }
          })
          
          if (wholeResourcePackages.length > 0) {
            const user = await prisma.user.findUnique({
              where: { id: session.user.id },
              select: { isMember: true, systemRole: true, customRoleId: true }
            })
            
            const userSystemRole = user?.systemRole || "user"
            const isMember = user?.isMember ?? false
            const customRoleId = user?.customRoleId
            
            canBookWholeResource = wholeResourcePackages.some(pkg => {
              if (!pkg.forRoles) return true
              try {
                const allowedRoles: string[] = JSON.parse(pkg.forRoles)
                if (allowedRoles.length === 0) return true
                if (userSystemRole === "admin" && allowedRoles.includes("admin")) return true
                if (isMember && allowedRoles.includes("member")) return true
                if (!isMember && allowedRoles.includes("user")) return true
                if (customRoleId && allowedRoles.includes(customRoleId)) return true
                return false
              } catch {
                return true
              }
            })
          }
        }
        
        // Oppdater allowWholeBooking basert på brukerens tilgang
        ;(resource as any).allowWholeBooking = canBookWholeResource
      }
    }

    return NextResponse.json(resource)
  } catch (error: any) {
    console.error("Error fetching resource by id:", error)
    return NextResponse.json(
      {
        error: "Kunne ikke hente fasilitet",
        details: error?.message || String(error),
      },
      { status: 500 }
    )
  }
}

