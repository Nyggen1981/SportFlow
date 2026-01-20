"use client"

import React, { useState, useEffect } from "react"
import { format } from "date-fns"
import { nb } from "date-fns/locale"
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Trash2, 
  Loader2,
  Calendar,
  User,
  Building2,
  History,
  Square,
  CheckSquare,
  ArrowUp,
  ArrowDown,
  ChevronUp,
  ChevronDown,
  Filter,
  X,
  Search,
  AlertCircle,
  FileText,
  Send,
  Eye,
  ClipboardList,
  Pencil
} from "lucide-react"
import Link from "next/link"
import { EditBookingModal } from "@/components/EditBookingModal"

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
  totalAmount: number | null
  invoiceId: string | null
  invoice?: { id: string; status: string; invoiceNumber: string } | null
  preferredPaymentMethod: string | null
  isRecurring?: boolean
  parentBookingId?: string | null
  resource: {
    id: string
    name: string
    color?: string
  }
  resourcePart?: {
    id: string
    name: string
  } | null
  user: {
    name: string | null
    email: string
  }
  payments?: Array<{ id: string; status: string; paymentMethod: string; amount: number }>
}

interface BookingManagementProps {
  initialBookings?: Booking[]
  showTabs?: boolean
}

export function BookingManagement({ initialBookings, showTabs = true }: BookingManagementProps) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings || [])
  const [isLoading, setIsLoading] = useState(!initialBookings)
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved" | "rejected" | "history">("pending")
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [pricingEnabled, setPricingEnabled] = useState(false)
  
  // Reject modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectingBookingId, setRejectingBookingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectAllInGroup, setRejectAllInGroup] = useState(false)
  const [selectedModalBookingIds, setSelectedModalBookingIds] = useState<Set<string>>(new Set())
  const [rejectSelectedIds, setRejectSelectedIds] = useState<string[]>([]) // IDs to reject when using selection
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)
  
  // Mark as paid modal state
  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false)
  const [markingPaidBookingId, setMarkingPaidBookingId] = useState<string | null>(null)
  const [useTemplate, setUseTemplate] = useState(true)
  const [customMessage, setCustomMessage] = useState("")
  const [isMarkingPaid, setIsMarkingPaid] = useState(false)
  
  // Email preview modal state
  const [emailPreviewModalOpen, setEmailPreviewModalOpen] = useState(false)
  const [emailPreview, setEmailPreview] = useState<{ subject: string; html: string; type: string } | null>(null)
  const [previewBookingId, setPreviewBookingId] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  
  // Invoice PDF preview state
  const [invoicePreviewModalOpen, setInvoicePreviewModalOpen] = useState(false)
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState<string | null>(null)
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null)
  const [isSendingInvoice, setIsSendingInvoice] = useState(false)
  
  // Filter state
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all") // all, paid, unpaid, pending_payment
  const [resourceFilter, setResourceFilter] = useState<string>("all")
  const [dateFromFilter, setDateFromFilter] = useState<string>("")
  const [dateToFilter, setDateToFilter] = useState<string>("")
  const [userSearchFilter, setUserSearchFilter] = useState<string>("")
  const [minPriceFilter, setMinPriceFilter] = useState<string>("")
  const [maxPriceFilter, setMaxPriceFilter] = useState<string>("")
  
  // Expanded recurring groups state - removed for cleaner UI
  
  // Recurring group modal state
  const [selectedRecurringGroup, setSelectedRecurringGroup] = useState<{ groupId: string; bookings: Booking[] } | null>(null)
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const [bulkEditSelectedOnly, setBulkEditSelectedOnly] = useState(false) // Edit only selected bookings
  const [bulkEditData, setBulkEditData] = useState<{
    title: string
    resourceId: string
    resourcePartId: string | null
    newStartTime: string // HH:mm format
    newEndTime: string   // HH:mm format
    timeShiftMinutes: number
  }>({ title: "", resourceId: "", resourcePartId: null, newStartTime: "", newEndTime: "", timeShiftMinutes: 0 })
  const [availableResources, setAvailableResources] = useState<Array<{ id: string; name: string; parts: Array<{ id: string; name: string }> }>>([])
  const [isLoadingResources, setIsLoadingResources] = useState(false)
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  
  const now = new Date()
  
  // Clear selection when tab changes
  useEffect(() => {
    setSelectedIds(new Set())
  }, [activeTab])

  useEffect(() => {
    fetchBookings()
    // Sjekk om pricing er aktivert
    fetch("/api/pricing/status")
      .then(res => res.json())
      .then(data => setPricingEnabled(data.enabled || false))
      .catch(() => setPricingEnabled(false))
  }, [])

  const fetchBookings = async () => {
    try {
      const response = await fetch("/api/admin/bookings?status=all")
      if (response.ok) {
        const data = await response.json()
        console.log("Fetched bookings:", data)
        setBookings(data)
      } else {
        console.error("Failed to fetch bookings, status:", response.status)
      }
    } catch (error) {
      console.error("Failed to fetch bookings:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch resources for bulk edit
  const fetchResources = async () => {
    if (availableResources.length > 0) return // Already loaded
    setIsLoadingResources(true)
    try {
      const response = await fetch("/api/resources")
      if (response.ok) {
        const data = await response.json()
        setAvailableResources(data || [])
      }
    } catch (error) {
      console.error("Failed to fetch resources:", error)
    } finally {
      setIsLoadingResources(false)
    }
  }

  // Handle bulk update of bookings (all or selected only)
  const handleBulkUpdate = async () => {
    if (!selectedRecurringGroup) return
    
    // Determine which bookings to update
    const bookingsToUpdate = bulkEditSelectedOnly 
      ? selectedRecurringGroup.bookings.filter(b => selectedModalBookingIds.has(b.id))
      : selectedRecurringGroup.bookings
    
    if (bookingsToUpdate.length === 0) {
      alert("Ingen bookinger valgt for redigering")
      return
    }
    
    setIsBulkUpdating(true)
    try {
      // Use bulk-edit endpoint for faster processing
      const response = await fetch('/api/admin/bookings/bulk-edit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingIds: bookingsToUpdate.map(b => b.id),
          title: bulkEditData.title || undefined,
          resourceId: bulkEditData.resourceId || undefined,
          resourcePartId: bulkEditData.resourcePartId,
          newStartTime: bulkEditData.newStartTime || undefined,
          newEndTime: bulkEditData.newEndTime || undefined,
          timeShiftMinutes: bulkEditData.timeShiftMinutes || undefined
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Kunne ikke oppdatere bookinger')
      }
      
      await fetchBookings()
      setSelectedRecurringGroup(null)
      setBulkEditMode(false)
      setBulkEditSelectedOnly(false)
      setBulkEditData({ title: "", resourceId: "", resourcePartId: null, newStartTime: "", newEndTime: "", timeShiftMinutes: 0 })
      setSelectedModalBookingIds(new Set())
    } catch (error) {
      console.error("Failed to bulk update bookings:", error)
      alert(error instanceof Error ? error.message : 'En feil oppstod')
    } finally {
      setIsBulkUpdating(false)
    }
  }

  const handleAction = async (bookingId: string, action: "approve" | "reject" | "cancel") => {
    // For reject, show the modal to get a reason
    if (action === "reject") {
      setRejectingBookingId(bookingId)
      setRejectReason("")
      setRejectModalOpen(true)
      return
    }

    // For approve, check if booking has cost and show preview
    if (action === "approve" && pricingEnabled) {
      const booking = bookings.find(b => b.id === bookingId)
      if (booking && booking.totalAmount && booking.totalAmount > 0) {
        // Booking har kostnad - hent preview først
        setIsLoadingPreview(true)
        setPreviewError(null)
        setPreviewBookingId(bookingId)
        
        try {
          const response = await fetch(`/api/admin/bookings/${bookingId}/preview-email`)
          
          if (!response.ok) {
            const errorData = await response.json()
            
            // Hvis Vipps ikke er konfigurert, vis feilmelding
            if (errorData.requiresConfiguration) {
              setPreviewError("Vipps er ikke konfigurert. Gå til Innstillinger for å legge inn Vipps-opplysninger, eller velg en annen betalingsmetode.")
              setEmailPreviewModalOpen(true)
              setIsLoadingPreview(false)
              return
            }
            
            throw new Error(errorData.error || "Kunne ikke hente e-post preview")
          }
          
          const previewData = await response.json()
          setEmailPreview(previewData)
          setEmailPreviewModalOpen(true)
        } catch (error) {
          console.error("Failed to fetch email preview:", error)
          setPreviewError(error instanceof Error ? error.message : "Kunne ikke hente e-post preview")
          setEmailPreviewModalOpen(true)
        } finally {
          setIsLoadingPreview(false)
        }
        return
      }
    }

    // Ingen kostnad eller ikke approve - fortsett direkte
    await executeAction(bookingId, action)
  }

  const executeAction = async (bookingId: string, action: "approve" | "reject" | "cancel", applyToAll: boolean = false) => {
    setProcessingId(bookingId)
    try {
      const booking = bookings.find(b => b.id === bookingId)
      const shouldApplyToAll = applyToAll && booking?.isRecurring
      
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: action === "cancel" ? "reject" : action,
          statusNote: action === "cancel" ? "Kansellert av administrator" : undefined,
          applyToAll: shouldApplyToAll
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Kunne ikke utføre handling")
      }

        // Refresh bookings
        await fetchBookings()
      
      // Close preview modal if open
      if (emailPreviewModalOpen) {
        setEmailPreviewModalOpen(false)
        setEmailPreview(null)
        setPreviewBookingId(null)
        setPreviewError(null)
      }
      
      // Close booking details modal
      setSelectedBooking(null)
    } catch (error) {
      console.error("Failed to process booking:", error)
      alert(error instanceof Error ? error.message : "Noe gikk galt")
    } finally {
      setProcessingId(null)
    }
  }

  const confirmEmailAndApprove = async () => {
    if (!previewBookingId) return
    setEmailPreviewModalOpen(false)
    await executeAction(previewBookingId, "approve")
  }

  const handleViewInvoice = async (invoiceId: string) => {
    try {
      setIsLoadingPreview(true)
      setPreviewError(null)
      
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
      setPreviewError(error instanceof Error ? error.message : "Kunne ikke laste forhåndsvisning")
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const confirmSendInvoice = async () => {
    if (!sendingInvoiceId) return
    
    setIsSendingInvoice(true)
    try {
      // Find booking with this invoice
      const booking = bookings.find(b => b.invoiceId === sendingInvoiceId)
      if (!booking) {
        throw new Error("Booking ikke funnet")
      }
      
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
        // Close booking details modal
        setSelectedBooking(null)
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
  }

  const handleMarkAsPaid = (bookingId: string) => {
    setMarkingPaidBookingId(bookingId)
    setUseTemplate(true)
    setCustomMessage("")
    setMarkPaidModalOpen(true)
  }

  const confirmMarkAsPaid = async () => {
    if (!markingPaidBookingId) return

    setIsMarkingPaid(true)
    
    try {
      const response = await fetch(`/api/admin/bookings/${markingPaidBookingId}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          useTemplate,
          customMessage: useTemplate ? null : customMessage
        })
      })

      if (response.ok) {
        setMarkPaidModalOpen(false)
        setMarkingPaidBookingId(null)
        // Refresh bookings
        await fetchBookings()
        // Close booking details modal
        setSelectedBooking(null)
      } else {
        const error = await response.json()
        alert(error.error || "Kunne ikke markere booking som betalt")
      }
    } catch (error) {
      console.error("Failed to mark booking as paid:", error)
      alert("Kunne ikke markere booking som betalt")
    } finally {
      setIsMarkingPaid(false)
    }
  }

  const confirmReject = async () => {
    if (!rejectingBookingId) return

    setProcessingId(rejectingBookingId)
    setRejectModalOpen(false)
    
    try {
      // If we have selected IDs, use bulk endpoint for fast processing
      if (rejectSelectedIds.length > 1) {
        // Use bulk endpoint for multiple bookings
        const response = await fetch('/api/admin/bookings/bulk', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingIds: rejectSelectedIds,
            action: 'reject',
            statusNote: rejectReason.trim() || undefined
          })
        })
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Kunne ikke avslå bookinger')
        }
      } else if (rejectAllInGroup && rejectingBookingId) {
        // Apply to all in recurring group - use single endpoint with applyToAll
        await fetch(`/api/admin/bookings/${rejectingBookingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            action: "reject",
            statusNote: rejectReason.trim() || undefined,
            applyToAll: true
          })
        })
      } else if (rejectingBookingId) {
        // Single booking rejection
        await fetch(`/api/admin/bookings/${rejectingBookingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            action: "reject",
            statusNote: rejectReason.trim() || undefined,
            applyToAll: false
          })
        })
      }

      await fetchBookings()
      // Close booking details modal
      setSelectedBooking(null)
    } catch (error) {
      console.error("Failed to reject booking:", error)
      alert(error instanceof Error ? error.message : 'En feil oppstod')
    } finally {
      setProcessingId(null)
      setRejectingBookingId(null)
      setRejectReason("")
      setRejectAllInGroup(false)
      setRejectSelectedIds([])
      setSelectedModalBookingIds(new Set())
    }
  }

  const handleDelete = async (bookingId: string, deleteAll: boolean = false) => {
    const booking = bookings.find(b => b.id === bookingId)
    const isRecurringGroup = booking?.isRecurring && deleteAll
    
    const confirmMessage = isRecurringGroup 
      ? "Er du sikker på at du vil slette ALLE bookinger i denne serien permanent?"
      : "Er du sikker på at du vil slette denne bookingen permanent?"
    
    if (!confirm(confirmMessage)) {
      return
    }
    
    setProcessingId(bookingId)
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}${isRecurringGroup ? '?deleteAll=true' : ''}`, {
        method: "DELETE"
      })

      if (response.ok) {
        await fetchBookings()
      }
    } catch (error) {
      console.error("Failed to delete booking:", error)
    } finally {
      setProcessingId(null)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    
    if (!confirm(`Er du sikker på at du vil slette ${selectedIds.size} booking${selectedIds.size > 1 ? "er" : ""} permanent?`)) {
      return
    }
    
    setIsDeleting(true)
    try {
      const response = await fetch("/api/admin/bookings/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingIds: Array.from(selectedIds) })
      })

      if (response.ok) {
        setSelectedIds(new Set())
        await fetchBookings()
      }
    } catch (error) {
      console.error("Failed to bulk delete bookings:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleSelection = (bookingId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId)
      } else {
        newSet.add(bookingId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredBookings.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredBookings.map(b => b.id)))
    }
  }

  const canDelete = activeTab === "rejected" || activeTab === "history" || activeTab === "all"

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

  // Get unique resources for filter dropdown
  const uniqueResources = Array.from(
    new Map(bookings.map(b => [b.resource.id, b.resource])).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  // Count active filters
  const activeFiltersCount = [
    paymentStatusFilter !== "all",
    resourceFilter !== "all",
    dateFromFilter !== "",
    dateToFilter !== "",
    userSearchFilter !== "",
    minPriceFilter !== "",
    maxPriceFilter !== ""
  ].filter(Boolean).length

  // Group recurring bookings
  const groupedBookings = (() => {
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
  })()

  // Helper to check if a booking matches current tab filter
  const matchesTabFilter = (b: Booking) => {
    const isPast = new Date(b.endTime) < now
    if (activeTab === "all") return true
    if (activeTab === "pending") return b.status === "pending" && !isPast
    if (activeTab === "approved") return b.status === "approved" && !isPast
    if (activeTab === "rejected") return (b.status === "rejected" || b.status === "cancelled") && !isPast
    if (activeTab === "history") return isPast
    return true
  }

  // Additional filters (applied to individual bookings)
  const applyAdditionalFilters = (b: Booking) => {
    // Payment status filter (only if pricing enabled)
    if (pricingEnabled && paymentStatusFilter !== "all") {
      const paymentStatus = getPaymentStatus(b)
      if (paymentStatusFilter === "paid" && paymentStatus !== "paid") return false
      if (paymentStatusFilter === "unpaid" && paymentStatus !== "unpaid") return false
      if (paymentStatusFilter === "pending_payment" && paymentStatus !== "pending_payment") return false
      if (paymentStatusFilter === "free" && paymentStatus !== "free") return false
    }
    
    // Resource filter
    if (resourceFilter !== "all" && b.resource.id !== resourceFilter) return false
    
    // Date filters
    if (dateFromFilter) {
      const fromDate = new Date(dateFromFilter)
      fromDate.setHours(0, 0, 0, 0)
      if (new Date(b.startTime) < fromDate) return false
    }
    if (dateToFilter) {
      const toDate = new Date(dateToFilter)
      toDate.setHours(23, 59, 59, 999)
      if (new Date(b.startTime) > toDate) return false
    }
    
    // User search filter
    if (userSearchFilter) {
      const searchLower = userSearchFilter.toLowerCase()
      const userName = (b.user.name || "").toLowerCase()
      const userEmail = (b.user.email || "").toLowerCase()
      if (!userName.includes(searchLower) && !userEmail.includes(searchLower)) return false
    }
    
    // Price filters (only if pricing enabled)
    if (pricingEnabled) {
      const bookingPrice = Number(b.totalAmount || 0)
      if (minPriceFilter) {
        const minPrice = Number(minPriceFilter)
        if (bookingPrice < minPrice) return false
      }
      if (maxPriceFilter) {
        const maxPrice = Number(maxPriceFilter)
        if (bookingPrice > maxPrice) return false
      }
    }
    
    return true
  }

  // Combined filter function (tab + additional filters)
  const applyAllFilters = (b: Booking) => matchesTabFilter(b) && applyAdditionalFilters(b)

  // Filter groups to only include those with at least one matching booking
  const filteredGroups = Object.entries(groupedBookings.groups)
    .map(([groupId, group]) => {
      const matchingBookings = group.filter(applyAllFilters)
      return { groupId, bookings: matchingBookings, allBookings: group }
    })
    .filter(g => g.bookings.length > 0)

  // Filter standalone bookings
  const filteredStandalone = groupedBookings.standalone.filter(applyAllFilters)


  // For counting and other purposes, create a flat filtered list
  const filteredBookings = [
    ...filteredStandalone,
    ...filteredGroups.flatMap(g => g.bookings)
  ]

  // Helper to get sort value for a booking
  const getSortValue = (booking: Booking): any => {
    switch (sortColumn) {
      case "title":
        return booking.title.toLowerCase()
      case "resource":
        return booking.resource.name.toLowerCase()
      case "date":
        return new Date(booking.startTime).getTime()
      case "user":
        return (booking.user.name || booking.user.email || "").toLowerCase()
      case "price":
        return booking.totalAmount || 0
      case "status":
        return booking.status
      default:
        return new Date(booking.startTime).getTime()
    }
  }

  // Sort function for bookings
  const sortBookings = (bookingsToSort: Booking[]) => [...bookingsToSort].sort((a, b) => {
    // If a sort column is selected, use it
    if (sortColumn) {
      const aValue = getSortValue(a)
      const bValue = getSortValue(b)
      
      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
      return 0
    }
    
    // Default sort by date - newest first for history, oldest first for others
    if (activeTab === "history") {
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    }
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  })

  // Sort function for groups (based on first booking in each group)
  const sortGroups = (groupsToSort: typeof filteredGroups) => [...groupsToSort].sort((a, b) => {
    const aFirst = a.bookings[0]
    const bFirst = b.bookings[0]
    
    if (sortColumn) {
      const aValue = getSortValue(aFirst)
      const bValue = getSortValue(bFirst)
      
      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
      return 0
    }
    
    // Default sort by date
    if (activeTab === "history") {
      return new Date(bFirst.startTime).getTime() - new Date(aFirst.startTime).getTime()
    }
    return new Date(aFirst.startTime).getTime() - new Date(bFirst.startTime).getTime()
  })

  const allCount = bookings.length
  const pendingCount = bookings.filter(b => b.status === "pending" && new Date(b.endTime) >= now).length
  const approvedCount = bookings.filter(b => b.status === "approved" && new Date(b.endTime) >= now).length
  const rejectedCount = bookings.filter(b => (b.status === "rejected" || b.status === "cancelled") && new Date(b.endTime) >= now).length
  const historyCount = bookings.filter(b => new Date(b.endTime) < now).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div>
      {/* Tabs */}
      {showTabs && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap text-sm sm:text-base flex-shrink-0 ${
              activeTab === "all"
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <ClipboardList className="w-4 h-4 flex-shrink-0" />
            Alle
            {allCount > 0 && (
              <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                {allCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap text-sm sm:text-base flex-shrink-0 ${
              activeTab === "pending"
                ? "bg-amber-100 text-amber-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Clock className="w-4 h-4 flex-shrink-0" />
            Ventende
            {pendingCount > 0 && (
              <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("approved")}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap text-sm sm:text-base flex-shrink-0 ${
              activeTab === "approved"
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            Godkjente
            {approvedCount > 0 && (
              <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                {approvedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("rejected")}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap text-sm sm:text-base flex-shrink-0 ${
              activeTab === "rejected"
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <XCircle className="w-4 h-4 flex-shrink-0" />
            Avslåtte
            {rejectedCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {rejectedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap text-sm sm:text-base flex-shrink-0 ${
              activeTab === "history"
                ? "bg-gray-200 text-gray-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <History className="w-4 h-4 flex-shrink-0" />
            Historikk
            {historyCount > 0 && (
              <span className="bg-gray-500 text-white text-xs px-2 py-0.5 rounded-full">
                {historyCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Filter section */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filtre
            {activeFiltersCount > 0 && (
              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </button>
          {activeFiltersCount > 0 && (
            <button
              onClick={() => {
                setPaymentStatusFilter("all")
                setResourceFilter("all")
                setDateFromFilter("")
                setDateToFilter("")
                setUserSearchFilter("")
                setMinPriceFilter("")
                setMaxPriceFilter("")
              }}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Nullstill filtre
            </button>
          )}
        </div>

        {filtersOpen && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Payment status filter */}
              {pricingEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Betalingsstatus
                  </label>
                  <select
                    value={paymentStatusFilter}
                    onChange={(e) => setPaymentStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Alle</option>
                    <option value="paid">Betalt</option>
                    <option value="unpaid">Ikke betalt</option>
                    <option value="pending_payment">Venter på betaling</option>
                    <option value="free">Gratis</option>
                  </select>
                </div>
              )}

              {/* Resource filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fasilitet
                </label>
                <select
                  value={resourceFilter}
                  onChange={(e) => setResourceFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Alle fasiliteter</option>
                  {uniqueResources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* User search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Søk bruker
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={userSearchFilter}
                    onChange={(e) => setUserSearchFilter(e.target.value)}
                    placeholder="Navn eller e-post..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Date from */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fra dato
                </label>
                <input
                  type="date"
                  value={dateFromFilter}
                  onChange={(e) => setDateFromFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Date to */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Til dato
                </label>
                <input
                  type="date"
                  value={dateToFilter}
                  onChange={(e) => setDateToFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Price filters */}
              {pricingEnabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min. pris (kr)
                    </label>
                    <input
                      type="number"
                      value={minPriceFilter}
                      onChange={(e) => setMinPriceFilter(e.target.value)}
                      placeholder="0"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maks. pris (kr)
                    </label>
                    <input
                      type="number"
                      value={maxPriceFilter}
                      onChange={(e) => setMaxPriceFilter(e.target.value)}
                      placeholder="Ingen grense"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bulk actions bar */}
      {canDelete && filteredBookings.length > 0 && (
        <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            {selectedIds.size === filteredBookings.length ? (
              <CheckSquare className="w-5 h-5 text-blue-600" />
            ) : (
              <Square className="w-5 h-5" />
            )}
            {selectedIds.size === filteredBookings.length ? "Fjern alle" : "Velg alle"}
          </button>
          
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Slett valgte ({selectedIds.size})
            </button>
          )}
        </div>
      )}

      {/* Booking list */}
      {filteredBookings.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            {activeTab === "all" && <ClipboardList className="w-8 h-8 text-gray-400" />}
            {activeTab === "pending" && <Clock className="w-8 h-8 text-gray-400" />}
            {activeTab === "approved" && <CheckCircle2 className="w-8 h-8 text-gray-400" />}
            {activeTab === "rejected" && <XCircle className="w-8 h-8 text-gray-400" />}
            {activeTab === "history" && <History className="w-8 h-8 text-gray-400" />}
          </div>
          <p className="text-gray-500">
            {activeTab === "all" && "Ingen bookinger"}
            {activeTab === "pending" && "Ingen ventende bookinger"}
            {activeTab === "approved" && "Ingen kommende godkjente bookinger"}
            {activeTab === "rejected" && "Ingen avslåtte bookinger"}
            {activeTab === "history" && "Ingen tidligere bookinger"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] table-fixed">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {canDelete && (
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">
                    <button onClick={toggleSelectAll} className="p-1">
                      {selectedIds.size === filteredBookings.length ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
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
                <th 
                  className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors"
                  onClick={() => handleSort("user")}
                >
                  <div className="flex items-center gap-2">
                    Bruker
                    {getSortIcon("user")}
                  </div>
                </th>
                {pricingEnabled ? (
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
                ) : (
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                )}
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* Render recurring groups as single rows - click opens modal */}
              {sortGroups(filteredGroups).map(({ groupId, bookings: groupBookings }) => {
                const firstBooking = groupBookings[0]
                const lastBooking = groupBookings[groupBookings.length - 1]
                const pendingCount = groupBookings.filter(b => b.status === "pending").length
                const approvedCount = groupBookings.filter(b => b.status === "approved").length
                const rejectedCount = groupBookings.filter(b => b.status === "rejected" || b.status === "cancelled").length
                
                return (
                  <tr 
                    key={`group-${groupId}`}
                    className="bg-blue-50/30 hover:bg-blue-100/50 transition-colors cursor-pointer"
                    onClick={(e) => {
                      const target = e.target as HTMLElement
                      if (target.closest('button')) return
                      setSelectedRecurringGroup({ groupId, bookings: groupBookings })
                      // Initialize with all pending bookings selected
                      const pendingIds = groupBookings.filter(b => b.status === "pending").map(b => b.id)
                      setSelectedModalBookingIds(new Set(pendingIds))
                    }}
                  >
                    {canDelete && <td className="px-4 py-4"></td>}
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-2">
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                          style={{ backgroundColor: firstBooking.resource.color || "#3b82f6" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">{firstBooking.title}</p>
                          <div className="flex items-center gap-1 flex-wrap mt-0.5">
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                              📅 {groupBookings.length}x
                            </span>
                            {pendingCount > 0 && (
                              <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-700">{pendingCount} venter</span>
                            )}
                            {approvedCount > 0 && (
                              <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700">{approvedCount} godkj.</span>
                            )}
                            {rejectedCount > 0 && (
                              <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700">{rejectedCount} avsl.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-gray-600">
                        {firstBooking.resource.name}
                        {firstBooking.resourcePart && ` → ${firstBooking.resourcePart.name}`}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {format(new Date(firstBooking.startTime), "d. MMM", { locale: nb })} - {format(new Date(lastBooking.startTime), "d. MMM yyyy", { locale: nb })}
                        </p>
                        <p className="text-xs text-gray-500">
                          {groupBookings.length} datoer
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-gray-900">{firstBooking.user.name || firstBooking.user.email}</p>
                    </td>
                    {pricingEnabled ? (
                      <>
                        <td className="px-4 py-4">
                          <p className="text-xs text-gray-400">—</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-xs text-gray-400">—</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-xs text-gray-400">—</p>
                        </td>
                      </>
                    ) : (
                      <td className="px-4 py-4">
                        {/* Status already shown in Booking column for recurring groups */}
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(firstBooking.id, true)
                          }}
                          disabled={processingId !== null}
                          className="p-2 rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-50"
                          title="Slett alle i serien"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              
              {/* Render standalone bookings */}
              {sortBookings([...filteredStandalone]).map((booking) => (
                <tr 
                  key={booking.id} 
                  className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                    selectedIds.has(booking.id) ? "bg-blue-50/50" : ""
                  }`}
                  onClick={(e) => {
                    const target = e.target as HTMLElement
                    if (target.closest('button') || target.closest('input[type="checkbox"]')) return
                    setSelectedBooking(booking)
                  }}
                >
                  {canDelete && (
                    <td className="px-4 py-4">
                      <button onClick={() => toggleSelection(booking.id)} className="p-1">
                        {selectedIds.has(booking.id) ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                        )}
                      </button>
                    </td>
                  )}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: booking.resource.color || "#3b82f6" }}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-900">{booking.title}</span>
                        {booking.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{booking.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm text-gray-600">
                      {booking.resource.name}
                      {booking.resourcePart && ` → ${booking.resourcePart.name}`}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {format(new Date(booking.startTime), "d. MMM yyyy", { locale: nb })}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(booking.startTime), "HH:mm")} - {format(new Date(booking.endTime), "HH:mm")}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm text-gray-900">{booking.user.name || booking.user.email}</p>
                  </td>
                  {pricingEnabled ? (
                    <>
                      <td className="px-4 py-4">
                        {booking.totalAmount && booking.totalAmount > 0 ? (
                          <p className="text-sm font-semibold text-gray-900">{Math.round(Number(booking.totalAmount))} kr</p>
                        ) : (
                          <p className="text-xs text-gray-400">Gratis</p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {booking.totalAmount && booking.totalAmount > 0 && booking.preferredPaymentMethod ? (
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
                        <div className="flex flex-col gap-1">
                          {booking.status === "pending" && (
                            <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-700 w-fit">Venter</span>
                          )}
                          {booking.status === "approved" && (
                            <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 w-fit">Godkjent</span>
                          )}
                          {booking.status === "rejected" && (
                            <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700 w-fit">Avslått</span>
                          )}
                          {booking.status === "cancelled" && (
                            <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600 w-fit">Kansellert</span>
                          )}
                          {booking.payments && booking.payments.length > 0 ? (
                            <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-emerald-100 text-emerald-700 w-fit">Betalt</span>
                          ) : booking.totalAmount && Number(booking.totalAmount) > 0 ? (
                            <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-500 w-fit">Ubetalt</span>
                          ) : null}
                        </div>
                      </td>
                    </>
                  ) : (
                    <td className="px-4 py-4">
                      {booking.status === "pending" && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-700">Venter</span>
                      )}
                      {booking.status === "approved" && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700">Godkjent</span>
                      )}
                      {booking.status === "rejected" && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700">Avslått</span>
                      )}
                      {booking.status === "cancelled" && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">Kansellert</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end">
                      {(booking.status === "pending" || booking.status === "approved") && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAction(booking.id, "cancel")
                          }}
                          disabled={processingId === booking.id}
                          className="p-2 rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-50"
                          title="Kanseller"
                        >
                          {processingId === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      )}
                      {(activeTab === "history" || activeTab === "rejected") && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(booking.id)
                          }}
                          disabled={processingId === booking.id}
                          className="p-2 rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-50"
                          title="Slett permanent"
                        >
                          {processingId === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
          ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Reject reason modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl p-6">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
              {rejectAllInGroup 
                ? "Avslå alle bookinger i serien?" 
                : rejectSelectedIds.length > 1 
                  ? `Avslå ${rejectSelectedIds.length} valgte bookinger?`
                  : "Avslå booking?"
              }
            </h3>
            <p className="text-gray-600 text-center mb-4">
              {rejectAllInGroup 
                ? "Alle ventende bookinger i serien vil bli avslått. Brukeren vil bli varslet på e-post."
                : rejectSelectedIds.length > 1
                  ? `${rejectSelectedIds.length} bookinger vil bli avslått. Brukeren vil bli varslet på e-post.`
                  : "Brukeren vil bli varslet på e-post."
              }
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
                  setRejectModalOpen(false)
                  setRejectingBookingId(null)
                  setRejectReason("")
                  setRejectAllInGroup(false)
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={confirmReject}
                disabled={processingId === rejectingBookingId}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {processingId === rejectingBookingId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    {rejectAllInGroup ? "Avslå alle" : "Avslå"}
                  </>
                )}
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
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Fra</h4>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>
                      {format(new Date(selectedBooking.startTime), "EEEE d. MMMM yyyy", { locale: nb })}
                      {" kl. "}
                      {format(new Date(selectedBooking.startTime), "HH:mm")}
                    </span>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Til</h4>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>
                      {format(new Date(selectedBooking.endTime), "EEEE d. MMMM yyyy", { locale: nb })}
                      {" kl. "}
                      {format(new Date(selectedBooking.endTime), "HH:mm")}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {(() => {
                      const start = new Date(selectedBooking.startTime)
                      const end = new Date(selectedBooking.endTime)
                      let durationMs = end.getTime() - start.getTime()
                      
                      // Håndter tilfelle hvor booking går over midnatt
                      if (durationMs < 0) {
                        durationMs += 24 * 60 * 60 * 1000
                      }
                      
                      const durationHours = Math.round((durationMs / (1000 * 60 * 60)) * 10) / 10
                      return `${durationHours} timer`
                    })()}
                  </p>
                </div>
              </div>

              {/* User info */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Bruker</h4>
                <div className="flex items-center gap-2 text-gray-600">
                  <User className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="font-medium">{selectedBooking.user.name || "—"}</p>
                    <p className="text-sm text-gray-500">{selectedBooking.user.email}</p>
                  </div>
                </div>
              </div>

              {/* Contact info */}
              {(selectedBooking.contactName || selectedBooking.contactEmail || selectedBooking.contactPhone) && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Kontaktinfo</h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    {selectedBooking.contactName && (
                      <p><span className="font-medium">Navn:</span> {selectedBooking.contactName}</p>
                    )}
                    {selectedBooking.contactEmail && (
                      <p><span className="font-medium">E-post:</span> {selectedBooking.contactEmail}</p>
                    )}
                    {selectedBooking.contactPhone && (
                      <p><span className="font-medium">Telefon:</span> {selectedBooking.contactPhone}</p>
                    )}
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

              {/* Action buttons based on status */}
              {selectedBooking.status === "pending" && (
                <div className="border-t pt-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(selectedBooking.id, "approve")}
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
                        setRejectingBookingId(selectedBooking.id)
                        setRejectModalOpen(true)
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
               selectedBooking.preferredPaymentMethod === "INVOICE" && 
               selectedBooking.invoice && (
                <div className="border-t pt-4 space-y-2">
                  {/* Se faktura-knapp - vises alltid når det finnes en faktura */}
                  <button
                    onClick={() => handleViewInvoice(selectedBooking.invoiceId!)}
                    disabled={isLoadingPreview}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
                  {/* Marker som betalt-knapp - kun når faktura er sendt */}
                  {selectedBooking.invoice.status === "SENT" && (
                    <button
                      onClick={() => handleMarkAsPaid(selectedBooking.id)}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Marker som betalt
                    </button>
                  )}
                </div>
              )}
              {/* Mark as paid for non-invoice bookings */}
              {selectedBooking.status === "approved" && 
               selectedBooking.preferredPaymentMethod !== "INVOICE" &&
               pricingEnabled && 
               selectedBooking.totalAmount && 
               selectedBooking.totalAmount > 0 && (
                <div className="border-t pt-4">
                  {(() => {
                    const paymentStatus = getPaymentStatus(selectedBooking)
                    if (paymentStatus !== "paid") {
                      return (
                        <button
                          onClick={() => handleMarkAsPaid(selectedBooking.id)}
                          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Marker som betalt
                        </button>
                      )
                    }
                    return null
                  })()}
                </div>
              )}

              {/* Edit and Cancel buttons for approved/pending bookings that aren't past */}
              {(selectedBooking.status === "approved" || selectedBooking.status === "pending") && 
               new Date(selectedBooking.startTime) > new Date() && (
                <div className="border-t pt-4 space-y-2">
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
                      onClick={() => handleAction(selectedBooking.id, "cancel")}
                      disabled={processingId === selectedBooking.id}
                      className="flex-1 px-4 py-2 bg-white border border-gray-300 text-red-600 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {processingId === selectedBooking.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Kanseller
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mark as paid modal */}
      {markPaidModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Marker booking som betalt</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    E-posttype
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={useTemplate}
                        onChange={() => setUseTemplate(true)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-gray-700">
                        Bruk mal (inkluderer admin-notat fra delen)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={!useTemplate}
                        onChange={() => setUseTemplate(false)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-gray-700">
                        Skriv egen melding
                      </span>
                    </label>
                  </div>
                </div>

                {!useTemplate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Egen melding
                    </label>
                    <textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      placeholder="Skriv din melding her..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {useTemplate && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-800">
                      Systemet vil generere en e-post basert på malen og inkludere admin-notatet fra delen hvis det finnes.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setMarkPaidModalOpen(false)
                    setMarkingPaidBookingId(null)
                    setCustomMessage("")
                    setUseTemplate(true)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={isMarkingPaid}
                >
                  Avbryt
                </button>
                <button
                  onClick={confirmMarkAsPaid}
                  disabled={isMarkingPaid || (!useTemplate && !customMessage.trim())}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isMarkingPaid ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Registrerer...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Marker som betalt og send e-post
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Preview Modal */}
      {emailPreviewModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Forhåndsvisning av e-post
                </h3>
                <button
                  onClick={() => {
                    setEmailPreviewModalOpen(false)
                    setEmailPreview(null)
                    setPreviewBookingId(null)
                    setPreviewError(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingPreview ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : previewError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-900 mb-1">Feil</h4>
                      <p className="text-sm text-red-700">{previewError}</p>
                      {previewError.includes("Vipps er ikke konfigurert") && (
                        <Link
                          href="/admin/settings"
                          className="mt-3 inline-block text-sm text-red-700 underline hover:text-red-900"
                        >
                          Gå til Innstillinger
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ) : emailPreview ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Emne
                    </label>
                    <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                      {emailPreview.subject}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Innhold
                    </label>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <iframe
                        srcDoc={emailPreview.html}
                        className="w-full h-96 border-0"
                        title="Email preview"
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {!isLoadingPreview && !previewError && emailPreview && (
              <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setEmailPreviewModalOpen(false)
                    setEmailPreview(null)
                    setPreviewBookingId(null)
                    setPreviewError(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={confirmEmailAndApprove}
                  disabled={processingId === previewBookingId}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {processingId === previewBookingId ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Godkjenner...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Godkjenn og send e-post
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invoice PDF Preview Modal */}
      {invoicePreviewModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full shadow-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
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
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* PDF Preview */}
            <div className="flex-1 overflow-auto p-6 bg-gray-50">
              {isLoadingPreview ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : previewError ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
                  <p className="text-red-600">{previewError}</p>
                </div>
              ) : invoicePreviewUrl ? (
                <iframe
                  src={invoicePreviewUrl}
                  className="w-full h-full min-h-[600px] border border-gray-200 rounded-lg"
                  title="Faktura forhåndsvisning"
                />
              ) : null}
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
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={confirmSendInvoice}
                disabled={isSendingInvoice || !invoicePreviewUrl}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSendingInvoice ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sender...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send faktura
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
            ...editingBooking,
            resourceId: editingBooking.resource.id,
            resourceName: editingBooking.resource.name,
            resourcePartId: editingBooking.resourcePart?.id || null,
            resourcePartName: editingBooking.resourcePart?.name || null
          }}
          isAdmin={true}
          onClose={() => setEditingBooking(null)}
          onSaved={async () => {
            setEditingBooking(null)
            await fetchBookings()
          }}
        />
      )}

      {/* Recurring Group Modal */}
      {selectedRecurringGroup && (() => {
        const pendingBookings = selectedRecurringGroup.bookings.filter(b => b.status === "pending")
        const approvedBookings = selectedRecurringGroup.bookings.filter(b => b.status === "approved")
        const firstBooking = selectedRecurringGroup.bookings[0]
        
        return (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedRecurringGroup(null)}
          >
            <div 
              className="bg-white rounded-xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      <h3 className="text-xl font-bold text-gray-900">Gjentakende booking</h3>
                    </div>
                    <p className="text-gray-600">{firstBooking?.title}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {firstBooking?.resource.name}
                      {firstBooking?.resourcePart && ` • ${firstBooking.resourcePart.name}`}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedRecurringGroup(null)}
                    className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {bulkEditMode ? (
                  /* Bulk Edit Form */
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <h4 className="text-sm font-semibold text-blue-800">
                        {bulkEditSelectedOnly 
                          ? `Rediger ${selectedModalBookingIds.size} valgte bookinger`
                          : `Rediger alle ${selectedRecurringGroup.bookings.length} bookinger`
                        }
                      </h4>
                      <p className="text-xs text-blue-600 mt-1">Felt som står tomme beholdes uendret</p>
                    </div>
                    
                    {/* Title */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tittel</label>
                      <input
                        type="text"
                        value={bulkEditData.title}
                        onChange={(e) => setBulkEditData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder={firstBooking?.title || "Behold eksisterende"}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    {/* Resource */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fasilitet</label>
                      {isLoadingResources ? (
                        <div className="flex items-center gap-2 text-gray-500 py-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Laster fasiliteter...
                        </div>
                      ) : (
                        <>
                          <select
                            value={bulkEditData.resourceId}
                            onChange={(e) => setBulkEditData(prev => ({ 
                              ...prev, 
                              resourceId: e.target.value,
                              resourcePartId: null 
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Behold eksisterende fasilitet</option>
                            {availableResources.map(resource => (
                              <option key={resource.id} value={resource.id}>
                                {resource.name}
                              </option>
                            ))}
                          </select>
                          
                          {bulkEditData.resourceId && (() => {
                            const selectedResource = availableResources.find(r => r.id === bulkEditData.resourceId)
                            if (selectedResource && selectedResource.parts.length > 0) {
                              return (
                                <select
                                  value={bulkEditData.resourcePartId || ""}
                                  onChange={(e) => setBulkEditData(prev => ({ 
                                    ...prev, 
                                    resourcePartId: e.target.value || null 
                                  }))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mt-2"
                                >
                                  <option value="">Hele fasiliteten</option>
                                  {selectedResource.parts.map(part => (
                                    <option key={part.id} value={part.id}>
                                      {part.name}
                                    </option>
                                  ))}
                                </select>
                              )
                            }
                            return null
                          })()}
                        </>
                      )}
                    </div>
                    
                    {/* Time - New absolute time */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nytt tidspunkt (alle datoer)</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="time"
                          value={bulkEditData.newStartTime}
                          onChange={(e) => setBulkEditData(prev => ({ ...prev, newStartTime: e.target.value }))}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <span className="text-gray-500">–</span>
                        <input
                          type="time"
                          value={bulkEditData.newEndTime}
                          onChange={(e) => setBulkEditData(prev => ({ ...prev, newEndTime: e.target.value }))}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Sett nytt klokkeslett for alle valgte bookinger (datoene beholdes)</p>
                    </div>
                    
                    {/* Time shift alternative */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Eller: Flytt tid med X minutter</label>
                      <div className="flex gap-2 items-center">
                        <button
                          type="button"
                          onClick={() => setBulkEditData(prev => ({ ...prev, timeShiftMinutes: prev.timeShiftMinutes - 30, newStartTime: "", newEndTime: "" }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          -30 min
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkEditData(prev => ({ ...prev, timeShiftMinutes: prev.timeShiftMinutes - 60, newStartTime: "", newEndTime: "" }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          -1 time
                        </button>
                        <span className={`flex-1 text-center font-medium ${bulkEditData.timeShiftMinutes !== 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                          {bulkEditData.timeShiftMinutes === 0 
                            ? 'Ingen endring' 
                            : bulkEditData.timeShiftMinutes > 0 
                              ? `+${bulkEditData.timeShiftMinutes} min`
                              : `${bulkEditData.timeShiftMinutes} min`
                          }
                        </span>
                        <button
                          type="button"
                          onClick={() => setBulkEditData(prev => ({ ...prev, timeShiftMinutes: prev.timeShiftMinutes + 60, newStartTime: "", newEndTime: "" }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          +1 time
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkEditData(prev => ({ ...prev, timeShiftMinutes: prev.timeShiftMinutes + 30, newStartTime: "", newEndTime: "" }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          +30 min
                        </button>
                      </div>
                      {bulkEditData.timeShiftMinutes !== 0 && (
                        <button
                          type="button"
                          onClick={() => setBulkEditData(prev => ({ ...prev, timeShiftMinutes: 0 }))}
                          className="text-xs text-blue-600 hover:underline mt-1"
                        >
                          Nullstill
                        </button>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => {
                          setBulkEditMode(false)
                          setBulkEditSelectedOnly(false)
                          setBulkEditData({ title: "", resourceId: "", resourcePartId: null, newStartTime: "", newEndTime: "", timeShiftMinutes: 0 })
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                      >
                        Avbryt
                      </button>
                      <button
                        onClick={handleBulkUpdate}
                        disabled={isBulkUpdating || (!bulkEditData.title && !bulkEditData.resourceId && !bulkEditData.newStartTime && !bulkEditData.newEndTime && bulkEditData.timeShiftMinutes === 0)}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                      >
                        {isBulkUpdating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Oppdaterer...
                          </>
                        ) : (
                          <>
                            <Pencil className="w-4 h-4" />
                            Oppdater alle
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 bg-blue-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-blue-700">{selectedRecurringGroup.bookings.length}</p>
                        <p className="text-xs text-blue-600">Totalt</p>
                      </div>
                      <div className="p-3 bg-amber-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-amber-700">{pendingBookings.length}</p>
                        <p className="text-xs text-amber-600">Venter</p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-green-700">{approvedBookings.length}</p>
                        <p className="text-xs text-green-600">Godkjent</p>
                      </div>
                    </div>

                    {/* Booking list with checkboxes */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-700">Alle bookinger i serien</h4>
                        {pendingBookings.length > 0 && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const pendingIds = pendingBookings.map(b => b.id)
                                setSelectedModalBookingIds(new Set(pendingIds))
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Velg alle
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={() => setSelectedModalBookingIds(new Set())}
                              className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                            >
                              Fjern valg
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedRecurringGroup.bookings.map((booking) => {
                          const isSelected = selectedModalBookingIds.has(booking.id)
                          const isPending = booking.status === "pending"
                          
                          return (
                            <div 
                              key={booking.id}
                              className={`flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer ${
                                isSelected ? "bg-blue-100 border border-blue-300" : "bg-gray-50 hover:bg-gray-100"
                              }`}
                              onClick={(e) => {
                                // Don't open booking if clicking on checkbox
                                const target = e.target as HTMLElement
                                if (target.tagName === 'INPUT' || target.closest('input')) return
                                setSelectedRecurringGroup(null)
                                setSelectedBooking(booking)
                              }}
                            >
                              <div className="flex items-center gap-3">
                                {/* Checkbox for pending bookings */}
                                {isPending ? (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      e.stopPropagation()
                                      const newSet = new Set(selectedModalBookingIds)
                                      if (e.target.checked) {
                                        newSet.add(booking.id)
                                      } else {
                                        newSet.delete(booking.id)
                                      }
                                      setSelectedModalBookingIds(newSet)
                                    }}
                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                  />
                                ) : (
                                  <div className="w-4 h-4" /> /* Spacer for non-pending */
                                )}
                                <div className="text-sm">
                                  <p className="font-medium text-gray-900">
                                    {format(new Date(booking.startTime), "EEEE d. MMM", { locale: nb })}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {format(new Date(booking.startTime), "HH:mm")} - {format(new Date(booking.endTime), "HH:mm")}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
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
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    {/* Action buttons for selected bookings */}
                    {(() => {
                      const selectedCount = selectedModalBookingIds.size
                      const allPendingSelected = selectedCount === pendingBookings.length && selectedCount > 0
                      
                      if (selectedCount === 0 && pendingBookings.length === 0) return null
                      
                      return (
                        <div className="border-t pt-4">
                          <p className="text-sm text-gray-600 mb-3">
                            {selectedCount === 0 
                              ? "Velg bookinger du vil behandle"
                              : allPendingSelected
                                ? `Behandle alle ${selectedCount} ventende bookinger:`
                                : `Behandle ${selectedCount} av ${pendingBookings.length} valgte bookinger:`
                            }
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                if (selectedCount === 0) return
                                setProcessingId("batch")
                                try {
                                  // Use bulk endpoint for much faster processing
                                  const response = await fetch('/api/admin/bookings/bulk', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      bookingIds: Array.from(selectedModalBookingIds),
                                      action: 'approve'
                                    })
                                  })
                                  if (!response.ok) {
                                    const error = await response.json()
                                    throw new Error(error.error || 'Kunne ikke godkjenne bookinger')
                                  }
                                  await fetchBookings()
                                  setSelectedRecurringGroup(null)
                                  setSelectedModalBookingIds(new Set())
                                } catch (error) {
                                  console.error('Bulk approve failed:', error)
                                  alert(error instanceof Error ? error.message : 'En feil oppstod')
                                } finally {
                                  setProcessingId(null)
                                }
                              }}
                              disabled={processingId !== null || selectedCount === 0}
                              className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                            >
                              {processingId !== null ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Behandler...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4" />
                                  {allPendingSelected ? "Godkjenn alle" : `Godkjenn (${selectedCount})`}
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                if (selectedCount === 0) return
                                // Store selected IDs for bulk rejection
                                const selectedArray = Array.from(selectedModalBookingIds)
                                setRejectSelectedIds(selectedArray)
                                setSelectedRecurringGroup(null)
                                setRejectingBookingId(selectedArray[0])
                                setRejectReason("")
                                setRejectAllInGroup(selectedArray.length > 1) // Flag for bulk rejection
                                setRejectModalOpen(true)
                              }}
                              disabled={processingId !== null || selectedCount === 0}
                              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                            >
                              <XCircle className="w-4 h-4" />
                              {allPendingSelected ? "Avslå alle" : `Avslå (${selectedCount})`}
                            </button>
                          </div>
                        </div>
                      )
                    })()}
                    
                    {/* Edit buttons - at bottom like single booking modal */}
                    <div className="border-t pt-4 mt-4">
                      <div className="flex gap-2">
                        {selectedModalBookingIds.size > 0 && (
                          <button
                            onClick={() => {
                              fetchResources()
                              setBulkEditMode(true)
                              setBulkEditSelectedOnly(true)
                              setBulkEditData({
                                title: "",
                                resourceId: "",
                                resourcePartId: null,
                                newStartTime: "",
                                newEndTime: "",
                                timeShiftMinutes: 0
                              })
                            }}
                            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                          >
                            <Pencil className="w-4 h-4" />
                            Rediger valgte ({selectedModalBookingIds.size})
                          </button>
                        )}
                        <button
                          onClick={() => {
                            fetchResources()
                            setBulkEditMode(true)
                            setBulkEditSelectedOnly(false)
                            setBulkEditData({
                              title: "",
                              resourceId: "",
                              resourcePartId: null,
                              newStartTime: "",
                              newEndTime: "",
                              timeShiftMinutes: 0
                            })
                          }}
                          className={`${selectedModalBookingIds.size > 0 ? 'flex-1' : 'w-full'} px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2`}
                        >
                          <Pencil className="w-4 h-4" />
                          Rediger alle
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

