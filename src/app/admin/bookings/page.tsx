"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import Link from "next/link"
import { 
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Calendar,
  User,
  Mail,
  Phone,
  Trash2,
  Search,
  Filter,
  Building2,
  Repeat
} from "lucide-react"
import { format } from "date-fns"
import { nb } from "date-fns/locale"

interface Booking {
  id: string
  title: string
  description: string | null
  startTime: string
  endTime: string
  status: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  isRecurring: boolean
  parentBookingId: string | null
  resource: {
    name: string
  }
  resourcePart: {
    name: string
  } | null
  user: {
    name: string | null
    email: string
  }
}

export default function AdminBookingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [resources, setResources] = useState<{ id: string; name: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "all">("pending")
  const [resourceFilter, setResourceFilter] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user?.role !== "admin") {
      router.push("/")
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user?.role === "admin") {
      fetchBookings()
      fetchResources()
    }
  }, [session])

  const fetchResources = async () => {
    const response = await fetch("/api/admin/resources")
    const data = await response.json()
    setResources(data)
  }

  const fetchBookings = async () => {
    setIsLoading(true)
    const response = await fetch(`/api/admin/bookings?status=all`)
    const data = await response.json()
    setBookings(data)
    setIsLoading(false)
  }

  // Client-side filtering
  const filteredBookings = bookings.filter(booking => {
    // Status filter
    if (statusFilter !== "all" && booking.status !== statusFilter) return false
    
    // Resource filter
    if (resourceFilter && booking.resource.name !== resourceFilter) return false
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchTitle = booking.title.toLowerCase().includes(query)
      const matchUser = (booking.user.name || "").toLowerCase().includes(query)
      const matchEmail = booking.user.email.toLowerCase().includes(query)
      const matchContact = (booking.contactName || "").toLowerCase().includes(query)
      if (!matchTitle && !matchUser && !matchEmail && !matchContact) return false
    }
    
    // Date filters
    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      if (new Date(booking.startTime) < fromDate) return false
    }
    if (dateTo) {
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      if (new Date(booking.startTime) > toDate) return false
    }
    
    return true
  })

  const handleAction = async (bookingId: string, action: "approve" | "reject", applyToAll: boolean = false) => {
    setProcessingId(bookingId)
    const booking = bookings.find(b => b.id === bookingId)
    
    const response = await fetch(`/api/admin/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, applyToAll: applyToAll && booking?.isRecurring })
    })

    if (response.ok) {
      if (applyToAll && booking?.isRecurring) {
        // Remove all related recurring bookings
        const parentId = booking.parentBookingId || booking.id
        if (action === "approve") {
          setBookings(bookings.map(b => 
            (b.id === parentId || b.parentBookingId === parentId) && b.status === "pending"
              ? { ...b, status: "approved" } 
              : b
          ))
        } else {
          setBookings(bookings.filter(b => 
            !(b.id === parentId || b.parentBookingId === parentId)
          ))
        }
      } else {
        if (action === "approve") {
          setBookings(bookings.map(b => b.id === bookingId ? { ...b, status: "approved" } : b))
        } else {
          setBookings(bookings.filter(b => b.id !== bookingId))
        }
      }
    }
    
    setProcessingId(null)
  }

  const handleCancel = async (bookingId: string) => {
    setProcessingId(bookingId)
    
    const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: cancelReason })
    })

    if (response.ok) {
      // Update the booking status in the list instead of removing
      setBookings(bookings.map(b => 
        b.id === bookingId ? { ...b, status: "cancelled" } : b
      ))
    }
    
    setProcessingId(null)
    setCancellingId(null)
    setCancelReason("")
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
            <h1 className="text-2xl font-bold text-gray-900">Behandle bookinger</h1>
            <p className="text-gray-500">Godkjenn eller avslå bookingforespørsler</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter("pending")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === "pending" 
                  ? "bg-amber-100 text-amber-700" 
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Clock className="w-4 h-4 inline mr-1" />
              Ventende
            </button>
            <button
              onClick={() => setStatusFilter("approved")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === "approved" 
                  ? "bg-green-100 text-green-700" 
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              <CheckCircle2 className="w-4 h-4 inline mr-1" />
              Godkjente
            </button>
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === "all" 
                  ? "bg-blue-100 text-blue-700" 
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              Alle
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showFilters 
                  ? "bg-gray-900 text-white" 
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Filter className="w-4 h-4 inline mr-1" />
              Filter
            </button>
          </div>
        </div>

        {/* Extended filters */}
        {showFilters && (
          <div className="card p-4 mb-6 animate-fadeIn">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Search className="w-4 h-4 inline mr-1" />
                  Søk
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Navn, e-post, tittel..."
                  className="input"
                />
              </div>

              {/* Resource filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  Fasilitet
                </label>
                <select
                  value={resourceFilter}
                  onChange={(e) => setResourceFilter(e.target.value)}
                  className="input"
                >
                  <option value="">Alle fasiliteter</option>
                  {resources.map(r => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>

              {/* Date from */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Fra dato
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="input"
                />
              </div>

              {/* Date to */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Til dato
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            {/* Clear filters */}
            {(searchQuery || resourceFilter || dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setSearchQuery("")
                  setResourceFilter("")
                  setDateFrom("")
                  setDateTo("")
                }}
                className="mt-4 text-sm text-blue-600 hover:text-blue-700"
              >
                Nullstill alle filter
              </button>
            )}
          </div>
        )}

        {/* Results count */}
        <p className="text-sm text-gray-500 mb-4">
          Viser {filteredBookings.length} av {bookings.length} bookinger
        </p>

        {filteredBookings.length === 0 ? (
          <div className="card p-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {statusFilter === "pending" ? "Ingen ventende bookinger" : "Ingen bookinger funnet"}
            </h2>
            <p className="text-gray-500">
              {statusFilter === "pending" 
                ? "Alle bookinger er behandlet 🎉" 
                : "Prøv å justere filterene"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <div key={booking.id} className="card p-6 animate-fadeIn">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <h3 className="text-lg font-semibold text-gray-900">{booking.title}</h3>
                      <span className={`status-badge ${
                        booking.status === "pending" ? "status-pending" :
                        booking.status === "approved" ? "status-approved" :
                        booking.status === "rejected" ? "status-rejected" :
                        "status-cancelled"
                      }`}>
                        {booking.status === "pending" ? "Venter" :
                         booking.status === "approved" ? "Godkjent" :
                         booking.status === "rejected" ? "Avslått" : "Kansellert"}
                      </span>
                      {booking.isRecurring && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          <Repeat className="w-3 h-3" />
                          Gjentakende
                        </span>
                      )}
                    </div>

                    <p className="text-gray-600 mb-4">
                      {booking.resource.name}
                      {booking.resourcePart && ` → ${booking.resourcePart.name}`}
                    </p>

                    {booking.description && (
                      <p className="text-sm text-gray-500 mb-4">{booking.description}</p>
                    )}

                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {format(new Date(booking.startTime), "EEEE d. MMMM yyyy", { locale: nb })}
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {format(new Date(booking.startTime), "HH:mm")} - {format(new Date(booking.endTime), "HH:mm")}
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <User className="w-4 h-4 text-gray-400" />
                        {booking.user.name || booking.contactName || "Ukjent"}
                      </div>
                      {(booking.contactEmail || booking.user.email) && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail className="w-4 h-4 text-gray-400" />
                          {booking.contactEmail || booking.user.email}
                        </div>
                      )}
                      {booking.contactPhone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-4 h-4 text-gray-400" />
                          {booking.contactPhone}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 lg:flex-col">
                    {booking.status === "pending" && (
                      <>
                        {booking.isRecurring ? (
                          <>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAction(booking.id, "approve", true)}
                                disabled={processingId === booking.id}
                                className="btn btn-success flex-1 disabled:opacity-50 text-xs px-3"
                              >
                                {processingId === booking.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                                Godkjenn alle
                              </button>
                              <button
                                onClick={() => handleAction(booking.id, "approve", false)}
                                disabled={processingId === booking.id}
                                className="btn btn-secondary text-green-600 hover:bg-green-50 disabled:opacity-50 text-xs px-3"
                              >
                                Kun denne
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAction(booking.id, "reject", true)}
                                disabled={processingId === booking.id}
                                className="btn btn-danger flex-1 disabled:opacity-50 text-xs px-3"
                              >
                                {processingId === booking.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <XCircle className="w-4 h-4" />
                                )}
                                Avslå alle
                              </button>
                              <button
                                onClick={() => handleAction(booking.id, "reject", false)}
                                disabled={processingId === booking.id}
                                className="btn btn-secondary text-red-600 hover:bg-red-50 disabled:opacity-50 text-xs px-3"
                              >
                                Kun denne
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleAction(booking.id, "approve", false)}
                              disabled={processingId === booking.id}
                              className="btn btn-success flex-1 lg:flex-none disabled:opacity-50"
                            >
                              {processingId === booking.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4" />
                              )}
                              Godkjenn
                            </button>
                            <button
                              onClick={() => handleAction(booking.id, "reject", false)}
                              disabled={processingId === booking.id}
                              className="btn btn-danger flex-1 lg:flex-none disabled:opacity-50"
                            >
                              {processingId === booking.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                              Avslå
                            </button>
                          </>
                        )}
                      </>
                    )}
                    {(booking.status === "approved" || booking.status === "pending") && (
                      <button
                        onClick={() => setCancellingId(booking.id)}
                        disabled={processingId === booking.id}
                        className="btn btn-secondary flex-1 lg:flex-none disabled:opacity-50 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Kanseller
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel confirmation modal */}
      {cancellingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Kanseller booking?</h3>
            <p className="text-gray-600 mb-4">
              Er du sikker på at du vil kansellere denne bookingen? Brukeren vil bli varslet på e-post.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Årsak (valgfritt)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="F.eks. Fasiliteten er stengt for vedlikehold..."
                className="input min-h-[80px]"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setCancellingId(null)
                  setCancelReason("")
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={() => handleCancel(cancellingId)}
                disabled={processingId === cancellingId}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {processingId === cancellingId ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  "Ja, kanseller"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

