"use client"

import React from "react"
import { useSession } from "next-auth/react"
import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { PageLayout } from "@/components/PageLayout"
import Link from "next/link"
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Hourglass,
  Trash2,
  ChevronRight,
  Plus,
  Pencil,
  ClipboardList,
  X,
  ChevronUp,
  ChevronDown,
  FolderOpen
} from "lucide-react"
import { EditBookingModal } from "@/components/EditBookingModal"
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
  totalAmount: number | null
  invoiceId: string | null
  isRecurring?: boolean
  parentBookingId?: string | null
  invoice?: { id: string; status: string; invoiceNumber: string } | null
  preferredPaymentMethod: string | null
  resource: {
    id: string
    name: string
    location: string | null
    color?: string
    category: {
      id: string
      name: string
      color: string | null
    } | null
  }
  resourcePart: { id: string; name: string } | null
  payments?: Array<{ id: string; status: string; paymentMethod: string; amount: number }>
}

type Tab = "upcoming" | "history"

export default function MyBookingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("upcoming")
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)
  const [unreadCounts, setUnreadCounts] = useState({ upcoming: 0, history: 0 })
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set())
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [pricingEnabled, setPricingEnabled] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Get unique categories from bookings
  const categories = useMemo(() => {
    const categoryMap = new Map<string, { id: string; name: string; color: string | null }>()
    bookings.forEach(b => {
      if (b.resource.category && !categoryMap.has(b.resource.category.id)) {
        categoryMap.set(b.resource.category.id, {
          id: b.resource.category.id,
          name: b.resource.category.name,
          color: b.resource.category.color
        })
      }
    })
    return Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [bookings])

  // Get unique resources from bookings, filtered by selected category
  const resources = useMemo(() => {
    const resourceMap = new Map<string, { id: string; name: string }>()
    const filteredBookings = selectedCategoryId
      ? bookings.filter(b => b.resource.category?.id === selectedCategoryId)
      : bookings
    filteredBookings.forEach(b => {
      if (!resourceMap.has(b.resource.id)) {
        resourceMap.set(b.resource.id, { id: b.resource.id, name: b.resource.name })
      }
    })
    return Array.from(resourceMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [bookings, selectedCategoryId])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/my-bookings")
    }
  }, [status, router])

  const fetchBookings = useCallback(async () => {
    if (!session) return
    try {
      const res = await fetch("/api/bookings")
      const data = await res.json()
      setBookings(data)
    } catch (error) {
      console.error("Failed to fetch bookings:", error)
    } finally {
      setIsLoading(false)
    }
  }, [session])

  useEffect(() => {
    if (session) {
      fetchBookings()
      // Sjekk om pricing er aktivert
      fetch("/api/pricing/status")
        .then(res => res.json())
        .then(data => setPricingEnabled(data.enabled || false))
        .catch(() => setPricingEnabled(false))
    }
  }, [session, fetchBookings])

  // Fetch unread counts
  const fetchUnreadCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/bookings/unread")
      if (res.ok) {
        const data = await res.json()
        setUnreadCounts({ upcoming: data.upcoming, history: data.history })
      }
    } catch (error) {
      console.error("Failed to fetch unread counts:", error)
    }
  }, [])

  useEffect(() => {
    if (session) {
      fetchUnreadCounts()
    }
  }, [session, fetchUnreadCounts])

  // Mark bookings as seen when switching tabs
  const handleTabChange = useCallback(async (tab: Tab) => {
    setActiveTab(tab)
    setSelectedForDelete(new Set()) // Clear selection when switching tabs
    
    // Mark bookings as seen for this tab
    if ((tab === "upcoming" && unreadCounts.upcoming > 0) || 
        (tab === "history" && unreadCounts.history > 0)) {
      try {
        await fetch("/api/bookings/mark-seen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: tab })
        })
        // Update local state
        setUnreadCounts(prev => ({
          ...prev,
          [tab]: 0
        }))
      } catch (error) {
        console.error("Failed to mark bookings as seen:", error)
      }
    }
  }, [unreadCounts])

  const handleCancel = useCallback(async (bookingId: string) => {
    setIsProcessing(true)
    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason || undefined })
      })
      if (response.ok) {
        setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: "cancelled" } : b))
        setCancelReason("")
      }
    } catch (error) {
      console.error("Failed to cancel booking:", error)
    } finally {
      setIsProcessing(false)
      setCancellingId(null)
    }
  }, [cancelReason])

  const handleDelete = useCallback(async (bookingId: string) => {
    setIsProcessing(true)
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "DELETE"
      })
      if (response.ok) {
        setBookings(prev => prev.filter(b => b.id !== bookingId))
      }
    } catch (error) {
      console.error("Failed to delete booking:", error)
    } finally {
      setIsProcessing(false)
      setDeletingId(null)
    }
  }, [])

  const handleBulkDelete = useCallback(async () => {
    if (selectedForDelete.size === 0) return
    setIsProcessing(true)
    try {
      // Delete all selected bookings in parallel
      const deletePromises = Array.from(selectedForDelete).map(id =>
        fetch(`/api/bookings/${id}`, { method: "DELETE" })
      )
      await Promise.all(deletePromises)
      setBookings(prev => prev.filter(b => !selectedForDelete.has(b.id)))
      setSelectedForDelete(new Set())
    } catch (error) {
      console.error("Failed to delete bookings:", error)
    } finally {
      setIsProcessing(false)
      setShowBulkDeleteModal(false)
    }
  }, [selectedForDelete])

  const toggleSelectBooking = useCallback((bookingId: string) => {
    setSelectedForDelete(prev => {
      const newSet = new Set(prev)
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId)
      } else {
        newSet.add(bookingId)
      }
      return newSet
    })
  }, [])

  const toggleSelectAll = useCallback((bookingIds: string[]) => {
    setSelectedForDelete(prev => {
      const allSelected = bookingIds.every(id => prev.has(id))
      if (allSelected) {
        // Deselect all
        return new Set()
      } else {
        // Select all
        return new Set(bookingIds)
      }
    })
  }, [])

  // Helper function to determine payment status
  const getPaymentStatus = (booking: Booking): "paid" | "unpaid" | "pending_payment" | "free" => {
    if (!pricingEnabled || !booking.totalAmount || booking.totalAmount === 0) {
      return "free"
    }
    
    if (!booking.payments || booking.payments.length === 0) {
      return "unpaid"
    }
    
    const totalPaid = booking.payments
      .filter(p => p.status === "COMPLETED")
      .reduce((sum, p) => sum + Number(p.amount), 0)
    
    if (totalPaid >= Number(booking.totalAmount)) {
      return "paid"
    }
    
    const hasPending = booking.payments.some(p => 
      p.status === "PENDING" || p.status === "PROCESSING"
    )
    
    return hasPending ? "pending_payment" : "unpaid"
  }

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ChevronUp className="w-4 h-4 text-gray-300" />
    }
    return sortDirection === "asc" 
      ? <ChevronUp className="w-4 h-4 text-gray-600" />
      : <ChevronDown className="w-4 h-4 text-gray-600" />
  }

  // Categorize and filter bookings
  const { upcoming, history } = useMemo(() => {
    const now = new Date()
    let filtered = bookings
    
    // Filter by category
    if (selectedCategoryId) {
      filtered = filtered.filter(b => b.resource.category?.id === selectedCategoryId)
    }
    
    // Filter by resource
    if (selectedResourceId) {
      filtered = filtered.filter(b => b.resource.id === selectedResourceId)
    }
    
    let upcomingBookings = filtered.filter(b => 
      new Date(b.startTime) >= now && 
      (b.status === "pending" || b.status === "approved")
    )
    
    let historyBookings = filtered.filter(b => 
      new Date(b.startTime) < now || 
      b.status === "rejected" || 
      b.status === "cancelled"
    )
    
    // Apply sorting
    const sortBookings = (bookings: Booking[]) => {
      if (!sortColumn) {
        return bookings.sort((a, b) => {
          if (activeTab === "history") {
            return new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
          }
          return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        })
      }
      
      return bookings.sort((a, b) => {
        let aValue: any
        let bValue: any
        
        switch (sortColumn) {
          case "title":
            aValue = a.title.toLowerCase()
            bValue = b.title.toLowerCase()
            break
          case "resource":
            aValue = a.resource.name.toLowerCase()
            bValue = b.resource.name.toLowerCase()
            break
          case "date":
            aValue = new Date(a.startTime).getTime()
            bValue = new Date(b.startTime).getTime()
            break
          case "price":
            aValue = a.totalAmount || 0
            bValue = b.totalAmount || 0
            break
          case "status":
            aValue = a.status
            bValue = b.status
            break
          default:
            aValue = new Date(a.startTime).getTime()
            bValue = new Date(b.startTime).getTime()
        }
        
        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
        return 0
      })
    }
    
    return {
      upcoming: sortBookings(upcomingBookings),
      history: sortBookings(historyBookings)
    }
  }, [bookings, selectedCategoryId, selectedResourceId, sortColumn, sortDirection, activeTab])

  const activeBookings = activeTab === "upcoming" ? upcoming : history

  // Group recurring bookings
  const { recurringGroups, standaloneBookings } = useMemo(() => {
    const groups: { [key: string]: Booking[] } = {}
    const standalone: Booking[] = []

    activeBookings.forEach(booking => {
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

    return { recurringGroups: groups, standaloneBookings: standalone }
  }, [activeBookings])

  // Toggle group expansion
  const toggleGroupExpansion = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }, [])

  const formatDateLabel = useCallback((dateStr: string) => {
    const date = parseISO(dateStr)
    if (isToday(date)) return "I dag"
    if (isTomorrow(date)) return "I morgen"
    if (isThisWeek(date, { weekStartsOn: 1 })) return format(date, "EEEE", { locale: nb })
    return format(date, "EEEE d. MMMM", { locale: nb })
  }, [])

  const getStatusInfo = useCallback((status: string) => {
    switch (status) {
      case "pending": return { label: "Venter på godkjenning", color: "bg-amber-100 text-amber-700", icon: Hourglass }
      case "approved": return { label: "Godkjent", color: "bg-green-100 text-green-700", icon: CheckCircle2 }
      case "rejected": return { label: "Avslått", color: "bg-red-100 text-red-700", icon: XCircle }
      case "cancelled": return { label: "Kansellert", color: "bg-gray-100 text-gray-600", icon: XCircle }
      default: return { label: status, color: "bg-gray-100 text-gray-600", icon: AlertCircle }
    }
  }, [])

  const handleBookingSaved = useCallback((updatedBooking: any) => {
    setBookings(prev => prev.map(b => 
      b.id === updatedBooking.id 
        ? { ...b, title: updatedBooking.title, status: updatedBooking.status, startTime: updatedBooking.startTime, endTime: updatedBooking.endTime } 
        : b
    ))
    setEditingBooking(null)
  }, [])

  if (status === "loading" || isLoading) {
    return (
      <PageLayout maxWidth="max-w-7xl">
        <div className="flex-1 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout maxWidth="max-w-7xl">
      <div className="py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" />
                Mine bookinger
              </h1>
              <p className="text-sm sm:text-base text-gray-500">Oversikt over dine reservasjoner</p>
            </div>
            <Link 
              href="/resources" 
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm sm:text-base"
            >
              <Plus className="w-4 h-4" />
              Ny booking
            </Link>
          </div>

          {bookings.length === 0 ? (
            <div className="card p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Ingen bookinger ennå</h2>
              <p className="text-gray-500 mb-6">Finn en fasilitet og lag din første booking</p>
              <Link href="/resources" className="btn btn-primary">
                Se fasiliteter
              </Link>
            </div>
          ) : (
            <>
              {/* Filter and Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                {/* Filters */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  {categories.length > 0 && (
                    <select
                      value={selectedCategoryId || ""}
                      onChange={(e) => {
                        setSelectedCategoryId(e.target.value || null)
                        // Reset resource filter when category changes
                        setSelectedResourceId(null)
                      }}
                      className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Alle kategorier</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                  {resources.length > 0 && (
                    <select
                      value={selectedResourceId || ""}
                      onChange={(e) => setSelectedResourceId(e.target.value || null)}
                      className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Alle fasiliteter</option>
                      {resources.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-gray-100 rounded-xl flex-1 sm:flex-initial">
                  <button
                    onClick={() => handleTabChange("upcoming")}
                    className={`relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                      activeTab === "upcoming"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    Kommende
                  {upcoming.length > 0 && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      activeTab === "upcoming" ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"
                    }`}>
                      {upcoming.length}
                    </span>
                  )}
                  {unreadCounts.upcoming > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-green-500 text-white text-[10px] font-bold rounded-full animate-pulse">
                      {unreadCounts.upcoming}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleTabChange("history")}
                  className={`relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                    activeTab === "history"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Historikk
                  {history.length > 0 && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      activeTab === "history" ? "bg-gray-200 text-gray-700" : "bg-gray-200 text-gray-600"
                    }`}>
                      {history.length}
                    </span>
                  )}
                  {unreadCounts.history > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse">
                      {unreadCounts.history}
                    </span>
                  )}
                </button>
                </div>
              </div>

              {/* Bulk delete controls for history tab */}
              {activeTab === "history" && history.length > 0 && (
                <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={history.length > 0 && history.every(b => selectedForDelete.has(b.id))}
                      onChange={() => toggleSelectAll(history.map(b => b.id))}
                      className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm text-gray-600">Velg alle ({history.length})</span>
                  </label>
                  {selectedForDelete.size > 0 && (
                    <button
                      onClick={() => setShowBulkDeleteModal(true)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Slett valgte ({selectedForDelete.size})
                    </button>
                  )}
                </div>
              )}

              {activeBookings.length === 0 ? (
                <div className="card p-8 text-center">
                  {activeTab === "upcoming" ? (
                    <>
                      <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">Ingen kommende bookinger</p>
                    </>
                  ) : (
                    <>
                      <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">Ingen tidligere bookinger</p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {/* Mobile card view */}
                  <div className="md:hidden space-y-3">
                    {standaloneBookings.concat(
                      Object.values(recurringGroups).flat()
                    ).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()).map((booking) => {
                      const statusInfo = getStatusInfo(booking.status)
                      const StatusIcon = statusInfo.icon
                      const isPast = new Date(booking.startTime) < new Date()
                      
                      return (
                        <div
                          key={booking.id}
                          onClick={() => setSelectedBooking(booking)}
                          className={`bg-white rounded-xl border border-gray-200 p-4 cursor-pointer active:scale-[0.98] transition-all ${
                            isPast || booking.status === "cancelled" || booking.status === "rejected" ? "opacity-70" : ""
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div 
                              className="w-3 h-3 rounded-full flex-shrink-0 mt-1.5"
                              style={{ backgroundColor: booking.resource.color || "#3b82f6" }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="font-semibold text-gray-900 truncate">{booking.title}</h3>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color} flex-shrink-0`}>
                                  <StatusIcon className="w-3 h-3" />
                                  {statusInfo.label}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{booking.resource.name}</p>
                              {booking.resourcePart && (
                                <p className="text-xs text-gray-500">→ {booking.resourcePart.name}</p>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {format(parseISO(booking.startTime), "d. MMM", { locale: nb })}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  {format(parseISO(booking.startTime), "HH:mm")} - {format(parseISO(booking.endTime), "HH:mm")}
                                </span>
                              </div>
                              {pricingEnabled && booking.totalAmount && booking.totalAmount > 0 && (
                                <p className="text-sm font-semibold text-gray-900 mt-2">{Math.round(Number(booking.totalAmount))} kr</p>
                              )}
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Desktop table view */}
                  <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
                  <table className="w-full min-w-[1000px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {activeTab === "history" && (
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">
                            <input
                              type="checkbox"
                              checked={activeBookings.length > 0 && activeBookings.every(b => selectedForDelete.has(b.id))}
                              onChange={() => toggleSelectAll(activeBookings.map(b => b.id))}
                              className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                            />
                          </th>
                        )}
                        <th 
                          className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-64 cursor-pointer hover:bg-gray-100 select-none transition-colors"
                          onClick={() => handleSort("title")}
                        >
                          <div className="flex items-center gap-2">
                            Booking
                            {getSortIcon("title")}
                          </div>
                        </th>
                        <th 
                          className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors"
                          onClick={() => handleSort("resource")}
                        >
                          <div className="flex items-center gap-2">
                            Fasilitet
                            {getSortIcon("resource")}
                          </div>
                        </th>
                        <th 
                          className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors"
                          onClick={() => handleSort("date")}
                        >
                          <div className="flex items-center gap-2">
                            Dato & Tid
                            {getSortIcon("date")}
                          </div>
                        </th>
                        {pricingEnabled && (
                          <>
                            <th 
                              className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                              onClick={() => handleSort("price")}
                            >
                              <div className="flex items-center gap-2">
                                Pris
                                {getSortIcon("price")}
                              </div>
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Betalingsmetode</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Betalingsstatus</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {/* Render recurring groups as folders */}
                      {Object.entries(recurringGroups).map(([groupId, groupBookings]) => {
                        const isExpanded = expandedGroups.has(groupId)
                        const firstBooking = groupBookings[0]
                        const lastBooking = groupBookings[groupBookings.length - 1]
                        const pendingCount = groupBookings.filter(b => b.status === "pending").length
                        const approvedCount = groupBookings.filter(b => b.status === "approved").length

                        return (
                          <React.Fragment key={`group-${groupId}`}>
                            {/* Folder Header Row */}
                            <tr 
                              className="bg-blue-50/50 hover:bg-blue-100/50 transition-colors cursor-pointer"
                              onClick={() => toggleGroupExpansion(groupId)}
                            >
                              {activeTab === "history" && <td className="px-4 py-3"></td>}
                              <td className="px-4 py-3" colSpan={2}>
                                <div className="flex items-center gap-3">
                                  <div className="p-1">
                                    {isExpanded ? (
                                      <ChevronUp className="w-5 h-5 text-blue-600" />
                                    ) : (
                                      <ChevronDown className="w-5 h-5 text-blue-600" />
                                    )}
                                  </div>
                                  <div 
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: firstBooking.resource.color || "#3b82f6" }}
                                  />
                                  <div className="flex-1 min-w-0 overflow-hidden">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-blue-900 truncate max-w-[150px]">{firstBooking.title}</span>
                                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-200 text-blue-800 whitespace-nowrap">
                                        📅 {groupBookings.length}x
                                      </span>
                                      {pendingCount > 0 && (
                                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
                                          {pendingCount} venter
                                        </span>
                                      )}
                                      {approvedCount > 0 && (
                                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 whitespace-nowrap">
                                          {approvedCount} godkjent
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-blue-600 mt-1 truncate">
                                      {firstBooking.resource.name}
                                      {firstBooking.resourcePart && ` → ${firstBooking.resourcePart.name}`}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div>
                                  <p className="text-sm font-medium text-blue-900">
                                    {format(parseISO(firstBooking.startTime), "d. MMM", { locale: nb })} - {format(parseISO(lastBooking.startTime), "d. MMM yyyy", { locale: nb })}
                                  </p>
                                  <p className="text-xs text-blue-600">
                                    {groupBookings.length} datoer
                                  </p>
                                </div>
                              </td>
                              {pricingEnabled && (
                                <>
                                  <td className="px-4 py-3"><p className="text-xs text-blue-600">—</p></td>
                                  <td className="px-4 py-3"><p className="text-xs text-blue-600">—</p></td>
                                  <td className="px-4 py-3"><p className="text-xs text-blue-600">—</p></td>
                                </>
                              )}
                            </tr>
                            
                            {/* Child Booking Rows (when expanded) */}
                            {isExpanded && groupBookings.map((booking) => {
                              const statusInfo = getStatusInfo(booking.status)
                              const StatusIcon = statusInfo.icon
                              const isPast = new Date(booking.startTime) < new Date()
                              const paymentStatus = getPaymentStatus(booking)

                              return (
                                <tr 
                                  key={booking.id}
                                  className={`bg-gray-50/50 hover:bg-gray-100 transition-colors cursor-pointer ${
                                    isPast || booking.status === "cancelled" || booking.status === "rejected" ? "opacity-70" : ""
                                  }`}
                                  onClick={(e) => {
                                    const target = e.target as HTMLElement
                                    if (target.closest('input[type="checkbox"]')) return
                                    setSelectedBooking(booking)
                                  }}
                                >
                                  {activeTab === "history" && (
                                    <td className="px-4 py-3 pl-8">
                                      <input
                                        type="checkbox"
                                        checked={selectedForDelete.has(booking.id)}
                                        onChange={() => toggleSelectBooking(booking.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                      />
                                    </td>
                                  )}
                                  <td className="px-4 py-3 pl-12">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1 h-8 bg-blue-300 rounded-full" />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-medium text-gray-700">{booking.title}</span>
                                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                                            <StatusIcon className="w-3 h-3" />
                                            {statusInfo.label}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="text-sm text-gray-600">{booking.resource.name}</p>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">
                                        {format(parseISO(booking.startTime), "d. MMM yyyy", { locale: nb })}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {format(parseISO(booking.startTime), "HH:mm")} - {format(parseISO(booking.endTime), "HH:mm")}
                                      </p>
                                    </div>
                                  </td>
                                  {pricingEnabled && (
                                    <>
                                      <td className="px-4 py-3">
                                        {booking.totalAmount && booking.totalAmount > 0 ? (
                                          <p className="text-sm font-semibold text-gray-900">{Math.round(Number(booking.totalAmount))} kr</p>
                                        ) : (
                                          <p className="text-xs text-gray-400">Gratis</p>
                                        )}
                                      </td>
                                      <td className="px-4 py-3"><p className="text-xs text-gray-400">—</p></td>
                                      <td className="px-4 py-3">
                                        {paymentStatus === "paid" && <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Betalt</span>}
                                        {paymentStatus === "unpaid" && <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">Ikke betalt</span>}
                                        {paymentStatus === "pending_payment" && <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Venter</span>}
                                        {paymentStatus === "free" && <p className="text-xs text-gray-400">—</p>}
                                      </td>
                                    </>
                                  )}
                                </tr>
                              )
                            })}
                          </React.Fragment>
                        )
                      })}
                      
                      {/* Render standalone bookings */}
                      {standaloneBookings.map((booking) => {
                        const statusInfo = getStatusInfo(booking.status)
                        const StatusIcon = statusInfo.icon
                        const isPast = new Date(booking.startTime) < new Date()
                        const paymentStatus = getPaymentStatus(booking)

                        return (
                          <tr 
                            key={booking.id} 
                            className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                              isPast || booking.status === "cancelled" || booking.status === "rejected" ? "opacity-70" : ""
                            }`}
                            onClick={(e) => {
                              const target = e.target as HTMLElement
                              if (target.closest('input[type="checkbox"]')) return
                              setSelectedBooking(booking)
                            }}
                          >
                            {activeTab === "history" && (
                              <td className="px-4 py-4">
                                <input
                                  type="checkbox"
                                  checked={selectedForDelete.has(booking.id)}
                                  onChange={() => toggleSelectBooking(booking.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                />
                              </td>
                            )}
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: booking.resource.color || "#3b82f6" }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-gray-900">{booking.title}</span>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                                      <StatusIcon className="w-3 h-3" />
                                      {statusInfo.label}
                                    </span>
                                  </div>
                                  {booking.description && (
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{booking.description}</p>
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
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {format(parseISO(booking.startTime), "d. MMM yyyy", { locale: nb })}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {format(parseISO(booking.startTime), "HH:mm")} - {format(parseISO(booking.endTime), "HH:mm")}
                                </p>
                              </div>
                            </td>
                            {pricingEnabled && (
                              <>
                                <td className="px-4 py-4">
                                  {booking.totalAmount && booking.totalAmount > 0 ? (
                                    <p className="text-sm font-semibold text-gray-900">{Math.round(Number(booking.totalAmount))} kr</p>
                                  ) : (
                                    <p className="text-xs text-gray-400">Gratis</p>
                                  )}
                                </td>
                                <td className="px-4 py-4">
                                  {booking.preferredPaymentMethod ? (
                                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700">
                                      {booking.preferredPaymentMethod === "INVOICE" && "Faktura"}
                                      {booking.preferredPaymentMethod === "VIPPS" && "Vipps"}
                                      {booking.preferredPaymentMethod === "CARD" && "Kort"}
                                    </span>
                                  ) : (
                                    <p className="text-xs text-gray-400">—</p>
                                  )}
                                </td>
                                <td className="px-4 py-4">
                                  {paymentStatus === "paid" && <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Betalt</span>}
                                  {paymentStatus === "unpaid" && <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Ikke betalt</span>}
                                  {paymentStatus === "pending_payment" && <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Venter på betaling</span>}
                                  {paymentStatus === "free" && <p className="text-xs text-gray-400">Gratis</p>}
                                </td>
                              </>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>

      {/* Cancel modal */}
      {cancellingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl p-6 animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Kanseller booking?</h3>
            <p className="text-gray-600 text-center mb-4">
              Er du sikker på at du vil kansellere denne bookingen? Administrator vil bli varslet.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Grunn for kansellering (valgfritt)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Forklar hvorfor du kansellerer bookingen..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setCancellingId(null)
                  setCancelReason("")
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={() => handleCancel(cancellingId)}
                disabled={isProcessing}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Ja, kanseller
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl p-6 animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Slett booking?</h3>
            <p className="text-gray-600 text-center mb-6">
              Er du sikker på at du vil slette denne bookingen permanent? Denne handlingen kan ikke angres.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                disabled={isProcessing}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Ja, slett
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl p-6 animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
              Slett {selectedForDelete.size} bookinger?
            </h3>
            <p className="text-gray-600 text-center mb-6">
              Er du sikker på at du vil slette {selectedForDelete.size} bookinger permanent? Denne handlingen kan ikke angres.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isProcessing}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Ja, slett alle
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Booking Modal */}
      {editingBooking && (
        <EditBookingModal
          booking={{
            id: editingBooking.id,
            title: editingBooking.title,
            description: editingBooking.description,
            startTime: editingBooking.startTime,
            endTime: editingBooking.endTime,
            status: editingBooking.status,
            resourceId: editingBooking.resource.id,
            resourceName: editingBooking.resource.name,
            resourcePartId: null,
            resourcePartName: editingBooking.resourcePart?.name || null,
          }}
          isAdmin={false}
          onClose={() => setEditingBooking(null)}
          onSaved={handleBookingSaved}
        />
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
            <div 
              className="p-6 rounded-t-xl"
              style={{ 
                backgroundColor: selectedBooking.resource.color || "#3b82f6" 
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-white/80 text-sm font-medium">
                    {selectedBooking.resource.name}
                    {selectedBooking.resourcePart && ` • ${selectedBooking.resourcePart.name}`}
                  </p>
                  <h3 className="text-2xl font-bold text-white mt-1">
                    {selectedBooking.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="p-1 rounded-full hover:bg-white/20 transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
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
                {selectedBooking.status === "rejected" && (
                  <span className="px-3 py-1 text-sm font-medium rounded-full bg-red-100 text-red-700">
                    Avslått
                  </span>
                )}
                {selectedBooking.status === "cancelled" && (
                  <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-600">
                    Kansellert
                  </span>
                )}
              </div>

              {/* Description */}
              {selectedBooking.description && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Beskrivelse</h4>
                  <p className="text-gray-600 whitespace-pre-wrap">{selectedBooking.description}</p>
                </div>
              )}

              {/* Date and time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Dato</h4>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>{format(parseISO(selectedBooking.startTime), "EEEE d. MMMM yyyy", { locale: nb })}</span>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Tid</h4>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>
                      {format(parseISO(selectedBooking.startTime), "HH:mm")} - {format(parseISO(selectedBooking.endTime), "HH:mm")}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {(() => {
                      const start = parseISO(selectedBooking.startTime)
                      const end = parseISO(selectedBooking.endTime)
                      let durationMs = end.getTime() - start.getTime()
                      
                      // Håndter tilfelle hvor booking går over midnatt
                      // Hvis varighet er negativ, betyr det at endTime er før startTime (sannsynligvis feil dato)
                      // Legg til 24 timer for å korrigere (antagelse: booking går over midnatt og er < 24 timer)
                      if (durationMs < 0) {
                        durationMs += 24 * 60 * 60 * 1000
                      }
                      
                      const durationHours = Math.round((durationMs / (1000 * 60 * 60)) * 10) / 10
                      return `${durationHours} timer`
                    })()}
                  </p>
                </div>
              </div>

              {/* Location */}
              {selectedBooking.resource.location && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Lokasjon</h4>
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{selectedBooking.resource.location}</span>
                  </div>
                </div>
              )}

              {/* Price and payment info */}
              {pricingEnabled && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Betaling</h4>
                  {selectedBooking.totalAmount && selectedBooking.totalAmount > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <span className="text-sm font-medium text-gray-900">Totalpris:</span>
                        <span className="text-lg font-bold text-gray-900">
                          {Math.round(Number(selectedBooking.totalAmount))} kr
                        </span>
                      </div>
                      {selectedBooking.preferredPaymentMethod && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Foretrukket betalingsmetode:</p>
                          <span className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-700">
                            {selectedBooking.preferredPaymentMethod === "INVOICE" && "Faktura"}
                            {selectedBooking.preferredPaymentMethod === "VIPPS" && "Vipps"}
                            {selectedBooking.preferredPaymentMethod === "CARD" && "Kort"}
                          </span>
                        </div>
                      )}
                      {selectedBooking.payments && selectedBooking.payments.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-2">Betalinger:</p>
                          <div className="space-y-2">
                            {selectedBooking.payments.map((payment) => (
                              <div key={payment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {payment.paymentMethod === "VIPPS" && "Vipps"}
                                    {payment.paymentMethod === "CARD" && "Kort"}
                                    {payment.paymentMethod === "BANK_TRANSFER" && "Bankoverføring"}
                                    {payment.paymentMethod === "INVOICE" && "Faktura"}
                                  </p>
                                  <p className="text-xs text-gray-500">{Math.round(Number(payment.amount))} kr</p>
                                </div>
                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                  payment.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                                  payment.status === "PENDING" ? "bg-amber-100 text-amber-700" :
                                  payment.status === "FAILED" ? "bg-red-100 text-red-700" :
                                  "bg-gray-100 text-gray-700"
                                }`}>
                                  {payment.status === "COMPLETED" && "Betalt"}
                                  {payment.status === "PENDING" && "Venter"}
                                  {payment.status === "PROCESSING" && "Behandler"}
                                  {payment.status === "FAILED" && "Feilet"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedBooking.invoiceId && selectedBooking.invoice && (
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-gray-600">Faktura:</span>
                            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                              selectedBooking.invoice.status === "PAID" 
                                ? "bg-green-100 text-green-700"
                                : selectedBooking.invoice.status === "SENT"
                                ? "bg-blue-100 text-blue-700"
                                : selectedBooking.invoice.status === "DRAFT"
                                ? "bg-gray-100 text-gray-600"
                                : "bg-orange-100 text-orange-700"
                            }`}>
                              {selectedBooking.invoice.status === "PAID" && "Betalt"}
                              {selectedBooking.invoice.status === "SENT" && "Sendt"}
                              {selectedBooking.invoice.status === "DRAFT" && "Kladd"}
                              {selectedBooking.invoice.status === "OVERDUE" && "Forfalt"}
                            </span>
                          </div>
                          {selectedBooking.invoice.status !== "DRAFT" && (
                            <a
                              href={`/api/invoices/${selectedBooking.invoiceId}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              Se faktura
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">Gratis booking</p>
                  )}
                </div>
              )}

              {/* Status note */}
              {selectedBooking.statusNote && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Statusnotat</h4>
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{selectedBooking.statusNote}</p>
                </div>
              )}

              {/* Action buttons for approved/pending bookings */}
              {(() => {
                const isPast = new Date(selectedBooking.startTime) < new Date()
                const canEdit = (selectedBooking.status === "pending" || selectedBooking.status === "approved") && !isPast
                
                if (canEdit) {
                  return (
                    <div className="border-t pt-4 space-y-2">
                      <p className="text-xs text-gray-500 text-center">Dette er din booking</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingBooking(selectedBooking)
                            setSelectedBooking(null)
                          }}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <Pencil className="w-4 h-4" />
                          Rediger
                        </button>
                        <button
                          onClick={() => {
                            setCancellingId(selectedBooking.id)
                            setSelectedBooking(null)
                          }}
                          disabled={isProcessing}
                          className="flex-1 px-4 py-2 bg-white border border-gray-300 text-red-600 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Kanseller
                        </button>
                      </div>
                    </div>
                  )
                }
                return null
              })()}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
