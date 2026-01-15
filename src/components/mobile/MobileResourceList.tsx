"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { MapPin, Clock, Users, ChevronRight, Loader2, Search } from "lucide-react"

interface Resource {
  id: string
  name: string
  description?: string | null
  address?: string | null
  imageUrl?: string | null
  minBookingMinutes?: number | null
  maxBookingMinutes?: number | null
  category?: {
    id: string
    name: string
    color: string | null
  } | null
  parts?: Array<{
    id: string
    name: string
  }>
}

interface Category {
  id: string
  name: string
  color: string | null
}

export function MobileResourceList() {
  const [resources, setResources] = useState<Resource[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/resources")
        if (res.ok) {
          const data = await res.json()
          setResources(data)
          
          // Extract unique categories
          const uniqueCategories = new Map<string, Category>()
          data.forEach((r: Resource) => {
            if (r.category) {
              uniqueCategories.set(r.category.id, r.category)
            }
          })
          setCategories(Array.from(uniqueCategories.values()))
        }
      } catch (error) {
        console.error("Error fetching resources:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // Filter resources
  const filteredResources = resources.filter((r) => {
    const matchesCategory = !selectedCategory || r.category?.id === selectedCategory
    const matchesSearch = !searchQuery || 
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-3 bg-white border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Søk fasiliteter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-0 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="flex overflow-x-auto scrollbar-hide px-3 py-2 gap-2 bg-white border-b border-gray-100">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === null
                ? "bg-teal-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Alle
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === cat.id
                  ? "text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              style={selectedCategory === cat.id ? { backgroundColor: cat.color || "#0d9488" } : {}}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Resource list */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {filteredResources.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <p className="text-sm">Ingen fasiliteter funnet</p>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {filteredResources.map((resource) => (
              <Link
                key={resource.id}
                href={`/resources/${resource.id}`}
                className="block bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Image */}
                {resource.imageUrl ? (
                  <div className="relative h-32 bg-gray-200">
                    <Image
                      src={resource.imageUrl}
                      alt={resource.name}
                      fill
                      className="object-cover"
                    />
                    {resource.category && (
                      <span
                        className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: resource.category.color || "#6b7280" }}
                      >
                        {resource.category.name}
                      </span>
                    )}
                  </div>
                ) : (
                  <div
                    className="h-20 flex items-center justify-center"
                    style={{ backgroundColor: resource.category?.color || "#e5e7eb" }}
                  >
                    {resource.category && (
                      <span className="text-white text-sm font-medium">
                        {resource.category.name}
                      </span>
                    )}
                  </div>
                )}

                {/* Content */}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {resource.name}
                      </h3>
                      
                      {resource.address && (
                        <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{resource.address}</span>
                        </div>
                      )}

                      {/* Parts count */}
                      {resource.parts && resource.parts.length > 0 && (
                        <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                          <Users className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{resource.parts.length} deler</span>
                        </div>
                      )}
                    </div>

                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

