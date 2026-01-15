"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import { 
  ClipboardList, 
  Plus, 
  Building2, 
  Wrench,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  X,
  Loader2,
  CheckCircle2,
  MapPin,
  Calendar,
  Package,
  Zap,
  Truck,
  Sofa,
  HelpCircle,
  ChevronDown
} from "lucide-react"
import Link from "next/link"

type AssetCategory = "BUILDING" | "FIELD" | "EQUIPMENT" | "MACHINERY" | "VEHICLE" | "FURNITURE" | "ELECTRONICS" | "OTHER"
type AssetStatus = "ACTIVE" | "INACTIVE" | "UNDER_REPAIR" | "DISPOSED" | "PLANNED"
type AssetCondition = "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "CRITICAL"

interface Asset {
  id: string
  name: string
  description: string | null
  category: AssetCategory
  customCategory: string | null
  location: string | null
  serialNumber: string | null
  manufacturer: string | null
  model: string | null
  purchaseDate: string | null
  purchasePrice: number | null
  status: AssetStatus
  condition: AssetCondition
  notes: string | null
  images: string[]
  resource: { id: string; name: string } | null
  createdBy: { id: string; name: string } | null
  _count: {
    maintenanceTasks: number
    maintenanceLogs: number
    documents: number
  }
}

interface Stats {
  totalAssets: number
  totalTasks: number
  dueSoon: number
  overdue: number
}

const categoryLabels: Record<AssetCategory, string> = {
  BUILDING: "Bygning",
  FIELD: "Bane/anlegg",
  EQUIPMENT: "Utstyr",
  MACHINERY: "Maskin",
  VEHICLE: "Kjøretøy",
  FURNITURE: "Møbler",
  ELECTRONICS: "Elektronikk",
  OTHER: "Annet"
}

const categoryIcons: Record<AssetCategory, React.ReactNode> = {
  BUILDING: <Building2 className="w-5 h-5" />,
  FIELD: <MapPin className="w-5 h-5" />,
  EQUIPMENT: <Package className="w-5 h-5" />,
  MACHINERY: <Wrench className="w-5 h-5" />,
  VEHICLE: <Truck className="w-5 h-5" />,
  FURNITURE: <Sofa className="w-5 h-5" />,
  ELECTRONICS: <Zap className="w-5 h-5" />,
  OTHER: <HelpCircle className="w-5 h-5" />
}

const statusLabels: Record<AssetStatus, string> = {
  ACTIVE: "Aktiv",
  INACTIVE: "Inaktiv",
  UNDER_REPAIR: "Under reparasjon",
  DISPOSED: "Avhendet",
  PLANNED: "Planlagt"
}

const statusColors: Record<AssetStatus, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-gray-100 text-gray-700",
  UNDER_REPAIR: "bg-amber-100 text-amber-700",
  DISPOSED: "bg-red-100 text-red-700",
  PLANNED: "bg-blue-100 text-blue-700"
}

const conditionLabels: Record<AssetCondition, string> = {
  EXCELLENT: "Utmerket",
  GOOD: "God",
  FAIR: "Brukbar",
  POOR: "Dårlig",
  CRITICAL: "Kritisk"
}

const conditionColors: Record<AssetCondition, string> = {
  EXCELLENT: "text-green-600",
  GOOD: "text-blue-600",
  FAIR: "text-amber-600",
  POOR: "text-orange-600",
  CRITICAL: "text-red-600"
}

export default function AnleggsregisterPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isModuleEnabled, setIsModuleEnabled] = useState<boolean | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<AssetCategory | "ALL">("ALL")
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "ALL">("ALL")
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user?.role !== "admin" && session?.user?.systemRole !== "admin") {
      router.push("/")
    }
  }, [status, session, router])

  const fetchAssets = useCallback(async () => {
    try {
      const response = await fetch("/api/assets")
      if (response.ok) {
        const data = await response.json()
        setAssets(data.assets)
        setStats(data.stats)
      }
    } catch (error) {
      console.error("Error fetching assets:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch("/api/modules/asset-register")
      .then(res => res.json())
      .then(data => {
        setIsModuleEnabled(data.enabled)
        if (data.enabled) {
          fetchAssets()
        } else {
          setIsLoading(false)
        }
      })
      .catch(() => {
        setIsModuleEnabled(false)
        setIsLoading(false)
      })
  }, [fetchAssets])

  const handleDeleteAsset = async (id: string) => {
    try {
      const response = await fetch(`/api/assets/${id}`, { method: "DELETE" })
      if (response.ok) {
        setAssets(prev => prev.filter(a => a.id !== id))
        if (stats) {
          setStats({ ...stats, totalAssets: stats.totalAssets - 1 })
        }
      }
    } catch (error) {
      console.error("Error deleting asset:", error)
    } finally {
      setShowDeleteConfirm(null)
    }
  }

  // Filtrer anlegg
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = 
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.location?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = categoryFilter === "ALL" || asset.category === categoryFilter
    const matchesStatus = statusFilter === "ALL" || asset.status === statusFilter
    
    return matchesSearch && matchesCategory && matchesStatus
  })

  if (status === "loading" || isModuleEnabled === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </main>
        <Footer />
      </div>
    )
  }

  if (!isModuleEnabled) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-8 h-8 text-gray-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Anleggsregister</h1>
            <p className="text-gray-500 mb-6">
              Denne modulen er ikke aktivert for din organisasjon. 
              Kontakt oss for å aktivere anleggsregister.
            </p>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Tilbake til admin
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600" />
                Anleggsregister
              </h1>
              <p className="text-sm sm:text-base text-gray-500">
                Oversikt over anlegg, utstyr og vedlikeholdsoppgaver
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nytt anlegg</span>
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats?.totalAssets ?? 0}</p>
                  <p className="text-sm text-gray-500">Anlegg</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats?.totalTasks ?? 0}</p>
                  <p className="text-sm text-gray-500">Vedlikeholdsoppgaver</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats?.dueSoon ?? 0}</p>
                  <p className="text-sm text-gray-500">Forfaller snart</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats?.overdue ?? 0}</p>
                  <p className="text-sm text-gray-500">Forfalt</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="card p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Søk etter anlegg..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as AssetCategory | "ALL")}
                    className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                  >
                    <option value="ALL">Alle kategorier</option>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as AssetStatus | "ALL")}
                    className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                  >
                    <option value="ALL">Alle statuser</option>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Asset list */}
          {isLoading ? (
            <div className="card p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-4" />
              <p className="text-gray-500">Laster anlegg...</p>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ClipboardList className="w-10 h-10 text-gray-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {assets.length === 0 ? "Ingen anlegg registrert ennå" : "Ingen treff"}
              </h2>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                {assets.length === 0 
                  ? "Kom i gang med å registrere idrettslagets anlegg, utstyr og eiendeler. Du kan legge til vedlikeholdsoppgaver og frister for hvert anlegg."
                  : "Prøv å endre søk eller filtre for å finne det du leter etter."
                }
              </p>
              {assets.length === 0 && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Registrer første anlegg
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredAssets.map(asset => (
                <div key={asset.id} className="card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      asset.category === "BUILDING" ? "bg-teal-100 text-teal-600" :
                      asset.category === "FIELD" ? "bg-green-100 text-green-600" :
                      asset.category === "EQUIPMENT" ? "bg-blue-100 text-blue-600" :
                      asset.category === "MACHINERY" ? "bg-orange-100 text-orange-600" :
                      asset.category === "VEHICLE" ? "bg-purple-100 text-purple-600" :
                      asset.category === "ELECTRONICS" ? "bg-yellow-100 text-yellow-600" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {categoryIcons[asset.category]}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{asset.name}</h3>
                          <p className="text-sm text-gray-500">
                            {categoryLabels[asset.category]}
                            {asset.location && ` • ${asset.location}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[asset.status]}`}>
                            {statusLabels[asset.status]}
                          </span>
                          <div className="relative">
                            <button
                              onClick={() => setActiveMenu(activeMenu === asset.id ? null : asset.id)}
                              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <MoreVertical className="w-5 h-5 text-gray-400" />
                            </button>
                            {activeMenu === asset.id && (
                              <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                                <button
                                  onClick={() => {
                                    setEditingAsset(asset)
                                    setShowAddModal(true)
                                    setActiveMenu(null)
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  <Edit className="w-4 h-4" />
                                  Rediger
                                </button>
                                <button
                                  onClick={() => {
                                    setShowDeleteConfirm(asset.id)
                                    setActiveMenu(null)
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Slett
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {asset.description && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">{asset.description}</p>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500">
                        <span className={conditionColors[asset.condition]}>
                          Tilstand: {conditionLabels[asset.condition]}
                        </span>
                        {asset._count.maintenanceTasks > 0 && (
                          <span className="flex items-center gap-1">
                            <Wrench className="w-3 h-3" />
                            {asset._count.maintenanceTasks} oppgaver
                          </span>
                        )}
                        {asset.resource && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {asset.resource.name}
                          </span>
                        )}
                        {asset.purchaseDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Anskaffet {new Date(asset.purchaseDate).toLocaleDateString("nb-NO")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Add/Edit Modal */}
      {showAddModal && (
        <AssetModal
          asset={editingAsset}
          onClose={() => {
            setShowAddModal(false)
            setEditingAsset(null)
          }}
          onSave={() => {
            setShowAddModal(false)
            setEditingAsset(null)
            fetchAssets()
          }}
        />
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Slett anlegg?</h3>
            <p className="text-gray-500 mb-6">
              Er du sikker på at du vil slette dette anlegget? Alle vedlikeholdsoppgaver og logger vil også bli slettet.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={() => handleDeleteAsset(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Slett
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close menu */}
      {activeMenu && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setActiveMenu(null)}
        />
      )}
    </div>
  )
}

// Add/Edit Asset Modal Component
function AssetModal({ 
  asset, 
  onClose, 
  onSave 
}: { 
  asset: Asset | null
  onClose: () => void
  onSave: () => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: asset?.name || "",
    description: asset?.description || "",
    category: asset?.category || "OTHER" as AssetCategory,
    location: asset?.location || "",
    serialNumber: asset?.serialNumber || "",
    manufacturer: asset?.manufacturer || "",
    model: asset?.model || "",
    purchaseDate: asset?.purchaseDate ? new Date(asset.purchaseDate).toISOString().split("T")[0] : "",
    purchasePrice: asset?.purchasePrice?.toString() || "",
    status: asset?.status || "ACTIVE" as AssetStatus,
    condition: asset?.condition || "GOOD" as AssetCondition,
    notes: asset?.notes || ""
  })

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!formData.name.trim()) return
    
    setIsSubmitting(true)

    try {
      const url = asset ? `/api/assets/${asset.id}` : "/api/assets"
      const method = asset ? "PUT" : "POST"
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : null
        })
      })

      if (response.ok) {
        onSave()
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error("Error creating asset:", response.status, errorData)
        alert("Kunne ikke opprette anlegg. Sjekk at databasen er synkronisert.")
      }
    } catch (error) {
      console.error("Error saving asset:", error)
      alert("Noe gikk galt. Prøv igjen.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">
            {asset ? "Rediger anlegg" : "Nytt anlegg"}
          </h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Navn */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Navn <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="F.eks. Kunstgressbane 1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Kategori */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as AssetCategory })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Lokasjon */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lokasjon</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="F.eks. Hovedanlegg"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Beskrivelse */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Beskrivelse</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Beskriv anlegget..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
              />
            </div>

            {/* Produsent */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Produsent</label>
              <input
                type="text"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Modell */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modell</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Serienummer */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Serienummer</label>
              <input
                type="text"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Anskaffelsesdato */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Anskaffelsesdato</label>
              <input
                type="date"
                value={formData.purchaseDate}
                onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Pris */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Innkjøpspris (kr)</label>
              <input
                type="number"
                step="0.01"
                value={formData.purchasePrice}
                onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as AssetStatus })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Tilstand */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tilstand</label>
              <select
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value as AssetCondition })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                {Object.entries(conditionLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Notater */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notater</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                placeholder="Eventuelle notater..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
              />
            </div>
          </div>
        </form>

        <div className="flex gap-2 p-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Avbryt
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.name}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Lagrer...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                {asset ? "Lagre endringer" : "Opprett anlegg"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
