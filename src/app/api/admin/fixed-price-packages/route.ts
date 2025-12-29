import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isPricingEnabled } from "@/lib/pricing"

// GET - Get all fixed price packages for a resource/part
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

    const packages = await prisma.fixedPricePackage.findMany({
      where: {
        ...(resourceId && !resourcePartId ? { resourceId, resourcePartId: null } : {}),
        ...(resourcePartId ? { resourcePartId } : {}),
        organizationId: session.user.organizationId
      },
      orderBy: { sortOrder: "asc" }
    })

    // Parse forRoles from JSON string to array for each package
    const packagesWithParsedRoles = packages.map(pkg => ({
      ...pkg,
      forRoles: pkg.forRoles ? JSON.parse(pkg.forRoles) : []
    }))

    return NextResponse.json(packagesWithParsedRoles)
  } catch (error) {
    console.error("Error fetching fixed price packages:", error)
    return NextResponse.json(
      { error: "Failed to fetch fixed price packages" },
      { status: 500 }
    )
  }
}

// POST - Create or update fixed price packages for a resource/part
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Check if pricing module is enabled
    const pricingEnabled = await isPricingEnabled()
    if (!pricingEnabled) {
      return NextResponse.json(
        { error: "Pricing module is not enabled" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { resourceId, resourcePartId, packages } = body

    if (!resourceId && !resourcePartId) {
      return NextResponse.json(
        { error: "resourceId or resourcePartId is required" },
        { status: 400 }
      )
    }

    if (!Array.isArray(packages)) {
      return NextResponse.json(
        { error: "packages must be an array" },
        { status: 400 }
      )
    }

    // Validate each package
    for (const pkg of packages) {
      if (!pkg.name || typeof pkg.name !== "string" || pkg.name.trim() === "") {
        return NextResponse.json(
          { error: "Each package must have a name" },
          { status: 400 }
        )
      }
      if (typeof pkg.durationMinutes !== "number" || pkg.durationMinutes < 15) {
        return NextResponse.json(
          { error: "Each package must have a duration of at least 15 minutes" },
          { status: 400 }
        )
      }
      if (typeof pkg.price !== "number" || pkg.price < 0) {
        return NextResponse.json(
          { error: "Each package must have a non-negative price" },
          { status: 400 }
        )
      }
    }

    // Get existing packages
    const existingPackages = await prisma.fixedPricePackage.findMany({
      where: {
        ...(resourceId && !resourcePartId ? { resourceId, resourcePartId: null } : {}),
        ...(resourcePartId ? { resourcePartId } : {}),
        organizationId: session.user.organizationId
      }
    })

    const existingIds = existingPackages.map((p) => p.id)
    const newIds = packages.filter((p: { id?: string }) => p.id).map((p: { id: string }) => p.id)
    const toDelete = existingIds.filter((id) => !newIds.includes(id))

    // Delete removed packages
    if (toDelete.length > 0) {
      await prisma.fixedPricePackage.deleteMany({
        where: { id: { in: toDelete } }
      })
    }

    // Update existing and create new packages
    const results = []
    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i]
      // Handle forRoles - store as JSON string if provided
      const forRolesJson = pkg.forRoles && Array.isArray(pkg.forRoles) && pkg.forRoles.length > 0
        ? JSON.stringify(pkg.forRoles)
        : null
      
      const data = {
        name: pkg.name.trim(),
        description: pkg.description?.trim() || null,
        durationMinutes: pkg.durationMinutes,
        price: pkg.price,
        isActive: pkg.isActive !== false,
        sortOrder: i,
        forRoles: forRolesJson,
        resourceId: resourcePartId ? null : resourceId,
        resourcePartId: resourcePartId || null,
        organizationId: session.user.organizationId
      }

      if (pkg.id && existingIds.includes(pkg.id)) {
        // Update existing
        const updated = await prisma.fixedPricePackage.update({
          where: { id: pkg.id },
          data
        })
        results.push(updated)
      } else {
        // Create new
        const created = await prisma.fixedPricePackage.create({
          data
        })
        results.push(created)
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error("Error saving fixed price packages:", error)
    return NextResponse.json(
      { error: "Failed to save fixed price packages" },
      { status: 500 }
    )
  }
}

