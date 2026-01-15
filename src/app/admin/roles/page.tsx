"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import Link from "next/link"
import { 
  ArrowLeft,
  Plus,
  Shield,
  Loader2,
  MoreVertical,
  Trash2,
  Edit,
  X,
  Check,
  Users,
  ShieldCheck,
  ShieldOff,
  Trophy
} from "lucide-react"

interface CustomRole {
  id: string
  name: string
  description: string | null
  color: string | null
  hasModeratorAccess: boolean
  hasMatchSetupAccess: boolean
  createdAt: string
  _count: {
    users: number
  }
}

export default function AdminRolesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [roles, setRoles] = useState<CustomRole[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null)

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState("#3b82f6")
  const [hasModeratorAccess, setHasModeratorAccess] = useState(false)
  const [hasMatchSetupAccess, setHasMatchSetupAccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  
  // Module status
  const [matchSetupEnabled, setMatchSetupEnabled] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user?.systemRole !== "admin" && session?.user?.role !== "admin") {
      router.push("/")
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user?.systemRole === "admin" || session?.user?.role === "admin") {
      fetchRoles()
      checkMatchSetupModule()
    }
  }, [session])

  const checkMatchSetupModule = async () => {
    try {
      const response = await fetch("/api/match-setup/status")
      if (response.ok) {
        const data = await response.json()
        setMatchSetupEnabled(data.enabled)
      }
    } catch (error) {
      console.error("Error checking match setup module:", error)
    }
  }

  const fetchRoles = async () => {
    try {
      const response = await fetch("/api/admin/roles")
      if (response.ok) {
        const data = await response.json()
        setRoles(data)
      }
    } catch (error) {
      console.error("Error fetching roles:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenAdd = () => {
    setName("")
    setDescription("")
    setColor("#3b82f6")
    setHasModeratorAccess(false)
    setHasMatchSetupAccess(false)
    setError("")
    setEditingRole(null)
    setShowAddModal(true)
  }

  const handleOpenEdit = (role: CustomRole) => {
    setName(role.name)
    setDescription(role.description || "")
    setColor(role.color || "#3b82f6")
    setHasModeratorAccess(role.hasModeratorAccess)
    setHasMatchSetupAccess(role.hasMatchSetupAccess)
    setError("")
    setEditingRole(role)
    setShowAddModal(true)
    setOpenMenu(null)
  }

  const handleCloseModal = () => {
    setShowAddModal(false)
    setEditingRole(null)
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      const url = editingRole 
        ? `/api/admin/roles/${editingRole.id}`
        : "/api/admin/roles"
      
      const method = editingRole ? "PUT" : "POST"
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          color: color || null,
          hasModeratorAccess,
          hasMatchSetupAccess
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunne ikke lagre rolle")
      }

      handleCloseModal()
      fetchRoles()
    } catch (error: any) {
      setError(error.message || "En feil oppstod")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (roleId: string) => {
    if (!confirm("Er du sikker på at du vil slette denne rollen?")) {
      return
    }

    try {
      const response = await fetch(`/api/admin/roles/${roleId}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || "Kunne ikke slette rolle")
        return
      }

      setOpenMenu(null)
      fetchRoles()
    } catch (error) {
      console.error("Error deleting role:", error)
      alert("En feil oppstod")
    }
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
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
          <div className="mb-6">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Tilbake til admin
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Shield className="w-6 h-6" />
                  Roller
                </h1>
                <p className="text-gray-500 mt-1">
                  Administrer egendefinerte roller for organisasjonen
                </p>
              </div>
              <button
                onClick={handleOpenAdd}
                className="btn btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Ny rolle
              </button>
            </div>
          </div>

          {/* Info banner */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Tips:</strong> Egendefinerte roller kan brukes til å gi spesifikke tilganger. 
              Du kan velge om en rolle skal ha moderator-tilgang (kan godkjenne/avslå bookinger).
            </p>
          </div>

          {/* System roles - always shown */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Standardroller (kan ikke slettes)
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Admin */}
              <div className="card p-6 bg-gray-50 border-gray-200">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-400">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-700 text-lg">
                      Admin
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Full tilgang til alle funksjoner
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <ShieldCheck className="w-4 h-4 text-green-600" />
                    <span className="text-gray-600">Har full admin-tilgang</span>
                  </div>
                </div>
              </div>

              {/* Medlem */}
              <div className="card p-6 bg-gray-50 border-gray-200">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-400">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-700 text-lg">
                      Medlem
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Verifiserte medlemmer av klubben
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <ShieldOff className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500">Ingen moderator-tilgang</span>
                  </div>
                </div>
              </div>

              {/* Ikke medlem */}
              <div className="card p-6 bg-gray-50 border-gray-200">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-400">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-700 text-lg">
                      Ikke medlem
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Brukere som ikke er medlemmer
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <ShieldOff className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500">Ingen moderator-tilgang</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Custom roles header */}
          {roles.length > 0 && (
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Egendefinerte roller
            </h2>
          )}

          {/* Roles list */}
          {roles.length === 0 ? (
            <div className="card p-8 text-center mt-4">
              <p className="text-gray-500 mb-4">Ingen egendefinerte roller opprettet ennå</p>
              <button
                onClick={handleOpenAdd}
                className="btn btn-primary"
              >
                Opprett din første egendefinerte rolle
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="card p-6 relative"
                >
                  {/* Menu button */}
                  <div className="absolute top-4 right-4">
                    <button
                      onClick={() => setOpenMenu(openMenu === role.id ? null : role.id)}
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <MoreVertical className="w-5 h-5 text-gray-500" />
                    </button>
                    {openMenu === role.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenu(null)}
                        />
                        <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[150px]">
                          <button
                            onClick={() => handleOpenEdit(role)}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Edit className="w-4 h-4" />
                            Rediger
                          </button>
                          {role._count.users === 0 ? (
                            <button
                              onClick={() => handleDelete(role.id)}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Slett
                            </button>
                          ) : (
                            <div className="px-4 py-2 text-xs text-gray-400">
                              Kan ikke slette (har {role._count.users} brukere)
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Role content */}
                  <div className="flex items-start gap-3 mb-4">
                    {role.color && (
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: role.color }}
                      >
                        <Shield className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {role.name}
                      </h3>
                      {role.description && (
                        <p className="text-sm text-gray-500 mt-1">
                          {role.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Role info */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      {role.hasModeratorAccess ? (
                        <>
                          <ShieldCheck className="w-4 h-4 text-green-600" />
                          <span className="text-gray-700">Har moderator-tilgang</span>
                        </>
                      ) : (
                        <>
                          <ShieldOff className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-500">Ingen moderator-tilgang</span>
                        </>
                      )}
                    </div>
                    {matchSetupEnabled && role.hasMatchSetupAccess && (
                      <div className="flex items-center gap-2 text-sm">
                        <Trophy className="w-4 h-4 text-orange-500" />
                        <span className="text-gray-700">Har kampoppsett-tilgang</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Users className="w-4 h-4" />
                      <span>
                        {role._count.users} {role._count.users === 1 ? "bruker" : "brukere"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingRole ? "Rediger rolle" : "Ny rolle"}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="p-2 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rollenavn *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="F.eks. Trener, Lagleder"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Beskrivelse
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Beskriv hva denne rollen innebærer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Farge
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="#3b82f6"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="hasModeratorAccess"
                    checked={hasModeratorAccess}
                    onChange={(e) => setHasModeratorAccess(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="hasModeratorAccess" className="flex-1 cursor-pointer">
                    <div className="font-medium text-gray-900">
                      Moderator-tilgang
                    </div>
                    <div className="text-sm text-gray-500">
                      Kan godkjenne og avslå bookinger for ressurser
                    </div>
                  </label>
                </div>

                {matchSetupEnabled && (
                  <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <input
                      type="checkbox"
                      id="hasMatchSetupAccess"
                      checked={hasMatchSetupAccess}
                      onChange={(e) => setHasMatchSetupAccess(e.target.checked)}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <label htmlFor="hasMatchSetupAccess" className="flex-1 cursor-pointer">
                      <div className="font-medium text-gray-900 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-orange-500" />
                        Kampoppsett-tilgang
                      </div>
                      <div className="text-sm text-gray-500">
                        Kan administrere konkurranser, lag og kamper
                      </div>
                    </label>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Avbryt
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 btn btn-primary flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Lagrer...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        {editingRole ? "Lagre endringer" : "Opprett rolle"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

