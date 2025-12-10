"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import Link from "next/link"
import { 
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  MapPin,
  Loader2,
  MoreVertical,
  Power,
  PowerOff
} from "lucide-react"

interface Resource {
  id: string
  name: string
  description: string | null
  location: string | null
  color: string | null
  isActive: boolean
  category: {
    id: string
    name: string
    color: string
  } | null
  parts: { id: string; name: string }[]
  _count: { bookings: number }
}

interface Category {
  id: string
  name: string
  color: string
}

export default function AdminResourcesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [resources, setResources] = useState<Resource[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user?.role !== "admin") {
      router.push("/")
    }
  }, [status, session, router])

  const fetchData = useCallback(async () => {
    try {
      const [resourcesRes, categoriesRes] = await Promise.all([
        fetch("/api/admin/resources"),
        fetch("/api/admin/categories")
      ])
      const [resourcesData, categoriesData] = await Promise.all([
        resourcesRes.json(),
        categoriesRes.json()
      ])
      setResources(resourcesData)
      setCategories(categoriesData)
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session?.user?.role === "admin") {
      fetchData()
    }
  }, [session, fetchData])

  const filteredResources = useMemo(() => {
    return selectedCategory
      ? resources.filter(r => r.category?.id === selectedCategory)
      : resources
  }, [selectedCategory, resources])

  const toggleActive = useCallback(async (resourceId: string, isActive: boolean) => {
    try {
      await fetch(`/api/admin/resources/${resourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive })
      })
      fetchData()
    } catch (error) {
      console.error("Failed to toggle resource:", error)
    } finally {
      setOpenMenu(null)
    }
  }, [fetchData])

  const deleteResource = useCallback(async (resourceId: string) => {
    if (!confirm("Er du sikker på at du vil slette denne ressursen? Alle bookinger vil også bli slettet.")) {
      return
    }
    try {
      await fetch(`/api/admin/resources/${resourceId}`, { method: "DELETE" })
      fetchData()
    } catch (error) {
      console.error("Failed to delete resource:", error)
    } finally {
      setOpenMenu(null)
    }
  }, [fetchData])

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Tilbake til dashboard
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fasiliteter</h1>
            <p className="text-gray-500">Administrer klubbens fasiliteter og ressurser</p>
          </div>
          <Link href="/admin/resources/new" className="btn btn-primary">
            <Plus className="w-5 h-5" />
            Ny fasilitet
          </Link>
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">Filtrer:</span>
            <button
              onClick={() => setSelectedCategory("")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === ""
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Alle ({resources.length})
            </button>
            {categories.map((category) => {
              const count = resources.filter(r => r.category?.id === category.id).length
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                    selectedCategory === category.id
                      ? "text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  style={selectedCategory === category.id ? { backgroundColor: category.color } : {}}
                >
                  <span 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name} ({count})
                </button>
              )
            })}
          </div>
        )}

        <div className="space-y-4">
          {filteredResources.map((resource) => (
            <div 
              key={resource.id} 
              className={`card p-5 ${!resource.isActive ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${resource.color || resource.category?.color || '#3b82f6'}20` }}
                  >
                    <div 
                      className="w-6 h-6 rounded-full"
                      style={{ backgroundColor: resource.color || resource.category?.color || '#3b82f6' }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{resource.name}</h3>
                      {!resource.isActive && (
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                          Inaktiv
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-2">
                      {resource.category?.name || "Ukategorisert"}
                      {resource.location && (
                        <>
                          <span className="mx-2">•</span>
                          <MapPin className="w-3 h-3 inline" /> {resource.location}
                        </>
                      )}
                    </p>
                    {resource.parts.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {resource.parts.map((part) => (
                          <span key={part.id} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                            {part.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 hidden sm:block">
                    {resource._count.bookings} booking{resource._count.bookings !== 1 ? 'er' : ''}
                  </span>
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenu(openMenu === resource.id ? null : resource.id)}
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <MoreVertical className="w-5 h-5 text-gray-400" />
                    </button>
                    
                    {openMenu === resource.id && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-10 animate-fadeIn">
                        <Link
                          href={`/admin/resources/${resource.id}`}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Edit className="w-4 h-4" />
                          Rediger
                        </Link>
                        <button
                          onClick={() => toggleActive(resource.id, resource.isActive)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
                        >
                          {resource.isActive ? (
                            <>
                              <PowerOff className="w-4 h-4" />
                              Deaktiver
                            </>
                          ) : (
                            <>
                              <Power className="w-4 h-4" />
                              Aktiver
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => deleteResource(resource.id)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                        >
                          <Trash2 className="w-4 h-4" />
                          Slett
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredResources.length === 0 && (
          <div className="card p-12 text-center">
            {resources.length === 0 ? (
              <>
                <p className="text-gray-500 mb-4">Ingen fasiliteter enda</p>
                <Link href="/admin/resources/new" className="btn btn-primary">
                  <Plus className="w-5 h-5" />
                  Legg til første fasilitet
                </Link>
              </>
            ) : (
              <>
                <p className="text-gray-500 mb-4">Ingen fasiliteter i denne kategorien</p>
                <button 
                  onClick={() => setSelectedCategory("")}
                  className="btn btn-secondary"
                >
                  Vis alle fasiliteter
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

