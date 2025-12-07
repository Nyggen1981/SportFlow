import { Navbar } from "@/components/Navbar"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import Image from "next/image"
import { MapPin, Clock, ArrowRight, Filter } from "lucide-react"

// Disable caching to always show fresh data
export const dynamic = 'force-dynamic'

async function getResources() {
  return prisma.resource.findMany({
    where: { isActive: true },
    include: {
      category: true,
      parts: true,
    },
    orderBy: [
      { category: { name: "asc" } },
      { name: "asc" }
    ]
  })
}

async function getCategories() {
  return prisma.resourceCategory.findMany({
    orderBy: { name: "asc" }
  })
}

export default async function ResourcesPage() {
  const [resources, categories] = await Promise.all([
    getResources(),
    getCategories()
  ])

  // Group resources by category
  const grouped = resources.reduce((acc, resource) => {
    const categoryName = resource.category?.name || "Annet"
    if (!acc[categoryName]) {
      acc[categoryName] = {
        category: resource.category,
        resources: []
      }
    }
    acc[categoryName].resources.push(resource)
    return acc
  }, {} as Record<string, { category: typeof resources[0]["category"], resources: typeof resources }>)

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900">Fasiliteter</h1>
          <p className="text-gray-500 mt-2">
            Utforsk alle tilgjengelige fasiliteter og book din neste treningsøkt
          </p>
        </div>
      </div>

      {/* Category filter */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          <div className="flex items-center gap-2 text-gray-500 text-sm whitespace-nowrap">
            <Filter className="w-4 h-4" />
            Filtrer:
          </div>
          <button className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-medium whitespace-nowrap">
            Alle
          </button>
          {categories.map((category) => (
            <button 
              key={category.id} 
              className="px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:border-blue-300 hover:text-blue-600 transition-colors whitespace-nowrap"
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Resources by category */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {Object.entries(grouped).map(([categoryName, { category, resources: categoryResources }]) => (
          <section key={categoryName} className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${category?.color || '#3b82f6'}20` }}
              >
                <div 
                  className="w-5 h-5 rounded-full"
                  style={{ backgroundColor: category?.color || '#3b82f6' }}
                />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">{categoryName}</h2>
              <span className="px-2 py-1 bg-gray-100 rounded-full text-sm text-gray-500">
                {categoryResources.length} {categoryResources.length === 1 ? 'fasilitet' : 'fasiliteter'}
              </span>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categoryResources.map((resource) => (
                <Link 
                  key={resource.id} 
                  href={`/resources/${resource.id}`}
                  className="card overflow-hidden group hover:shadow-lg transition-all"
                >
                  <div className="h-40 relative">
                    {resource.image ? (
                      <>
                        <Image
                          src={resource.image}
                          alt={resource.name}
                          fill
                          className="object-cover opacity-40 group-hover:opacity-50 transition-opacity"
                        />
                        <div 
                          className="absolute inset-0"
                          style={{ 
                            background: `linear-gradient(135deg, ${resource.category?.color || '#3b82f6'}cc, ${resource.category?.color || '#3b82f6'}88)`
                          }}
                        />
                      </>
                    ) : (
                      <div 
                        className="absolute inset-0"
                        style={{ 
                          background: `linear-gradient(135deg, ${resource.category?.color || '#3b82f6'}ee, ${resource.category?.color || '#3b82f6'}88)`
                        }}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="text-xl font-bold text-white">{resource.name}</h3>
                      {resource.location && (
                        <p className="text-white/80 text-sm flex items-center gap-1 mt-1">
                          <MapPin className="w-4 h-4" />
                          {resource.location}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-5">
                    {resource.description && (
                      <p className="text-gray-600 text-sm line-clamp-2 mb-4">
                        {resource.description}
                      </p>
                    )}

                    {/* Resource parts */}
                    {resource.parts.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Kan bookes:</p>
                        <div className="flex flex-wrap gap-1">
                          {resource.parts.map((part) => (
                            <span 
                              key={part.id} 
                              className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600"
                            >
                              {part.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Booking info */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {resource.minBookingMinutes}-{resource.maxBookingMinutes} min
                        </span>
                        {resource.requiresApproval && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                            Krever godkjenning
                          </span>
                        )}
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

