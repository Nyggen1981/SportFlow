import { PageLayout } from "@/components/PageLayout"
import { ResourceFilter } from "@/components/ResourceFilter"
import { prisma } from "@/lib/prisma"
import { Building2 } from "lucide-react"
import { isPricingEnabled, hasPricingRules } from "@/lib/pricing"

// Revalidate every hour (3600 seconds) to reduce ISR writes
// Kort cache for at nye fasiliteter vises raskt
export const revalidate = 60 // 1 minutt

// Fetch resources directly (cache removed temporarily to debug)
async function getResources() {
  try {
    const pricingEnabled = await isPricingEnabled()
    const resources = await prisma.resource.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        location: true,
        image: true,
        color: true,
        minBookingMinutes: true,
        maxBookingMinutes: true,
        requiresApproval: true,
        category: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        parts: {
          where: { isActive: true },
          select: {
            id: true,
            name: true
          },
          orderBy: { name: "asc" }
        },
      },
      orderBy: [
        { category: { name: "asc" } },
        { name: "asc" }
      ]
    })

    // Hvis pricing er aktivert, filtrer ut deler uten prisregler
    if (pricingEnabled) {
      for (const resource of resources) {
        const partsWithPricing = []
        for (const part of resource.parts) {
          const hasRules = await hasPricingRules(resource.id, part.id)
          if (hasRules) {
            partsWithPricing.push(part)
          }
        }
        resource.parts = partsWithPricing
      }
    }

    return resources
  } catch (error: any) {
    console.error("Error fetching resources:", error)
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta
    })
    return []
  }
}

// Fetch categories directly (cache removed temporarily to debug)
async function getCategories() {
  try {
    return await prisma.resourceCategory.findMany({
      orderBy: { name: "asc" }
    })
  } catch (error) {
    console.error("Error fetching categories:", error)
    return []
  }
}

export default async function ResourcesPage() {
  const [resources, categories] = await Promise.all([
    getResources(),
    getCategories()
  ])

  // If no resources, show empty state instead of redirecting (to avoid redirect loops)
  if (resources.length === 0) {
    return (
      <PageLayout maxWidth="max-w-7xl">
        <div className="py-16 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Ingen fasiliteter ennå</h2>
          <p className="text-gray-500 mb-6">Det er ingen fasiliteter tilgjengelige for øyeblikket.</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout maxWidth="max-w-7xl">
      <div className="py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
            Fasiliteter
          </h1>
          <p className="text-sm sm:text-base text-gray-500">
            Utforsk alle tilgjengelige fasiliteter og book det du trenger
          </p>
        </div>

      <ResourceFilter 
        categories={categories.map(c => ({
          id: c.id,
          name: c.name,
          color: c.color
        }))}
        resources={resources.map(r => ({
          id: r.id,
          name: r.name,
          description: r.description,
          location: r.location,
          image: r.image,
          minBookingMinutes: r.minBookingMinutes,
          maxBookingMinutes: r.maxBookingMinutes,
          requiresApproval: r.requiresApproval,
          category: r.category ? {
            id: r.category.id,
            name: r.category.name,
            color: r.category.color
          } : null,
          parts: r.parts.map(p => ({ id: p.id, name: p.name }))
        }))}
      />
      </div>
    </PageLayout>
  )
}
