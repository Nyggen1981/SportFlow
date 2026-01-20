"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { MapPin, Clock, Filter, Building2, CheckCircle } from "lucide-react"

interface Category {
  id: string
  name: string
  color: string | null
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
  parts: Array<{ id: string; name: string }>
}

interface ResourcesHeaderProps {
  categories: Category[]
  resources: Resource[]
}

export function ResourcesHeader({ categories, resources }: ResourcesHeaderProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showFilter, setShowFilter] = useState(false)

  const filteredResources = selectedCategory
    ? resources.filter(r => r.category?.id === selectedCategory)
    : resources

  // Group by category
  const resourcesByCategory = categories
    .map(category => ({
      ...category,
      resources: filteredResources.filter(r => r.category?.id === category.id)
    }))
    .filter(cat => cat.resources.length > 0)

  // Uncategorized resources
  const uncategorized = filteredResources.filter(r => !r.category)

  const activeFilterCount = selectedCategory ? 1 : 0

  return (
    <>
      {/* Mobile Header */}
      <div className="sm:hidden flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-teal-600" />
          <h1 className="text-lg font-bold text-gray-900">Fasiliteter</h1>
        </div>
        <button
          onClick={() => setShowFilter(!showFilter)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeFilterCount > 0
              ? "bg-teal-100 text-teal-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <Filter className="w-4 h-4" />
          Filter
          {activeFilterCount > 0 && (
            <span className="ml-1 bg-teal-600 text-white text-xs px-1.5 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Desktop Header */}
      <div className="hidden sm:block mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Fasiliteter</h1>
        <p className="text-gray-600">Velg en fasilitet for å se tilgjengelighet og booke</p>
      </div>

      {/* Filter Panel */}
      {showFilter && (
        <div className="sm:hidden mb-4 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Kategori</span>
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Nullstill
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(
                  selectedCategory === category.id ? null : category.id
                )}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedCategory === category.id
                    ? "bg-teal-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Desktop Category Filter */}
      <div className="hidden sm:flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !selectedCategory
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Alle
        </button>
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              selectedCategory === category.id
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {category.color && (
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: category.color }}
              />
            )}
            {category.name}
          </button>
        ))}
      </div>

      {/* Resources Grid */}
      {resourcesByCategory.map(category => (
        <div key={category.id} className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            {category.color && (
              <span
                className="w-3 h-3 sm:w-4 sm:h-4 rounded-full"
                style={{ backgroundColor: category.color }}
              />
            )}
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">{category.name}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {category.resources.map(resource => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        </div>
      ))}

      {/* Uncategorized */}
      {uncategorized.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Andre</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {uncategorized.map(resource => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        </div>
      )}

      {filteredResources.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Ingen fasiliteter funnet</p>
        </div>
      )}
    </>
  )
}

function ResourceCard({ resource }: { resource: Resource }) {
  return (
    <Link
      href={`/resources/${resource.id}`}
      className="group block bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
    >
      {/* Image */}
      <div className="relative h-32 sm:h-48 bg-gray-100">
        {resource.image ? (
          <>
            <Image
              src={resource.image}
              alt={resource.name}
              fill
              className="object-cover opacity-50 group-hover:opacity-60 transition-opacity"
            />
            {/* Category color diagonal gradient overlay */}
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
        {/* Bottom gradient for contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        {/* Approval badge */}
        {resource.requiresApproval && (
          <div className="absolute top-2 right-2 px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            <span className="hidden sm:inline">Godkjenning kreves</span>
            <span className="sm:hidden">Godkjenning kreves</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4">
        <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-1">{resource.name}</h3>
        
        {resource.location && (
          <div className="flex items-center gap-1 text-gray-500 text-xs sm:text-sm mb-2">
            <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="truncate">{resource.location}</span>
          </div>
        )}

        {/* Parts preview */}
        {resource.parts.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {resource.parts.slice(0, 2).map(part => (
              <span
                key={part.id}
                className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
              >
                {part.name}
              </span>
            ))}
            {resource.parts.length > 2 && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                +{resource.parts.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
