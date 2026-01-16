"use client"

import { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { MapPin, Clock, ArrowRight } from "lucide-react"

interface Category {
  id: string
  name: string
  color: string
}

interface Resource {
  id: string
  name: string
  description: string | null
  location: string | null
  image: string | null
  minBookingMinutes: number | null
  maxBookingMinutes: number | null
  requiresApproval: boolean
  category: Category | null
  parts: { id: string; name: string }[]
}

interface Props {
  categories: Category[]
  resources: Resource[]
}

export function ResourceFilter({ categories, resources }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Filter resources by selected category - memoized
  const filteredResources = useMemo(() => {
    return selectedCategory
      ? resources.filter(r => r.category?.id === selectedCategory)
      : resources
  }, [selectedCategory, resources])

  // Group filtered resources by category - memoized
  const grouped = useMemo(() => {
    return filteredResources.reduce((acc, resource) => {
      const categoryName = resource.category?.name || "Annet"
      if (!acc[categoryName]) {
        acc[categoryName] = {
          category: resource.category,
          resources: []
        }
      }
      acc[categoryName].resources.push(resource)
      return acc
    }, {} as Record<string, { category: Category | null, resources: Resource[] }>)
  }, [filteredResources])

  // Only show categories that have resources after filtering - memoized
  const visibleCategories = useMemo(() => {
    return Object.keys(grouped).filter(categoryName => grouped[categoryName].resources.length > 0)
  }, [grouped])

  const handleCategorySelect = useCallback((categoryId: string | null) => {
    setSelectedCategory(categoryId)
  }, [])

  return (
    <>
      {/* Category filter - Compact on mobile */}
      <div className="py-2 sm:py-6">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <select
            value={selectedCategory || ""}
            onChange={(e) => handleCategorySelect(e.target.value || null)}
            className="px-2 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle kategorier</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Resources by category */}
      <div className="pb-24 sm:pb-16">
        {visibleCategories.map((categoryName) => {
          const { category, resources: categoryResources } = grouped[categoryName]
          return (
          <section key={categoryName} className="mb-6 sm:mb-12">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-6">
              <div 
                className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${category?.color || '#3b82f6'}20` }}
              >
                <div 
                  className="w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full"
                  style={{ backgroundColor: category?.color || '#3b82f6' }}
                />
              </div>
              <h2 className="text-base sm:text-xl font-semibold text-gray-900">{categoryName}</h2>
              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-100 rounded-full text-xs sm:text-sm text-gray-500">
                {categoryResources.length}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {categoryResources.map((resource) => (
                <Link 
                  key={resource.id} 
                  href={`/resources/${resource.id}`}
                  className="card overflow-hidden group hover:shadow-lg transition-all active:scale-[0.98]"
                >
                  <div className="h-24 sm:h-40 relative">
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
                    <div className="absolute bottom-2 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4">
                      <h3 className="text-base sm:text-xl font-bold text-white">{resource.name}</h3>
                      {resource.location && (
                        <p className="text-white/80 text-xs sm:text-sm flex items-center gap-1 mt-0.5 sm:mt-1">
                          <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                          {resource.location}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-3 sm:p-5">
                    {resource.description && (
                      <p className="text-gray-600 text-sm line-clamp-2 mb-3 sm:mb-4 hidden sm:block">
                        {resource.description}
                      </p>
                    )}

                    {/* Resource parts - show fewer on mobile */}
                    {resource.parts.length > 0 && (
                      <div className="mb-2 sm:mb-4">
                        <div className="flex flex-wrap gap-1">
                          {resource.parts.slice(0, 2).map((part) => (
                            <span 
                              key={part.id} 
                              className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-100 rounded text-[10px] sm:text-xs text-gray-600"
                            >
                              {part.name}
                            </span>
                          ))}
                          {resource.parts.length > 2 && (
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-100 rounded text-[10px] sm:text-xs text-gray-500">
                              +{resource.parts.length - 2}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Booking info */}
                    <div className="flex items-center justify-between pt-2 sm:pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-gray-500">
                        {resource.requiresApproval && (
                          <span className="px-1.5 sm:px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                            Godkjenning kreves
                          </span>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
          )
        })}

        {filteredResources.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Ingen fasiliteter i denne kategorien</p>
          </div>
        )}
      </div>
    </>
  )
}

