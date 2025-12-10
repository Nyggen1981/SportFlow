"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/Navbar"
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
  Trash2,
  Search,
  ChevronDown,
  ChevronRight,
  Repeat,
  AlertCircle
} from "lucide-react"
import { format, isToday, isTomorrow, isThisWeek, parseISO } from "date-fns"
import { nb } from "date-fns/locale"

interface Booking {
  id: string
  title: string
  description: string | null
  startTime: string
  endTime: string
  status: string
  statusNote: string | null
  contactName: string | null
  contactEmail: string | null
  isRecurring: boolean
  parentBookingId: string | null
  resource: { name: string }
  resourcePart: { name: string } | null
  user: { name: string | null; email: string }
}

type Tab = "pending" | "approved" | "history"

export default function AdminBookingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("pending")
  const [searchQuery, setSearchQuery] = useState("")
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectApplyToAll, setRejectApplyToAll] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user?.role !== "admin") {
      router.push("/")
    }
  }, [status, session, router])

  const fetchBookings = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/bookings?status=all`)
      const data = await response.json()
      setBookings(data)
    } catch (error) {
      console.error("Failed to fetch bookings:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session?.user?.role === "admin") {
      fetchBookings()
    }
  }, [session, fetchBookings])

  // Group recurring bookings
  const groupedBookings = useMemo(() => {
    const groups: { [key: string]: Booking[] } = {}
    const standalone: Booking[] = []

    bookings.forEach(booking => {
      if (booking.isRecurring) {
        const groupId = booking.parentBookingId || booking.id
        if (!groups[groupId]) groups[groupId] = []
        groups[groupId].push(booking)
      } else {
        standalone.push(booking)
      }
    })

    // Sort each group by date
    Object.values(groups).forEach(group => {
      group.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    })

    return { groups, standalone }
  }, [bookings])

  // Filter bookings by tab and search
  const filteredBookings = useMemo(() => {
    let filtered = [...groupedBookings.standalone]
    
    // Add first booking from each recurring group for display
    Object.entries(groupedBookings.groups).forEach(([groupId, group]) => {
      const representativeBooking = group[0]
      if (representativeBooking) {
        filtered.push({ ...representativeBooking, _groupId: groupId, _groupCount: group.length } as any)
      }
    })

    // Filter by tab
    const now = new Date()
    filtered = filtered.filter(booking => {
      if (activeTab === "pending") return booking.status === "pending"
      if (activeTab === "approved") return booking.status === "approved" && new Date(booking.startTime) >= now
      if (activeTab === "history") return booking.status !== "pending" && (booking.status !== "approved" || new Date(booking.startTime) < now)
      return true
    })

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(b => 
        b.title.toLowerCase().includes(query) ||
        b.resource.name.toLowerCase().includes(query) ||
        (b.user.name || "").toLowerCase().includes(query) ||
        b.user.email.toLowerCase().includes(query)
      )
    }

    // Sort by date
    filtered.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

    return filtered
  }, [groupedBookings, activeTab, searchQuery])

  // Counts for tabs
  const counts = useMemo(() => ({
    pending: bookings.filter(b => b.status === "pending").length,
    approved: bookings.filter(b => b.status === "approved" && new Date(b.startTime) >= new Date()).length,
    history: bookings.filter(b => b.status !== "pending" && (b.status !== "approved" || new Date(b.startTime) < new Date())).length
  }), [bookings])

  const handleAction = useCallback(async (bookingId: string, action: "approve" | "reject", applyToAll: boolean = false, statusNote?: string) => {
    setProcessingId(bookingId)
    const booking = bookings.find(b => b.id === bookingId)
    
    const requestBody: { action: string; applyToAll?: boolean; statusNote?: string } = { action }
    if (applyToAll && booking?.isRecurring) {
      requestBody.applyToAll = true
    }
    if (statusNote) {
      requestBody.statusNote = statusNote
    }
    const bodyString = JSON.stringify(requestBody)
    console.log("Sending request:", { bookingId, action, requestBody, bodyString })
    
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: bodyString
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Ukjent feil" }))
        console.error("Error approving/rejecting booking:", errorData)
        const actionText = action === "approve" ? "godkjenne" : "avslå"
        alert(`Feil: ${errorData.error || `Kunne ikke ${actionText} booking`}`)
        setProcessingId(null)
        return
      }

      const result = await response.json()
      
      // Refresh bookings from server to get accurate state
      await fetchBookings()
      
      // Close reject modal if it was open
      if (action === "reject") {
        setRejectingId(null)
        setRejectReason("")
        setRejectApplyToAll(false)
      }
    } catch (error) {
      console.error("Error in handleAction:", error)
      alert(`Feil: ${error instanceof Error ? error.message : "Noe gikk galt"}`)
    } finally {
      setProcessingId(null)
    }
  }, [bookings, fetchBookings])

  const handleCancel = useCallback(async (bookingId: string) => {
    setProcessingId(bookingId)
    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason })
      })
      if (response.ok) {
        setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: "cancelled" } : b))
      }
    } catch (error) {
      console.error("Failed to cancel booking:", error)
    } finally {
      setProcessingId(null)
      setCancellingId(null)
      setCancelReason("")
    }
  }, [cancelReason])

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(groupId)) {
        newExpanded.delete(groupId)
      } else {
        newExpanded.add(groupId)
      }
      return newExpanded
    })
  }, [])

  const formatDateLabel = useCallback((dateStr: string) => {
    const date = parseISO(dateStr)
    if (isToday(date)) return "I dag"
    if (isTomorrow(date)) return "I morgen"
    if (isThisWeek(date, { weekStartsOn: 1 })) return format(date, "EEEE", { locale: nb })
    return format(date, "d. MMM", { locale: nb })
  }, [])

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

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Behandle bookinger</h1>
          <p className="text-gray-500">Godkjenn eller avslå bookingforespørsler</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => setActiveTab("pending")}
            className={`p-4 rounded-xl text-left transition-all ${
              activeTab === "pending" 
                ? "bg-amber-50 border-2 border-amber-200 shadow-sm" 
                : "bg-white border border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Clock className={`w-5 h-5 ${activeTab === "pending" ? "text-amber-600" : "text-gray-400"}`} />
              <span className={`text-2xl font-bold ${activeTab === "pending" ? "text-amber-700" : "text-gray-900"}`}>
                {counts.pending}
              </span>
            </div>
            <p className={`text-sm ${activeTab === "pending" ? "text-amber-600" : "text-gray-500"}`}>
              Venter på behandling
            </p>
          </button>

          <button
            onClick={() => setActiveTab("approved")}
            className={`p-4 rounded-xl text-left transition-all ${
              activeTab === "approved" 
                ? "bg-green-50 border-2 border-green-200 shadow-sm" 
                : "bg-white border border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className={`w-5 h-5 ${activeTab === "approved" ? "text-green-600" : "text-gray-400"}`} />
              <span className={`text-2xl font-bold ${activeTab === "approved" ? "text-green-700" : "text-gray-900"}`}>
                {counts.approved}
              </span>
            </div>
            <p className={`text-sm ${activeTab === "approved" ? "text-green-600" : "text-gray-500"}`}>
              Kommende godkjente
            </p>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`p-4 rounded-xl text-left transition-all ${
              activeTab === "history" 
                ? "bg-gray-100 border-2 border-gray-300 shadow-sm" 
                : "bg-white border border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Calendar className={`w-5 h-5 ${activeTab === "history" ? "text-gray-600" : "text-gray-400"}`} />
              <span className={`text-2xl font-bold ${activeTab === "history" ? "text-gray-700" : "text-gray-900"}`}>
                {counts.history}
              </span>
            </div>
            <p className={`text-sm ${activeTab === "history" ? "text-gray-600" : "text-gray-500"}`}>
              Historikk
            </p>
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Søk etter tittel, fasilitet, bruker..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        {/* Bookings list */}
        {filteredBookings.length === 0 ? (
          <div className="card p-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {activeTab === "pending" ? "Ingen ventende bookinger" : "Ingen bookinger funnet"}
            </h2>
            <p className="text-gray-500">
              {activeTab === "pending" ? "Alle bookinger er behandlet 🎉" : "Prøv et annet søk"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Booking</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Dato</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Bruker</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Handling</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBookings.map((booking: any) => {
                  const isGrouped = booking._groupId
                  const groupBookings = isGrouped ? groupedBookings.groups[booking._groupId] : null
                  const isExpanded = expandedGroups.has(booking._groupId)
                  const pendingInGroup = groupBookings?.filter(b => b.status === "pending").length || 0

                  // Render main row + expanded child rows if applicable
                  const rows = []
                  
                  // Main row
                  rows.push(
                    <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          {isGrouped && (
                            <button 
                              onClick={() => toggleGroup(booking._groupId)}
                              className="mt-1 p-0.5 rounded hover:bg-gray-200"
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-900 truncate">{booking.title}</span>
                              {booking.status === "pending" && (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Venter</span>
                              )}
                              {booking.status === "approved" && (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Godkjent</span>
                              )}
                              {booking.status === "rejected" && (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">Avslått</span>
                              )}
                              {booking.status === "cancelled" && (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Kansellert</span>
                              )}
                            </div>
                            {booking.status === "rejected" && booking.statusNote && (
                              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-xs text-red-800">
                                  <span className="font-medium">Begrunnelse:</span> {booking.statusNote}
                                </p>
                              </div>
                            )}
                            <p className="text-sm text-gray-500 truncate">
                              {booking.resource.name}
                              {booking.resourcePart && ` → ${booking.resourcePart.name}`}
                            </p>
                            {isGrouped && (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                                  <Repeat className="w-3 h-3" />
                                  {booking._groupCount} ganger
                                  {pendingInGroup > 0 && activeTab !== "pending" && ` (${pendingInGroup} venter)`}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 truncate">
                              {booking.resource.name}
                              {booking.resourcePart && ` → ${booking.resourcePart.name}`}
                            </p>
                            <p className="text-xs text-gray-400 md:hidden mt-1">
                              {formatDateLabel(booking.startTime)} • {format(parseISO(booking.startTime), "HH:mm")}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <p className="text-sm font-medium text-gray-900">{formatDateLabel(booking.startTime)}</p>
                        <p className="text-xs text-gray-500">
                          {format(parseISO(booking.startTime), "HH:mm")} - {format(parseISO(booking.endTime), "HH:mm")}
                        </p>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <p className="text-sm text-gray-900">{booking.user.name || booking.contactName || "—"}</p>
                        <p className="text-xs text-gray-500">{booking.user.email}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {booking.status === "pending" && (
                            <>
                              {isGrouped ? (
                                <div className="flex flex-col gap-1">
                                  <button
                                    onClick={() => handleAction(booking.id, "approve", true)}
                                    disabled={processingId === booking.id}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {processingId === booking.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                    Godkjenn alle
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRejectingId(booking.id)
                                      setRejectApplyToAll(true)
                                    }}
                                    disabled={processingId === booking.id}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    Avslå alle
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleAction(booking.id, "approve", false)}
                                    disabled={processingId === booking.id}
                                    className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
                                    title="Godkjenn"
                                  >
                                    {processingId === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRejectingId(booking.id)
                                      setRejectApplyToAll(false)
                                    }}
                                    disabled={processingId === booking.id}
                                    className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                                    title="Avslå"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                          {(booking.status === "approved" || booking.status === "pending") && (
                            <button
                              onClick={() => setCancellingId(booking.id)}
                              disabled={processingId === booking.id}
                              className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:opacity-50"
                              title="Kanseller"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )

                  // Add expanded child rows for recurring bookings
                  if (isExpanded && groupBookings && groupBookings.length > 1) {
                    groupBookings.slice(1).forEach((childBooking) => {
                      rows.push(
                        <tr key={childBooking.id} className="bg-blue-50/30 hover:bg-blue-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-3 pl-8">
                              <div className="w-2 h-2 rounded-full bg-blue-400 mt-2" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm text-gray-700">{childBooking.title}</span>
                                  {childBooking.status === "pending" && (
                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Venter</span>
                                  )}
                                  {childBooking.status === "approved" && (
                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Godkjent</span>
                                  )}
                                  {childBooking.status === "rejected" && (
                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">Avslått</span>
                                  )}
                                  {childBooking.status === "rejected" && childBooking.statusNote && (
                                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                                      <p className="text-xs text-red-800">
                                        <span className="font-medium">Begrunnelse:</span> {childBooking.statusNote}
                                      </p>
                                    </div>
                                  )}
                                  {childBooking.status === "cancelled" && (
                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Kansellert</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <p className="text-sm text-gray-700">{formatDateLabel(childBooking.startTime)}</p>
                            <p className="text-xs text-gray-500">
                              {format(parseISO(childBooking.startTime), "HH:mm")} - {format(parseISO(childBooking.endTime), "HH:mm")}
                            </p>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <p className="text-xs text-gray-500">—</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {childBooking.status === "pending" && (
                                <>
                                  <button
                                    onClick={() => handleAction(childBooking.id, "approve", false)}
                                    disabled={processingId === childBooking.id}
                                    className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
                                    title="Godkjenn"
                                  >
                                    {processingId === childBooking.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRejectingId(childBooking.id)
                                      setRejectApplyToAll(false)
                                    }}
                                    disabled={processingId === childBooking.id}
                                    className="p-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                                    title="Avslå"
                                  >
                                    <XCircle className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  }

                  return rows
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectingId && (() => {
        const booking = bookings.find(b => b.id === rejectingId)
        const isRecurring = booking?.isRecurring && rejectApplyToAll
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full shadow-2xl p-6 animate-fadeIn">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                Avslå booking{isRecurring ? "er" : ""}?
              </h3>
              <p className="text-gray-600 text-center mb-4">
                {isRecurring 
                  ? "Alle gjentakende bookinger vil bli avslått. Brukeren vil bli varslet på e-post."
                  : "Brukeren vil bli varslet på e-post."}
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Begrunnelse (valgfritt)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="F.eks. Fasiliteten er allerede booket..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setRejectingId(null)
                    setRejectReason("")
                    setRejectApplyToAll(false)
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={() => handleAction(rejectingId, "reject", rejectApplyToAll, rejectReason || undefined)}
                  disabled={processingId === rejectingId}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {processingId === rejectingId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Avslå
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Cancel modal */}
      {cancellingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Kanseller booking?</h3>
            <p className="text-gray-600 mb-4">Brukeren vil bli varslet på e-post.</p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Årsak (valgfritt)..."
              className="w-full p-3 border border-gray-200 rounded-lg mb-4 min-h-[80px]"
            />
            <div className="flex gap-3">
              <button onClick={() => { setCancellingId(null); setCancelReason("") }} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50">
                Avbryt
              </button>
              <button onClick={() => handleCancel(cancellingId)} disabled={processingId === cancellingId} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50">
                {processingId === cancellingId ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Ja, kanseller"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
