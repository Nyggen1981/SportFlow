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
        
        // "member" = verified member (isMember: true)
        // "user" = logged in but NOT verified member (isMember: false)
        // When membership is verified, user transitions from "user" to "member"
        if (isMember && allowedRoles.includes("member")) return true
        if (!isMember && allowedRoles.includes("user")) return true
        
        // Check custom role ID
        if (userRoleId && allowedRoles.includes(userRoleId)) return true
        
        return false
      } catch {
        // If parsing fails, allow access for non-admin only
        return userSystemRole !== "admin"
      }
    })

    // Remove forRoles from response (not needed for client)
    const cleanedPackages = filteredPackages.map(({ forRoles, ...rest }) => rest)

    return NextResponse.json(cleanedPackages)
  } catch (error) {
    console.error("Error fetching fixed price packages:", error)
    return NextResponse.json(
      { error: "Failed to fetch fixed price packages" },
      { status: 500 }
    )
  }
}

