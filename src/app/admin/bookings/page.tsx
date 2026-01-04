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
  AlertCircle,
  Eye,
  FileText,
  X
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
  contactPhone: string | null
  isRecurring: boolean
  parentBookingId: string | null
  totalAmount: number | null
  preferredPaymentMethod: string | null
  invoiceId: string | null
  invoice: { id: string; status: string; invoiceNumber: string } | null
  resource: { name: string }
  resourcePart: { name: string } | null
  user: { name: string | null; email: string }
  payments?: Array<{ id: string; status: string; paymentMethod: string; amount: number }>
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
  const [pricingEnabled, setPricingEnabled] = useState(false)
  
  // Booking details modal state
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [invoicePreviewModalOpen, setInvoicePreviewModalOpen] = useState(false)
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState<string | null>(null)
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null)
  const [isSendingInvoice, setIsSendingInvoice] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else {
      const isAdmin = session?.user?.role === "admin"
      const isModerator = session?.user?.role === "moderator"
      if (!isAdmin && !isModerator) {
        router.push("/")
      }
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
    const isAdmin = session?.user?.role === "admin"
    const isModerator = session?.user?.role === "moderator"
    if (isAdmin || isModerator) {
      fetchBookings()
      // Sjekk om pricing er aktivert
      fetch("/api/pricing/status")
        .then(res => res.json())
        .then(data => setPricingEnabled(data.enabled || false))
        .catch(() => setPricingEnabled(false))
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
      
      // Close modals
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

  // Godkjenn booking direkte (brukeren har allerede valgt betalingsmetode)
  const handleApproveClick = useCallback((bookingId: string, applyToAll: boolean = false) => {
    handleAction(bookingId, "approve", applyToAll)
  }, [handleAction])

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

  // Handle viewing invoice
  const handleViewInvoice = useCallback(async (invoiceId: string) => {
    try {
      setIsLoadingPreview(true)
      
      // Fetch PDF preview
      const pdfResponse = await fetch(`/api/invoices/${invoiceId}/pdf`)
      if (!pdfResponse.ok) {
        const errorData = await pdfResponse.json().catch(() => ({}))
        throw new Error(errorData.error || "Kunne ikke generere PDF-forhåndsvisning")
      }
      
      const blob = await pdfResponse.blob()
      const url = URL.createObjectURL(blob)
      setInvoicePreviewUrl(url)
      setSendingInvoiceId(invoiceId)
      setInvoicePreviewModalOpen(true)
    } catch (error) {
      console.error("Error loading invoice preview:", error)
      alert(error instanceof Error ? error.message : "Kunne ikke laste forhåndsvisning")
    } finally {
      setIsLoadingPreview(false)
    }
  }, [])

  // Handle sending invoice
  const confirmSendInvoice = useCallback(async () => {
    if (!sendingInvoiceId) return
    
    setIsSendingInvoice(true)
    try {
      const response = await fetch(`/api/invoices/${sendingInvoiceId}/send`, {
        method: "POST",
      })
      
      if (response.ok) {
        setInvoicePreviewModalOpen(false)
        setInvoicePreviewUrl(null)
        setSendingInvoiceId(null)
        if (invoicePreviewUrl) {
          URL.revokeObjectURL(invoicePreviewUrl)
        }
        // Refresh bookings
        await fetchBookings()
      } else {
        const error = await response.json()
        throw new Error(error.error || "Kunne ikke sende faktura")
      }
    } catch (error) {
      console.error("Error sending invoice:", error)
      alert(error instanceof Error ? error.message : "Kunne ikke sende faktura")
    } finally {
      setIsSendingInvoice(false)
    }
  }, [sendingInvoiceId, invoicePreviewUrl, fetchBookings])

  // Handle marking as paid
  const handleMarkAsPaid = useCallback(async (bookingId: string) => {
    setProcessingId(bookingId)
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/mark-paid`, {
        method: "POST",
      })
      if (response.ok) {
        await fetchBookings()
        if (selectedBooking?.id === bookingId) {
          // Refresh selected booking
          const updatedBooking = bookings.find(b => b.id === bookingId)
          if (updatedBooking) {
            setSelectedBooking(updatedBooking)
          }
        }
      } else {
        const error = await response.json()
        alert(error.error || "Kunne ikke markere som betalt")
      }
    } catch (error) {
      console.error("Failed to mark as paid:", error)
      alert("Kunne ikke markere som betalt")
    } finally {
      setProcessingId(null)
    }
  }, [bookings, selectedBooking, fetchBookings])

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
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Booking</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fasilitet</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Dato & Tid</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bruker</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kontakt</th>
                  {pricingEnabled && (
                    <>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pris</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Betalingsmetode</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Betalingsstatus</th>
                    </>
                  )}
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
                    <tr 
                      key={booking.id} 
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedBooking(booking)}
                    >
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
                              <span className="font-medium text-gray-900">{booking.title}</span>
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
                            {booking.description && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{booking.description}</p>
                            )}
                            {isGrouped && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 mt-1">
                                <Repeat className="w-3 h-3" />
                                {booking._groupCount} ganger
                                {pendingInGroup > 0 && activeTab !== "pending" && ` (${pendingInGroup} venter)`}
                              </span>
                            )}
                            {booking.status === "rejected" && booking.statusNote && (
                              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-xs text-red-800">
                                  <span className="font-medium">Begrunnelse:</span> {booking.statusNote}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{booking.resource.name}</p>
                          {booking.resourcePart && (
                            <p className="text-xs text-gray-500 mt-0.5">{booking.resourcePart.name}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {(() => {
                          const start = parseISO(booking.startTime)
                          const end = parseISO(booking.endTime)
                          const startDateStr = format(start, "d. MMM yyyy", { locale: nb })
                          const endDateStr = format(end, "d. MMM yyyy", { locale: nb })
                          const isSameDay = startDateStr === endDateStr
                          const durationMs = end.getTime() - start.getTime()
                          const hours = Math.floor(durationMs / (1000 * 60 * 60))
                          const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
                          
                          let durationStr = ""
                          if (hours === 0) {
                            durationStr = `${minutes} min`
                          } else if (minutes === 0) {
                            durationStr = `${hours} ${hours === 1 ? "time" : "timer"}`
                          } else {
                            durationStr = `${hours} ${hours === 1 ? "time" : "timer"} ${minutes} min`
                          }
                          
                          if (isSameDay) {
                            return (
                              <div>
                                <p className="text-sm font-medium text-gray-900">{formatDateLabel(booking.startTime)}</p>
                                <p className="text-xs text-gray-500">{format(start, "HH:mm")} - {format(end, "HH:mm")}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{durationStr}</p>
                              </div>
                            )
                          } else {
                            return (
                              <div>
                                <p className="text-xs text-gray-500">Fra: {format(start, "d. MMM", { locale: nb })} kl. {format(start, "HH:mm")}</p>
                                <p className="text-xs text-gray-500">Til: {format(end, "d. MMM", { locale: nb })} kl. {format(end, "HH:mm")}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{durationStr}</p>
                              </div>
                            )
                          }
                        })()}
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="text-sm text-gray-900">{booking.user.name || booking.contactName || "—"}</p>
                          <p className="text-xs text-gray-500">{booking.user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="text-xs text-gray-900">{booking.contactName || booking.user.name || "—"}</p>
                          <p className="text-xs text-gray-500">{booking.contactEmail || booking.user.email}</p>
                          {booking.contactPhone && (
                            <p className="text-xs text-gray-500 mt-0.5">{booking.contactPhone}</p>
                          )}
                        </div>
                      </td>
                      {pricingEnabled && (
                        <>
                          <td className="px-4 py-4">
                            {booking.totalAmount && booking.totalAmount > 0 ? (
                              <p className="text-sm font-semibold text-gray-900">
                                {Math.round(Number(booking.totalAmount))} kr
                              </p>
                            ) : (
                              <p className="text-xs text-gray-400">Gratis</p>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {booking.preferredPaymentMethod ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700">
                                  {booking.preferredPaymentMethod === "INVOICE" && "Faktura"}
                                  {booking.preferredPaymentMethod === "VIPPS" && "Vipps"}
                                  {booking.preferredPaymentMethod === "CARD" && "Kort"}
                                </span>
                                {booking.preferredPaymentMethod === "INVOICE" && booking.invoice && (
                                  <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                                    (booking.invoice.status === "PAID" || booking.invoice.status === "SENT")
                                      ? "bg-blue-100 text-blue-700"
                                      : booking.invoice.status === "DRAFT"
                                      ? "bg-gray-100 text-gray-600"
                                      : "bg-orange-100 text-orange-700"
                                  }`}>
                                    {(booking.invoice.status === "PAID" || booking.invoice.status === "SENT") && "Sendt"}
                                    {booking.invoice.status === "DRAFT" && "Kladd"}
                                    {booking.invoice.status === "OVERDUE" && "Forfalt"}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400">—</p>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {booking.payments && booking.payments.length > 0 ? (
                              <div className="space-y-1">
                                {booking.payments.map((payment: any) => (
                                  <div key={payment.id} className="flex items-center gap-2">
                                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                                      payment.status === "COMPLETED" 
                                        ? "bg-green-100 text-green-700" 
                                        : "bg-amber-100 text-amber-700"
                                    }`}>
                                      {payment.status === "COMPLETED" ? "Betalt" : "Venter"}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {Math.round(Number(payment.amount))} kr
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : booking.invoice && booking.preferredPaymentMethod === "INVOICE" ? (
                              <div className="space-y-1">
                                <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                                  booking.invoice.status === "PAID" 
                                    ? "bg-green-100 text-green-700"
                                    : booking.invoice.status === "SENT"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}>
                                  {booking.invoice.status === "PAID" && "Betalt"}
                                  {booking.invoice.status === "SENT" && "Faktura sendt"}
                                  {booking.invoice.status === "DRAFT" && "Faktura kladd"}
                                  {booking.invoice.status === "OVERDUE" && "Forfalt"}
                                </span>
                              </div>
                            ) : booking.totalAmount && booking.totalAmount > 0 ? (
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                                Ikke betalt
                              </span>
                            ) : (
                              <p className="text-xs text-gray-400">—</p>
                            )}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {booking.status === "pending" && (
                            <>
                              {isGrouped ? (
                                <div className="flex flex-col gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleApproveClick(booking.id, true)
                                    }}
                                    disabled={processingId === booking.id}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {processingId === booking.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                    Godkjenn alle
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
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
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleApproveClick(booking.id, false)
                                    }}
                                    disabled={processingId === booking.id}
                                    className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
                                    title="Godkjenn"
                                  >
                                    {processingId === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
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
                          {booking.status === "approved" && booking.invoice && booking.preferredPaymentMethod === "INVOICE" && (
                            <>
                              {booking.invoice.status === "DRAFT" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedBooking(booking)
                                  }}
                                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1"
                                  title="Se faktura"
                                >
                                  <Eye className="w-3 h-3" />
                                  Se faktura
                                </button>
                              )}
                              {booking.invoice.status === "SENT" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedBooking(booking)
                                  }}
                                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center gap-1"
                                  title="Marker som betalt"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  Betalt
                                </button>
                              )}
                            </>
                          )}
                          {(booking.status === "approved" || booking.status === "pending") && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setCancellingId(booking.id)
                              }}
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
                                  {childBooking.status === "cancelled" && (
                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Kansellert</span>
                                  )}
                                </div>
                                {childBooking.description && (
                                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{childBooking.description}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm text-gray-700">{childBooking.resource.name}</p>
                              {childBooking.resourcePart && (
                                <p className="text-xs text-gray-500 mt-0.5">{childBooking.resourcePart.name}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm text-gray-700">{formatDateLabel(childBooking.startTime)}</p>
                              <p className="text-xs text-gray-500">
                                {format(parseISO(childBooking.startTime), "HH:mm")} - {format(parseISO(childBooking.endTime), "HH:mm")}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-gray-500">—</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-gray-500">—</p>
                          </td>
                          {pricingEnabled && (
                            <>
                              <td className="px-4 py-3">
                                {childBooking.totalAmount && childBooking.totalAmount > 0 ? (
                                  <p className="text-sm font-semibold text-gray-900">
                                    {Math.round(Number(childBooking.totalAmount))} kr
                                  </p>
                                ) : (
                                  <p className="text-xs text-gray-400">Gratis</p>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {childBooking.preferredPaymentMethod ? (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700">
                                      {childBooking.preferredPaymentMethod === "INVOICE" && "Faktura"}
                                      {childBooking.preferredPaymentMethod === "VIPPS" && "Vipps"}
                                      {childBooking.preferredPaymentMethod === "CARD" && "Kort"}
                                    </span>
                                    {childBooking.preferredPaymentMethod === "INVOICE" && childBooking.invoice && (
                                      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                                        (childBooking.invoice.status === "PAID" || childBooking.invoice.status === "SENT")
                                          ? "bg-blue-100 text-blue-700"
                                          : childBooking.invoice.status === "DRAFT"
                                          ? "bg-gray-100 text-gray-600"
                                          : "bg-orange-100 text-orange-700"
                                      }`}>
                                        {(childBooking.invoice.status === "PAID" || childBooking.invoice.status === "SENT") && "Sendt"}
                                        {childBooking.invoice.status === "DRAFT" && "Kladd"}
                                        {childBooking.invoice.status === "OVERDUE" && "Forfalt"}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-400">—</p>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {childBooking.payments && childBooking.payments.length > 0 ? (
                                  <div className="space-y-1">
                                    {childBooking.payments.map((payment: any) => (
                                      <div key={payment.id} className="flex items-center gap-2">
                                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                                          payment.status === "COMPLETED" 
                                            ? "bg-green-100 text-green-700" 
                                            : "bg-amber-100 text-amber-700"
                                        }`}>
                                          {payment.status === "COMPLETED" ? "Betalt" : "Venter"}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : childBooking.invoice && childBooking.preferredPaymentMethod === "INVOICE" ? (
                                  <div className="space-y-1">
                                    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                                      childBooking.invoice.status === "PAID" 
                                        ? "bg-green-100 text-green-700"
                                        : childBooking.invoice.status === "SENT"
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-gray-100 text-gray-600"
                                    }`}>
                                      {childBooking.invoice.status === "PAID" && "Betalt"}
                                      {childBooking.invoice.status === "SENT" && "Faktura sendt"}
                                      {childBooking.invoice.status === "DRAFT" && "Faktura kladd"}
                                      {childBooking.invoice.status === "OVERDUE" && "Forfalt"}
                                    </span>
                                  </div>
                                ) : childBooking.totalAmount && childBooking.totalAmount > 0 ? (
                                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                                    Ikke betalt
                                  </span>
                                ) : (
                                  <p className="text-xs text-gray-400">—</p>
                                )}
                              </td>
                            </>
                          )}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {childBooking.status === "pending" && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleApproveClick(childBooking.id, false)
                                    }}
                                    disabled={processingId === childBooking.id}
                                    className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
                                    title="Godkjenn"
                                  >
                                    {processingId === childBooking.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
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

      {/* Booking details modal */}
      {selectedBooking && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedBooking(null)}
        >
          <div 
            className="bg-white rounded-xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900">{selectedBooking.title}</h3>
                  <p className="text-gray-500 mt-1">
                    {selectedBooking.resource.name}
                    {selectedBooking.resourcePart && ` • ${selectedBooking.resourcePart.name}`}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Status */}
              <div className="flex items-center gap-2 flex-wrap">
                {selectedBooking.status === "pending" && (
                  <span className="px-3 py-1 text-sm font-medium rounded-full bg-amber-100 text-amber-700">
                    Venter på godkjenning
                  </span>
                )}
                {selectedBooking.status === "approved" && (
                  <span className="px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-700">
                    Godkjent
                  </span>
                )}
                {selectedBooking.invoice && selectedBooking.preferredPaymentMethod === "INVOICE" && (
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                    selectedBooking.invoice.status === "PAID" 
                      ? "bg-green-100 text-green-700"
                      : selectedBooking.invoice.status === "SENT"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {selectedBooking.invoice.status === "PAID" && "Betalt"}
                    {selectedBooking.invoice.status === "SENT" && "Faktura sendt"}
                    {selectedBooking.invoice.status === "DRAFT" && "Faktura kladd"}
                    {selectedBooking.invoice.status === "OVERDUE" && "Forfalt"}
                  </span>
                )}
              </div>

              {/* Date and time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Fra</h4>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>
                      {format(parseISO(selectedBooking.startTime), "EEEE d. MMMM yyyy", { locale: nb })}
                      {" kl. "}
                      {format(parseISO(selectedBooking.startTime), "HH:mm")}
                    </span>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Til</h4>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>
                      {format(parseISO(selectedBooking.endTime), "EEEE d. MMMM yyyy", { locale: nb })}
                      {" kl. "}
                      {format(parseISO(selectedBooking.endTime), "HH:mm")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Price and payment info */}
              {pricingEnabled && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Betaling</h4>
                  {selectedBooking.totalAmount && selectedBooking.totalAmount > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Totalpris:</span>
                        <span className="text-lg font-bold text-gray-900">
                          {Math.round(Number(selectedBooking.totalAmount))} kr
                        </span>
                      </div>
                      {selectedBooking.preferredPaymentMethod && (
                        <div>
                          <span className="text-sm text-gray-600">Betalingsmetode: </span>
                          <span className="text-sm font-medium text-gray-900">
                            {selectedBooking.preferredPaymentMethod === "INVOICE" && "Faktura"}
                            {selectedBooking.preferredPaymentMethod === "VIPPS" && "Vipps"}
                            {selectedBooking.preferredPaymentMethod === "CARD" && "Kort"}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <span className="text-sm font-medium text-green-700">Gratis booking</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              {selectedBooking.status === "pending" && (
                <div className="border-t pt-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveClick(selectedBooking.id, false)}
                      disabled={processingId === selectedBooking.id}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {processingId === selectedBooking.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Behandler...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Godkjenn
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBooking(null)
                        setRejectingId(selectedBooking.id)
                        setRejectApplyToAll(false)
                      }}
                      disabled={processingId === selectedBooking.id}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Avslå
                    </button>
                  </div>
                </div>
              )}
              {selectedBooking.status === "approved" && 
               selectedBooking.invoice && 
               selectedBooking.preferredPaymentMethod === "INVOICE" && (
                <div className="border-t pt-4">
                  {selectedBooking.invoice.status === "DRAFT" && (
                    <button
                      onClick={() => handleViewInvoice(selectedBooking.invoice!.id)}
                      disabled={isLoadingPreview}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isLoadingPreview ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Laster...
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          Se faktura
                        </>
                      )}
                    </button>
                  )}
                  {selectedBooking.invoice.status === "SENT" && (
                    <button
                      onClick={() => handleMarkAsPaid(selectedBooking.id)}
                      disabled={processingId === selectedBooking.id}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {processingId === selectedBooking.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Behandler...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Betalt
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice PDF Preview Modal */}
      {invoicePreviewModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Forhåndsvisning av faktura</h3>
                <p className="text-sm text-gray-500 mt-1">Se gjennom fakturaen før den sendes</p>
              </div>
              <button
                onClick={() => {
                  setInvoicePreviewModalOpen(false)
                  if (invoicePreviewUrl) {
                    URL.revokeObjectURL(invoicePreviewUrl)
                    setInvoicePreviewUrl(null)
                  }
                  setSendingInvoiceId(null)
                }}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            {/* PDF Preview */}
            <div className="flex-1 overflow-auto p-6 bg-gray-50">
              {isLoadingPreview ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : invoicePreviewUrl ? (
                <iframe
                  src={invoicePreviewUrl}
                  className="w-full h-full min-h-[600px] border border-gray-200 rounded-lg"
                  title="Faktura forhåndsvisning"
                />
              ) : (
                <div className="flex items-center justify-center h-64">
                  <p className="text-gray-500">Kunne ikke laste forhåndsvisning</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setInvoicePreviewModalOpen(false)
                  if (invoicePreviewUrl) {
                    URL.revokeObjectURL(invoicePreviewUrl)
                    setInvoicePreviewUrl(null)
                  }
                  setSendingInvoiceId(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={confirmSendInvoice}
                disabled={isSendingInvoice || !invoicePreviewUrl}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isSendingInvoice ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sender...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Send faktura
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
