import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isPricingEnabled } from "@/lib/pricing"

// GET - Get available fixed price packages for a resource/part (public endpoint for booking)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if pricing is enabled
    const pricingEnabled = await isPricingEnabled()
    if (!pricingEnabled) {
      return NextResponse.json([])
    }

    const { searchParams } = new URL(request.url)
    const resourceId = searchParams.get("resourceId")
    const resourcePartId = searchParams.get("resourcePartId")

    if (!resourceId && !resourcePartId) {
      return NextResponse.json(
        { error: "resourceId or resourcePartId is required" },
        { status: 400 }
      )
    }

    // Fetch active packages only
    const packages = await prisma.fixedPricePackage.findMany({
      where: {
        ...(resourceId && !resourcePartId ? { resourceId, resourcePartId: null } : {}),
        ...(resourcePartId ? { resourcePartId } : {}),
        organizationId: session.user.organizationId,
        isActive: true
      },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        price: true,
        isActive: true,
        forRoles: true
      }
    })

    // Filter packages based on user's role
    const userSystemRole = (session.user as any).systemRole || session.user.role // "admin" or "user"
    const userRoleId = (session.user as any).customRoleId // Custom role ID if any
    const isMember = (session.user as any).isMember // Member status
    
    // Check if user is non-member (not verified member and not admin)
    const isNonMember = !isMember && userSystemRole !== "admin"

    const filteredPackages = packages.filter(pkg => {
      // VIKTIG: Admin skal KUN se pakker der "admin" er eksplisitt valgt - ingen fallback
      
      // If no forRoles specified, package is available for all EXCEPT admin
      if (!pkg.forRoles) {
        return userSystemRole !== "admin"
      }
      
      try {
        const allowedRoles: string[] = JSON.parse(pkg.forRoles)
        
        // If empty array, available for all EXCEPT admin
        if (allowedRoles.length === 0) {
          return userSystemRole !== "admin"
        }
        
        // Admin sjekkes først og får IKKE fallback til andre roller
        if (userSystemRole === "admin") {
          return allowedRoles.includes("admin")
        }
        
        // PRIORITET FOR VANLIGE BRUKERE:
        // 1. Custom role (f.eks. Lagleder, Trener) - sjekkes FØRST
        // 2. Verifisert medlem (isMember: true)
        // 3. Ikke-medlem ("user") - KUN hvis ingen custom role
        
        // 1. Sjekk custom role først - brukere med custom role skal IKKE falle tilbake til "user"
        if (userRoleId && allowedRoles.includes(userRoleId)) return true
        
        // 2. Sjekk om bruker er verifisert medlem
        if (isMember && allowedRoles.includes("member")) return true
        
        // 3. Sjekk "user" (ikke-medlem) KUN hvis bruker ikke har custom role
        // Dette forhindrer at f.eks. en Lagleder ser "ikke medlem"-priser
        if (!userRoleId && !isMember && allowedRoles.includes("user")) return true
        
        return false
      } catch {
        // If parsing fails, allow access for non-admin only
        return userSystemRole !== "admin"
      }
    })

    // For non-members, find member prices for comparison
    let memberPackagesMap: Map<string, number> = new Map()
    
    if (isNonMember) {
      // Find packages available to members for the same resource/part
      const allPackagesForResource = await prisma.fixedPricePackage.findMany({
        where: {
          ...(resourceId && !resourcePartId ? { resourceId, resourcePartId: null } : {}),
          ...(resourcePartId ? { resourcePartId } : {}),
          organizationId: session.user.organizationId,
          isActive: true
        },
        select: {
          name: true,
          durationMinutes: true,
          price: true,
          forRoles: true
        }
      })
      
      // Build map of member prices by name+duration
      allPackagesForResource.forEach(pkg => {
        try {
          const allowedRoles: string[] = pkg.forRoles ? JSON.parse(pkg.forRoles) : []
          if (allowedRoles.includes("member")) {
            const key = `${pkg.name}-${pkg.durationMinutes}`
            memberPackagesMap.set(key, Number(pkg.price))
          }
        } catch {}
      })
    }
    
    // Remove forRoles from response and add memberPrice for non-members
    const cleanedPackages = filteredPackages.map(({ forRoles, ...rest }) => {
      const key = `${rest.name}-${rest.durationMinutes}`
      const memberPrice = isNonMember ? memberPackagesMap.get(key) : undefined
      const userPrice = Number(rest.price)
      
      return {
        ...rest,
        // Only include memberPrice if it's lower than user's price
        memberPrice: memberPrice && memberPrice < userPrice ? memberPrice : undefined
      }
    })

    return NextResponse.json(cleanedPackages)
  } catch (error) {
    console.error("Error fetching fixed price packages:", error)
    return NextResponse.json(
      { error: "Failed to fetch fixed price packages" },
      { status: 500 }
    )
  }
}

