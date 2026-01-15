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
  Users,
  Shield,
  User,
  Loader2,
  MoreVertical,
  Trash2,
  ShieldCheck,
  ShieldOff,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  UserX,
  Phone,
  MapPin,
  X
} from "lucide-react"
import { format } from "date-fns"
import { nb } from "date-fns/locale"

interface UserData {
  id: string
  email: string
  name: string | null
  systemRole: "admin" | "user"
  customRoleId: string | null
  customRole: {
    id: string
    name: string
    description: string | null
    color: string | null
    hasModeratorAccess: boolean
  } | null
  role: string // Legacy
  phone: string | null
  isApproved: boolean
  approvedAt: string | null
  emailVerified: boolean
  emailVerifiedAt: string | null
  isMember: boolean
  createdAt: string
  _count: {
    bookings: number
  }
  moderatedResources?: Array<{
    resource: {
      id: string
      name: string
    }
  }>
}

interface CustomRole {
  id: string
  name: string
  description: string | null
  color: string | null
  hasModeratorAccess: boolean
  _count: {
    users: number
  }
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<UserData[]>([])
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending")

  // New user form
  const [newEmail, setNewEmail] = useState("")
  const [newName, setNewName] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newSystemRole, setNewSystemRole] = useState<"admin" | "user">("user")
  const [newCustomRoleId, setNewCustomRoleId] = useState<string>("")
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user?.systemRole !== "admin" && session?.user?.role !== "admin") {
      router.push("/")
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user?.systemRole === "admin" || session?.user?.role === "admin") {
      fetchUsers()
      fetchCustomRoles()
    }
  }, [session])

  const fetchUsers = async () => {
    const response = await fetch("/api/admin/users")
    const data = await response.json()
    setUsers(data)
    setIsLoading(false)
  }

  const fetchCustomRoles = async () => {
    try {
      const response = await fetch("/api/admin/roles")
      if (response.ok) {
        const data = await response.json()
        setCustomRoles(data)
      }
    } catch (error) {
      console.error("Error fetching roles:", error)
    }
  }

  const approveUser = async (userId: string) => {
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isApproved: true })
    })
    fetchUsers()
  }

  const rejectUser = async (userId: string) => {
    if (!confirm("Er du sikker på at du vil avslå denne søknaden? Brukeren vil bli slettet.")) {
      return
    }
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" })
    fetchUsers()
  }

  const changeRole = async (userId: string, systemRole: "admin" | "user", customRoleId: string | null = null) => {
    const user = users.find(u => u.id === userId)
    if (!user) return

    let roleName = systemRole === "admin" ? "administrator" : "bruker"
    if (customRoleId) {
      const role = customRoles.find(r => r.id === customRoleId)
      roleName = role?.name || "ukjent rolle"
    }

    const hadModeratorAccess = user.systemRole === "admin" || user.customRole?.hasModeratorAccess
    const willHaveModeratorAccess = systemRole === "admin" || 
      (customRoleId && customRoles.find(r => r.id === customRoleId)?.hasModeratorAccess)
    
    let confirmMessage = `Er du sikker på at du vil endre rollen til ${roleName}?`
    if (hadModeratorAccess && !willHaveModeratorAccess) {
      confirmMessage = "Dette vil fjerne alle moderator-tilganger for denne brukeren. Fortsette?"
    }
    
    if (!confirm(confirmMessage)) {
      return
    }
    
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        systemRole,
        customRoleId: customRoleId || null
      })
    })
    fetchUsers()
    setOpenMenu(null)
  }

  const verifyEmail = async (userId: string) => {
    if (!confirm("Er du sikker på at du vil manuelt verifisere e-posten for denne brukeren?")) {
      return
    }
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailVerified: true })
    })
    fetchUsers()
    setOpenMenu(null)
  }

  const toggleMembership = async (userId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus
    const action = newStatus ? "sette" : "fjerne"
    if (!confirm(`Er du sikker på at du vil ${action} medlemsstatus for denne brukeren?`)) {
      return
    }
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isMember: newStatus })
    })
    fetchUsers()
    setOpenMenu(null)
  }

  const deleteUser = async (userId: string) => {
    if (!confirm("Er du sikker på at du vil slette denne brukeren? Alle bookinger vil også bli slettet.")) {
      return
    }
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" })
    fetchUsers()
    setOpenMenu(null)
  }

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAdding(true)

    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newEmail,
        name: newName,
        password: newPassword,
        systemRole: newSystemRole,
        customRoleId: newCustomRoleId || null
      })
    })

    setNewEmail("")
    setNewName("")
    setNewPassword("")
    setNewSystemRole("user")
    setNewCustomRoleId("")
    setShowAddModal(false)
    setIsAdding(false)
    fetchUsers()
  }

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

  const pendingUsers = users.filter(u => !u.isApproved)
  const approvedUsers = users.filter(u => u.isApproved)
  const admins = approvedUsers.filter(u => u.systemRole === "admin")
  const usersWithModeratorAccess = approvedUsers.filter(u => 
    u.systemRole === "admin" || u.customRole?.hasModeratorAccess
  )
  const regularUsers = approvedUsers.filter(u => 
    u.systemRole === "user" && !u.customRole?.hasModeratorAccess
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Tilbake til dashboard
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Brukere</h1>
            <p className="text-gray-500">Administrer brukere og godkjenn nye medlemmer</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary"
          >
            <Plus className="w-5 h-5" />
            Legg til bruker
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-colors whitespace-nowrap text-sm sm:text-base flex-shrink-0 ${
              activeTab === "pending"
                ? "bg-amber-100 text-amber-800"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Venter på godkjenning</span>
            <span className="sm:hidden">Ventende</span>
            {pendingUsers.length > 0 && (
              <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                {pendingUsers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("approved")}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium flex items-center gap-1.5 sm:gap-2 transition-colors whitespace-nowrap text-sm sm:text-base flex-shrink-0 ${
              activeTab === "approved"
                ? "bg-blue-100 text-blue-800"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            <UserCheck className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Godkjente brukere</span>
            <span className="sm:hidden">Godkjente</span>
            <span className="text-xs sm:text-sm">({approvedUsers.length})</span>
          </button>
        </div>

        {/* Pending Users Tab */}
        {activeTab === "pending" && (
          <section>
            {pendingUsers.length === 0 ? (
              <div className="card p-12 text-center">
                <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Ingen ventende søknader</h3>
                <p className="text-gray-500">Alle brukerforespørsler er behandlet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingUsers.map((user) => (
                  <div key={user.id} className="card p-5 border-l-4 border-amber-400 hover:shadow-md transition-shadow">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <Clock className="w-6 h-6 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-gray-900">{user.name || "Uten navn"}</p>
                            {user.isMember && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                Medlem
                              </span>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{user.email}</span>
                              {user.emailVerified ? (
                                <div title="E-post verifisert">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                                </div>
                              ) : (
                                <div title="E-post ikke verifisert">
                                  <XCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                </div>
                              )}
                            </div>
                            {user.phone && (
                              <p className="text-sm text-gray-500 flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5" />
                                {user.phone}
                              </p>
                            )}
                            <p className="text-xs text-gray-400">
                              Søkte {format(new Date(user.createdAt), "d. MMM yyyy 'kl.' HH:mm", { locale: nb })}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => approveUser(user.id)}
                          className="btn bg-green-600 hover:bg-green-700 text-white"
                        >
                          <UserCheck className="w-4 h-4" />
                          Godkjenn
                        </button>
                        <button
                          onClick={() => rejectUser(user.id)}
                          className="btn bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          <UserX className="w-4 h-4" />
                          Avslå
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Approved Users Tab */}
        {activeTab === "approved" && (
          <>
            {/* Admins */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" />
                Administratorer ({admins.length})
              </h2>
              <div className="space-y-3">
                {admins.map((user) => (
                  <UserCard 
                    key={user.id} 
                    user={user} 
                    currentUserId={session?.user?.id}
                    openMenu={openMenu}
                    setOpenMenu={setOpenMenu}
                    onChangeRole={changeRole}
                    customRoles={customRoles}
                    onVerifyEmail={verifyEmail}
                    onDelete={deleteUser}
                    onToggleMembership={toggleMembership}
                  />
                ))}
              </div>
            </section>

            {/* Users with moderator access */}
            {usersWithModeratorAccess.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-600" />
                  Med moderator-tilgang ({usersWithModeratorAccess.length})
                </h2>
                <div className="space-y-3">
                  {usersWithModeratorAccess.map((user) => (
                    <UserCard 
                      key={user.id} 
                      user={user} 
                      currentUserId={session?.user?.id}
                      openMenu={openMenu}
                      setOpenMenu={setOpenMenu}
                      onChangeRole={changeRole}
                      customRoles={customRoles}
                      onVerifyEmail={verifyEmail}
                      onDelete={deleteUser}
                      onToggleMembership={toggleMembership}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Regular users */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Brukere ({regularUsers.length})
              </h2>
              {regularUsers.length === 0 ? (
                <div className="card p-8 text-center">
                  <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Ingen vanlige brukere enda</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {regularUsers.map((user) => (
                    <UserCard 
                      key={user.id} 
                      user={user}
                      currentUserId={session?.user?.id}
                      openMenu={openMenu}
                      setOpenMenu={setOpenMenu}
                      onChangeRole={changeRole}
                      customRoles={customRoles}
                      onVerifyEmail={verifyEmail}
                      onDelete={deleteUser}
                      onToggleMembership={toggleMembership}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card p-6 w-full max-w-md animate-fadeIn">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Legg til ny bruker</h2>
            <form onSubmit={addUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-post *</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Navn</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Passord *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rolle</label>
                <select
                  value={newSystemRole}
                  onChange={(e) => {
                    setNewSystemRole(e.target.value as "admin" | "user")
                    if (e.target.value === "admin") {
                      setNewCustomRoleId("") // Admin kan ikke ha custom role
                    }
                  }}
                  className="input mb-2"
                >
                  <option value="user">Bruker</option>
                  <option value="admin">Administrator</option>
                </select>
                {newSystemRole === "user" && customRoles.length > 0 && (
                  <select
                    value={newCustomRoleId}
                    onChange={(e) => setNewCustomRoleId(e.target.value)}
                    className="input"
                  >
                    <option value="">Ingen egendefinert rolle</option>
                    {customRoles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.name} {role.hasModeratorAccess && "(Moderator-tilgang)"}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Administratorer har full tilgang. Egendefinerte roller kan ha moderator-tilgang.
                </p>
              </div>
              <p className="text-xs text-gray-500">
                Brukere lagt til av admin blir automatisk godkjent.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isAdding}
                  className="btn btn-primary flex-1"
                >
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Legg til"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                >
                  Avbryt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function UserCard({ 
  user, 
  currentUserId,
  openMenu, 
  setOpenMenu, 
  onChangeRole,
  onVerifyEmail,
  onDelete,
  onToggleMembership,
  customRoles
}: { 
  user: UserData
  currentUserId?: string
  openMenu: string | null
  setOpenMenu: (id: string | null) => void
  onChangeRole: (id: string, systemRole: "admin" | "user", customRoleId?: string | null) => void
  onVerifyEmail: (id: string) => void
  onDelete: (id: string) => void
  onToggleMembership: (id: string, currentStatus: boolean) => void
  customRoles: CustomRole[]
}) {
  const isCurrentUser = user.id === currentUserId

  return (
    <div className="card p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
              user.systemRole === "admin" ? "bg-purple-100" : 
              user.customRole?.hasModeratorAccess ? "bg-amber-100" : 
              user.customRole ? "bg-blue-100" : "bg-gray-100"
          }`} style={user.customRole?.color ? { backgroundColor: `${user.customRole.color}20` } : undefined}>
            {user.systemRole === "admin" ? (
              <Shield className="w-6 h-6 text-purple-600" />
              ) : user.customRole?.hasModeratorAccess ? (
                <ShieldCheck className="w-6 h-6 text-amber-600" />
            ) : (
              <User className="w-6 h-6 text-blue-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-gray-900">{user.name || "Uten navn"}</p>
              {isCurrentUser && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  Deg
                </span>
              )}
            </div>
            
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{user.email}</span>
                {user.emailVerified ? (
                  <div title="E-post verifisert">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                  </div>
                ) : (
                  <div title="E-post ikke verifisert">
                    <XCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  </div>
                )}
              </div>
              
              {user.phone && (
                <p className="text-sm text-gray-500 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  {user.phone}
                </p>
              )}
              
              {/* Vis rolle */}
              <div className="flex items-center gap-2">
                {user.systemRole === "admin" ? (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                    Administrator
                  </span>
                ) : user.customRole ? (
                  <span 
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: user.customRole.color ? `${user.customRole.color}20` : "#e5e7eb",
                      color: user.customRole.color || "#374151"
                    }}
                  >
                    {user.customRole.name}
                    {user.customRole.hasModeratorAccess && " (Moderator)"}
                  </span>
                ) : user.isMember ? (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    Medlem
                  </span>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                    Ikke medlem
                  </span>
                )}
              </div>
              
              {/* Vis moderator-ressurser hvis brukeren har moderator-tilgang */}
              {(user.systemRole === "admin" || user.customRole?.hasModeratorAccess) && user.moderatedResources && user.moderatedResources.length > 0 && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {user.moderatedResources.map(mr => mr.resource.name).join(", ")}
                </p>
              )}
              {(user.systemRole === "admin" || user.customRole?.hasModeratorAccess) && (!user.moderatedResources || user.moderatedResources.length === 0) && user.systemRole !== "admin" && (
                <p className="text-xs text-gray-400 italic">
                  Ingen fasiliteter tildelt
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-4 flex-shrink-0">
          <div className="text-right hidden md:block">
            <div className="mb-2">
              <p className="text-sm font-medium text-gray-900">{user._count.bookings}</p>
              <p className="text-xs text-gray-500">booking{user._count.bookings !== 1 ? 'er' : ''}</p>
            </div>
            <p className="text-xs text-gray-400">
              {format(new Date(user.createdAt), "d. MMM yyyy", { locale: nb })}
            </p>
            {user.approvedAt && (
              <p className="text-xs text-gray-400 mt-1">
                Godkjent {format(new Date(user.approvedAt), "d. MMM yyyy", { locale: nb })}
              </p>
            )}
          </div>

          {!isCurrentUser && (
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Mer alternativer"
              >
                <MoreVertical className="w-5 h-5 text-gray-400" />
              </button>

              {openMenu === user.id && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-10 animate-fadeIn">
                  {!user.emailVerified && (
                    <button
                      onClick={() => onVerifyEmail(user.id)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-green-50 w-full text-left"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Verifiser e-post
                    </button>
                  )}
                  <div className="border-t border-gray-200 my-1" />
                  <button
                    onClick={() => onToggleMembership(user.id, user.isMember)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm w-full text-left ${
                      user.isMember 
                        ? "text-amber-600 hover:bg-amber-50" 
                        : "text-green-600 hover:bg-green-50"
                    }`}
                  >
                    {user.isMember ? (
                      <>
                        <UserX className="w-4 h-4" />
                        Fjern medlemsstatus
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4" />
                        Sett som medlem
                      </>
                    )}
                  </button>
                  {/* Systemroller */}
                  {user.systemRole !== "user" && (
                    <button
                      onClick={() => onChangeRole(user.id, "user", null)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
                    >
                      <User className="w-4 h-4" />
                      Gjør til bruker
                    </button>
                  )}
                  {user.systemRole !== "admin" && (
                    <button
                      onClick={() => onChangeRole(user.id, "admin", null)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
                    >
                      <Shield className="w-4 h-4" />
                      Gjør til admin
                    </button>
                  )}
                  
                  {/* Egendefinerte roller */}
                  {user.systemRole === "user" && customRoles.length > 0 && (
                    <>
                      <div className="border-t border-gray-200 my-1" />
                      <div className="px-4 py-2 text-xs font-medium text-gray-500">
                        Egendefinerte roller:
                      </div>
                      {customRoles.map(role => (
                        <button
                          key={role.id}
                          onClick={() => onChangeRole(user.id, "user", role.id)}
                          className={`flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 w-full text-left ${
                            user.customRoleId === role.id ? "bg-blue-50 text-blue-700" : "text-gray-700"
                          }`}
                        >
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: role.color || "#3b82f6" }}
                          />
                          {role.name}
                          {role.hasModeratorAccess && (
                            <span className="text-xs text-amber-600">(Mod)</span>
                          )}
                        </button>
                      ))}
                      {user.customRoleId && (
                        <button
                          onClick={() => onChangeRole(user.id, "user", null)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 w-full text-left"
                        >
                          <X className="w-4 h-4" />
                          Fjern egendefinert rolle
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => onDelete(user.id)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                  >
                    <Trash2 className="w-4 h-4" />
                    Slett bruker
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
