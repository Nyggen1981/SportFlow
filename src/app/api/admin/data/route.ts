import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import bcrypt from "bcryptjs"

// Export all data for the organization
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const organizationId = session.user.organizationId

  // Fetch all data
  const [organization, users, categories, resources, bookings] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId }
    }),
    prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        isApproved: true,
        createdAt: true
      }
    }),
    prisma.resourceCategory.findMany(),
    prisma.resource.findMany({
      where: { organizationId },
      include: {
        parts: true
      }
    }),
    prisma.booking.findMany({
      where: { organizationId },
      include: {
        resource: { select: { name: true } },
        resourcePart: { select: { name: true } },
        user: { select: { name: true, email: true } }
      }
    })
  ])

  const exportData = {
    exportedAt: new Date().toISOString(),
    organizationName: organization?.name,
    data: {
      organization,
      users,
      categories,
      resources,
      bookings
    }
  }

  return NextResponse.json(exportData)
}

// Import data for the organization
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const importData = await request.json()
    const organizationId = session.user.organizationId

    const { categories, resources, users, bookings } = importData.data || importData

    let categoriesCreated = 0
    let resourcesCreated = 0
    let usersCreated = 0
    let bookingsCreated = 0

    // Import categories
    if (categories && Array.isArray(categories)) {
      for (const category of categories) {
        const existing = await prisma.resourceCategory.findFirst({
          where: { name: category.name }
        })
        if (!existing) {
          await prisma.resourceCategory.create({
            data: {
              name: category.name,
              description: category.description,
              icon: category.icon,
              color: category.color || "#3b82f6"
            }
          })
          categoriesCreated++
        }
      }
    }

    // Import resources
    if (resources && Array.isArray(resources)) {
      for (const resource of resources) {
        const existing = await prisma.resource.findFirst({
          where: { 
            name: resource.name,
            organizationId
          }
        })
        if (!existing) {
          // Find or create category
          let categoryId = null
          if (resource.category?.name) {
            const cat = await prisma.resourceCategory.findFirst({
              where: { name: resource.category.name }
            })
            categoryId = cat?.id
          }

          const newResource = await prisma.resource.create({
            data: {
              name: resource.name,
              description: resource.description,
              location: resource.location,
              image: resource.image,
              color: resource.color,
              isActive: resource.isActive ?? true,
              blockPartsWhenWholeBooked: resource.blockPartsWhenWholeBooked ?? true,
              blockWholeWhenPartBooked: resource.blockWholeWhenPartBooked ?? true,
              minBookingMinutes: resource.minBookingMinutes ?? 60,
              maxBookingMinutes: resource.maxBookingMinutes ?? 240,
              requiresApproval: resource.requiresApproval ?? true,
              advanceBookingDays: resource.advanceBookingDays ?? 30,
              openingHours: resource.openingHours,
              organizationId,
              categoryId
            }
          })

          // Import parts
          if (resource.parts && Array.isArray(resource.parts)) {
            for (const part of resource.parts) {
              await prisma.resourcePart.create({
                data: {
                  name: part.name,
                  description: part.description,
                  capacity: part.capacity,
                  isActive: part.isActive ?? true,
                  resourceId: newResource.id
                }
              })
            }
          }

          resourcesCreated++
        }
      }
    }

    // Import users (without passwords - they'll need to reset)
    if (users && Array.isArray(users)) {
      for (const user of users) {
        const normalizedImportEmail = user.email?.toLowerCase().trim()
        // Skip if same email as current user
        if (normalizedImportEmail === session.user.email?.toLowerCase()) continue
        
        const existing = await prisma.user.findUnique({
          where: { email: normalizedImportEmail }
        })
        if (!existing) {
          // Create with a random password (user needs to reset)
          const tempPassword = await bcrypt.hash(Math.random().toString(36), 10)
          await prisma.user.create({
            data: {
              email: normalizedImportEmail,
              name: user.name,
              password: tempPassword,
              role: user.role || "user",
              phone: user.phone,
              isApproved: user.isApproved ?? false,
              organizationId
            }
          })
          usersCreated++
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported: {
        categories: categoriesCreated,
        resources: resourcesCreated,
        users: usersCreated,
        bookings: bookingsCreated
      },
      message: `Importert: ${categoriesCreated} kategorier, ${resourcesCreated} fasiliteter, ${usersCreated} brukere`
    })
  } catch (error) {
    console.error("Import error:", error)
    return NextResponse.json(
      { error: "Kunne ikke importere data. Sjekk at formatet er korrekt." },
      { status: 400 }
    )
  }
}

