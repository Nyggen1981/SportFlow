"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { ChevronLeft, ChevronRight, X, Calendar, Clock, User, Repeat, CheckCircle2, XCircle, Trash2, Pencil, Loader2 } from "lucide-react"
import { EditBookingModal } from "@/components/EditBookingModal"
import { BookingModal, BookingModalData } from "@/components/BookingModal"
import { 
  format, 
  startOfWeek, 
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  addDays, 
  addWeeks, 
  subWeeks,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  parseISO,
  isToday,
  getDay
} from "date-fns"
import { nb } from "date-fns/locale"

type ViewMode = "week" | "month"

interface Booking {
  id: string
  title: string
  startTime: string
  endTime: string
  status: string
  resourcePartId?: string | null
  resourcePartName?: string | null
  resourcePartParentId?: string | null
  userId?: string | null
  userName?: string | null
  userEmail?: string | null
  isRecurring?: boolean
  parentBookingId?: string | null
  isCompetition?: boolean // For competition matches
}

interface Part {
  id: string
  name: string
  parentId?: string | null
  children?: { id: string; name: string }[]
}

interface BlockedSlot {
  startTime: string
  endTime: string
  partId: string | null // null = whole facility
  blockedBy: string // booking title or "Hele [facility]" / "[Part name]"
  bookingId: string
}

interface Props {
  resourceId: string
  resourceName: string
  resourceColor?: string // Facility color for consistent styling
  bookings?: Booking[] // Now optional - will fetch client-side if not provided
  parts: Part[]
}

export function ResourceCalendar({ resourceId, resourceName, resourceColor = "#3b82f6", bookings: initialBookings, parts }: Props) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "admin"
  const isModerator = session?.user?.role === "moderator"
  const canManageBookings = isAdmin || isModerator
  const isLoggedIn = session?.user !== undefined
  
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedPart, setSelectedPart] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [fullBookingData, setFullBookingData] = useState<BookingModalData | null>(null)
  const [isLoadingBookingDetails, setIsLoadingBookingDetails] = useState(false)
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)
  const [bookings, setBookings] = useState<Booking[]>(initialBookings || [])
  const [isProcessing, setIsProcessing] = useState(false)
  const [applyToAll, setApplyToAll] = useState(false)
  const [rejectingBookingId, setRejectingBookingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null)
  const [isLoadingBookings, setIsLoadingBookings] = useState(!initialBookings)
  const [pricingEnabled, setPricingEnabled] = useState(false)
  const weekViewScrollRef = useRef<HTMLDivElement>(null)

  // Fetch bookings client-side if not provided via props
  useEffect(() => {
    if (initialBookings) {
      setBookings(initialBookings)
      setIsLoadingBookings(false)
      return
    }

    const fetchBookings = async () => {
      setIsLoadingBookings(true)
      try {
        const response = await fetch(`/api/resources/${resourceId}/bookings`)
        if (response.ok) {
          const data = await response.json()
          setBookings(data.bookings || [])
        }
      } catch (error) {
        console.error("Failed to fetch bookings:", error)
      } finally {
        setIsLoadingBookings(false)
      }
    }

    fetchBookings()
  }, [resourceId, initialBookings])

  // Fetch pricing status
  useEffect(() => {
    fetch("/api/pricing/status")
      .then(res => res.json())
      .then(data => setPricingEnabled(data.enabled || false))
      .catch(() => setPricingEnabled(false))
  }, [])

  // Fetch full booking details for the modal
  const handleBookingClick = useCallback(async (booking: Booking) => {
    if (booking.isCompetition) return
    
    setSelectedBooking(booking)
    setIsLoadingBookingDetails(true)
    
    try {
      const response = await fetch(`/api/bookings/${booking.id}`)
      if (response.ok) {
        const data = await response.json()
        setFullBookingData({
          id: data.id,
          title: data.title,
          description: data.description,
          startTime: data.startTime,
          endTime: data.endTime,
          status: data.status,
          statusNote: data.statusNote,
          contactName: data.contactName,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone,
          totalAmount: data.totalAmount,
          invoiceId: data.invoiceId,
          invoice: data.invoice,
          preferredPaymentMethod: data.preferredPaymentMethod,
          isRecurring: data.isRecurring,
          parentBookingId: data.parentBookingId,
          resource: {
            id: resourceId,
            name: resourceName,
            color: resourceColor
          },
          resourcePart: data.resourcePart,
          user: data.user || { name: null, email: "" },
          payments: data.payments
        })
      } else {
        // Fallback to basic data
        setFullBookingData({
          id: booking.id,
          title: booking.title,
          description: null,
          startTime: booking.startTime,
          endTime: booking.endTime,
          status: booking.status,
          statusNote: null,
          contactName: null,
          contactEmail: null,
          contactPhone: null,
          totalAmount: null,
          invoiceId: null,
          invoice: null,
          preferredPaymentMethod: null,
          isRecurring: booking.isRecurring,
          parentBookingId: booking.parentBookingId,
          resource: {
            id: resourceId,
            name: resourceName,
            color: resourceColor
          },
          resourcePart: booking.resourcePartId ? { id: booking.resourcePartId, name: booking.resourcePartName || "" } : null,
          user: { name: booking.userName || null, email: booking.userEmail || "" },
          payments: []
        })
      }
    } catch (error) {
      console.error("Failed to fetch booking:", error)
      // Use basic data on error
      setFullBookingData({
        id: booking.id,
        title: booking.title,
        description: null,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        statusNote: null,
        contactName: null,
        contactEmail: null,
        contactPhone: null,
        totalAmount: null,
        invoiceId: null,
        invoice: null,
        preferredPaymentMethod: null,
        isRecurring: booking.isRecurring,
        parentBookingId: booking.parentBookingId,
        resource: {
          id: resourceId,
          name: resourceName,
          color: resourceColor
        },
        resourcePart: booking.resourcePartId ? { id: booking.resourcePartId, name: booking.resourcePartName || "" } : null,
        user: { name: booking.userName || null, email: booking.userEmail || "" },
        payments: []
      })
    } finally {
      setIsLoadingBookingDetails(false)
    }
  }, [resourceId, resourceName, resourceColor])

  const closeBookingModal = useCallback(() => {
    setSelectedBooking(null)
    setFullBookingData(null)
    setApplyToAll(false)
  }, [])

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Month view calculations
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const monthStartWeek = startOfWeek(monthStart, { weekStartsOn: 1 })
  
  const monthDays = useMemo(() => {
    const days = []
    let day = monthStartWeek
    while (day <= monthEnd || days.length % 7 !== 0) {
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }, [monthStartWeek, monthEnd])

  const hours = Array.from({ length: 18 }, (_, i) => i + 6) // 06:00 - 23:00

  const filteredBookings = useMemo(() => {
    return bookings.filter(booking => {
      if (selectedPart && booking.resourcePartName !== selectedPart) {
        return false
      }
      const bookingStart = parseISO(booking.startTime)
      const bookingEnd = parseISO(booking.endTime)
      
      // Check if booking overlaps with any day in view (not just starts on it)
      const daysToCheck = viewMode === "week" ? weekDays : monthDays
      return daysToCheck.some(day => {
        const dayStart = startOfDay(day)
        const dayEnd = endOfDay(day)
        return bookingStart <= dayEnd && bookingEnd >= dayStart
      })
    })
  }, [bookings, selectedPart, weekDays, monthDays, viewMode])

  // Calculate blocked slots based on hierarchy
  const blockedSlots = useMemo(() => {
    const slots: BlockedSlot[] = []
    
    bookings.forEach(booking => {
      // If booking is for whole facility (no part), all parts are blocked
      if (!booking.resourcePartId) {
        parts.forEach(part => {
          slots.push({
            startTime: booking.startTime,
            endTime: booking.endTime,
            partId: part.id,
            blockedBy: `Hele ${resourceName}`,
            bookingId: booking.id
          })
          // Also block children of this part
          if (part.children) {
            part.children.forEach(child => {
              slots.push({
                startTime: booking.startTime,
                endTime: booking.endTime,
                partId: child.id,
                blockedBy: `Hele ${resourceName}`,
                bookingId: booking.id
              })
            })
          }
        })
      } else {
        // Booking is for a specific part
        const bookedPart = parts.find(p => p.id === booking.resourcePartId)
        
        // Block whole facility
        slots.push({
          startTime: booking.startTime,
          endTime: booking.endTime,
          partId: null, // null = whole facility
          blockedBy: booking.resourcePartName || "En del",
          bookingId: booking.id
        })
        
        // If booking is for a parent part, block all children
        if (bookedPart?.children && bookedPart.children.length > 0) {
          bookedPart.children.forEach(child => {
            slots.push({
              startTime: booking.startTime,
              endTime: booking.endTime,
              partId: child.id,
              blockedBy: bookedPart.name,
              bookingId: booking.id
            })
          })
        }
        
        // If booking is for a child part, block parent
        if (booking.resourcePartParentId) {
          slots.push({
            startTime: booking.startTime,
            endTime: booking.endTime,
            partId: booking.resourcePartParentId,
            blockedBy: booking.resourcePartName || "En del",
            bookingId: booking.id
          })
        }
      }
    })
    
    return slots
  }, [bookings, parts, resourceName])

  // Get blocked slots for the selected part view
  const getBlockedSlotsForDay = useCallback((day: Date) => {
    // Don't show blocked slots when viewing "Alle deler" - actual bookings show the full picture
    if (!selectedPart) return []
    
    return blockedSlots.filter(slot => {
      const start = parseISO(slot.startTime)
      if (!isSameDay(day, start)) return false
      
      // If viewing a specific part, show blocks for that part
      const part = parts.find(p => p.name === selectedPart)
      return part && slot.partId === part.id
    })
  }, [blockedSlots, selectedPart, parts])

  const getBookingsForDay = useCallback((day: Date) => {
    return filteredBookings.filter(booking => {
      const bookingStart = parseISO(booking.startTime)
      const bookingEnd = parseISO(booking.endTime)
      const dayStart = startOfDay(day)
      const dayEnd = endOfDay(day)
      // Show booking if it overlaps with this day
      return bookingStart <= dayEnd && bookingEnd >= dayStart
    })
  }, [filteredBookings])

  const getBookingsForDayAndHour = useCallback((day: Date, hour: number) => {
    return filteredBookings.filter(booking => {
      const bookingStart = parseISO(booking.startTime)
      const bookingEnd = parseISO(booking.endTime)
      const dayStart = startOfDay(day)
      const dayEnd = endOfDay(day)
      
      // First check if booking overlaps with this day at all
      if (!(bookingStart <= dayEnd && bookingEnd >= dayStart)) return false
      
      // For this specific day, calculate the effective start/end hours
      const effectiveStart = bookingStart < dayStart ? dayStart : bookingStart
      const effectiveEnd = bookingEnd > dayEnd ? dayEnd : bookingEnd
      
      const startHour = effectiveStart.getHours()
      const endHour = effectiveEnd.getHours() + (effectiveEnd.getMinutes() > 0 ? 1 : 0)
      
      return hour >= startHour && hour < endHour
    })
  }, [filteredBookings])

  // Calculate overlap columns for all bookings in a day
  const getBookingColumns = useCallback((dayBookings: Booking[]) => {
    if (dayBookings.length === 0) return new Map<string, { column: number; totalColumns: number }>()
    
    // Sort by start time
    const sorted = [...dayBookings].sort((a, b) => 
      parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime()
    )
    
    // Track column assignments: bookingId -> { column, totalColumns }
    const columns = new Map<string, { column: number; totalColumns: number }>()
    
    // Track active bookings in each column (column index -> end time)
    const columnEndTimes: Date[] = []
    
    sorted.forEach(booking => {
      const start = parseISO(booking.startTime)
      const end = parseISO(booking.endTime)
      
      // Find first available column (where the booking has ended)
      let column = 0
      while (column < columnEndTimes.length && columnEndTimes[column] > start) {
        column++
      }
      
      // Assign column
      columnEndTimes[column] = end
      columns.set(booking.id, { column, totalColumns: 1 })
    })
    
    // Calculate totalColumns for each booking by finding overlapping bookings
    sorted.forEach(booking => {
      const start = parseISO(booking.startTime)
      const end = parseISO(booking.endTime)
      
      const overlapping = sorted.filter(b => {
        const bStart = parseISO(b.startTime)
        const bEnd = parseISO(b.endTime)
        return start < bEnd && end > bStart
      })
      
      const maxColumn = Math.max(...overlapping.map(b => columns.get(b.id)?.column || 0))
      const totalColumns = maxColumn + 1
      
      overlapping.forEach(b => {
        const current = columns.get(b.id)
        if (current) {
          columns.set(b.id, { ...current, totalColumns: Math.max(current.totalColumns, totalColumns) })
        }
      })
    })
    
    return columns
  }, [])

  // Scroll to bottom of week view on mount and when viewMode/date/part changes
  // Also scroll when loading finishes (isLoadingBookings becomes false)
  useEffect(() => {
    if (viewMode === "week" && weekViewScrollRef.current && !isLoadingBookings) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        if (weekViewScrollRef.current) {
          weekViewScrollRef.current.scrollTop = weekViewScrollRef.current.scrollHeight
        }
      }, 100)
    }
  }, [viewMode, currentDate, selectedPart, isLoadingBookings])

  const handleBookingAction = useCallback(async (bookingId: string, action: "approve" | "reject" | "cancel", statusNote?: string) => {
    setIsProcessing(true)
    const booking = bookings.find(b => b.id === bookingId)
    const shouldApplyToAll = applyToAll && booking?.isRecurring
    
    try {
      let response
      if (action === "cancel") {
        response = await fetch(`/api/bookings/${bookingId}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Kansellert fra kalender", applyToAll: shouldApplyToAll })
        })
      } else {
        const body: { action: string; applyToAll?: boolean; statusNote?: string } = { action }
        if (shouldApplyToAll) body.applyToAll = true
        if (statusNote) body.statusNote = statusNote
        
        response = await fetch(`/api/admin/bookings/${bookingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        })
      }

      if (response.ok) {
        // Update bookings state instead of reloading
        if (action === "cancel") {
          setBookings(prev => prev.filter(b => b.id !== bookingId))
        } else if (action === "approve") {
          setBookings(prev => prev.map(b => 
            b.id === bookingId ? { ...b, status: "approved" } : b
          ))
        } else if (action === "reject") {
          setBookings(prev => prev.map(b => 
            b.id === bookingId ? { ...b, status: "rejected" } : b
          ))
        }
        setSelectedBooking(null) // Close the modal after action
        setIsProcessing(false)
      } else {
        const error = await response.json()
        alert(error.error || "En feil oppstod")
        setIsProcessing(false)
      }
    } catch (error) {
      console.error("Failed to perform booking action:", error)
      alert("En feil oppstod")
      setIsProcessing(false)
    }
  }, [bookings, applyToAll])

  return (
    <div className="overflow-x-hidden">
      {/* Controls */}
      <div className="flex flex-col gap-2 sm:gap-4 mb-3 sm:mb-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => viewMode === "week" 
                ? setCurrentDate(subWeeks(currentDate, 1))
                : setCurrentDate(subMonths(currentDate, 1))
              }
              className="p-1 sm:p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <h3 className="font-semibold text-gray-900 text-xs sm:text-base text-center">
              {viewMode === "week" 
                ? `${format(weekStart, "d.", { locale: nb })} - ${format(addDays(weekStart, 6), "d. MMM", { locale: nb })}`
                : format(currentDate, "MMM yyyy", { locale: nb })
              }
            </h3>
            <button
              onClick={() => viewMode === "week"
                ? setCurrentDate(addWeeks(currentDate, 1))
                : setCurrentDate(addMonths(currentDate, 1))
              }
              className="p-1 sm:p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="ml-1 sm:ml-2 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
            >
              I dag
            </button>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-gray-100 p-0.5 sm:p-1 rounded-lg">
            <button
              onClick={() => setViewMode("week")}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                viewMode === "week" 
                  ? "bg-white text-gray-900 shadow-sm" 
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Uke
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                viewMode === "month" 
                  ? "bg-white text-gray-900 shadow-sm" 
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Mnd
            </button>
          </div>
        </div>

        {parts.length > 0 && (
          <select
            value={selectedPart || ""}
            onChange={(e) => setSelectedPart(e.target.value || null)}
            className="input text-xs sm:text-sm py-1 sm:py-2 max-w-full sm:max-w-[200px]"
          >
            <option value="">Alle deler</option>
            {parts.map(part => (
              <option key={part.id} value={part.name}>{part.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Loading state */}
      {isLoadingBookings && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm text-gray-500">Laster kalender...</p>
          </div>
        </div>
      )}

      {/* Week view */}
      {!isLoadingBookings && viewMode === "week" && (
        <div className="border border-gray-200 rounded-lg sm:rounded-xl overflow-hidden">
          {/* Time grid with sticky header */}
          <div ref={weekViewScrollRef} className="max-h-[400px] sm:max-h-[600px] overflow-y-auto overflow-x-hidden">
            {/* Header - sticky */}
            <div className="grid bg-gray-50 border-b border-gray-200 sticky top-0 z-20" style={{ gridTemplateColumns: '40px repeat(7, 1fr)' }}>
              <div className="p-1 sm:p-3 text-center text-[10px] sm:text-sm font-medium text-gray-500" />
              {weekDays.map((day) => (
                <div 
                  key={day.toISOString()} 
                  className={`p-1 sm:p-3 text-center border-l border-gray-200 ${
                    isToday(day) ? 'bg-blue-50' : ''
                  }`}
                >
                  <p className="text-[8px] sm:text-xs text-gray-500 uppercase">
                    {format(day, "EEEEE", { locale: nb })}
                  </p>
                  <p className={`text-xs sm:text-lg font-semibold ${
                    isToday(day) ? 'text-blue-600' : 'text-gray-900'
                  }`}>
                    {format(day, "d")}
                  </p>
                </div>
              ))}
            </div>

            {/* Time slots */}
            {hours.map((hour) => (
              <div key={hour} className="grid border-b border-gray-100 last:border-b-0" style={{ gridTemplateColumns: '40px repeat(7, 1fr)' }}>
                <div className="p-1 sm:p-2 text-right text-[10px] sm:text-xs text-gray-400 pr-1 sm:pr-3">
                  {hour.toString().padStart(2, "0")}
                </div>
                {weekDays.map((day) => {
                  // Get all bookings for this day and calculate columns
                  const allDayBookings = getBookingsForDay(day)
                  const bookingColumns = getBookingColumns(allDayBookings)
                  
                  // Render bookings that should start rendering at this hour
                  // This includes: bookings starting this hour, or multi-day bookings starting at hour 6 (first hour)
                  const bookingsStartingThisHour = allDayBookings.filter(booking => {
                    const bookingStart = parseISO(booking.startTime)
                    const dayStart = startOfDay(day)
                    
                    // If booking starts before this day, render it at hour 6 (first visible hour)
                    if (bookingStart < dayStart) {
                      return hour === 6
                    }
                    // Otherwise, render it at its actual start hour
                    return bookingStart.getHours() === hour
                  })
                  
                  // Get blocked slots for this day
                  const dayBlockedSlots = getBlockedSlotsForDay(day)
                  const blockedSlotsStartingThisHour = dayBlockedSlots.filter(slot => {
                    const start = parseISO(slot.startTime)
                    return start.getHours() === hour
                  })
                  
                  return (
                    <div 
                      key={`${day.toISOString()}-${hour}`} 
                      className={`relative min-h-[48px] border-l border-gray-100 pointer-events-none ${
                        isToday(day) ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {/* Blocked slots indicator */}
                      {blockedSlotsStartingThisHour.map((slot, index) => {
                        const start = parseISO(slot.startTime)
                        const end = parseISO(slot.endTime)
                        const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
                        
                        const gapPx = 1
                        const cellHeight = 48
                        const topPx = (start.getMinutes() / 60) * cellHeight + gapPx
                        const heightPx = durationHours * cellHeight - (gapPx * 2)
                        
                        return (
                          <div
                            key={`blocked-${slot.bookingId}-${index}`}
                            className="absolute rounded-md px-2 py-1 text-xs overflow-hidden"
                            style={{
                              top: `${topPx}px`,
                              left: '2px',
                              width: 'calc(100% - 4px)',
                              height: `${Math.max(heightPx, 24)}px`,
                              backgroundColor: 'rgba(156, 163, 175, 0.3)',
                              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(156, 163, 175, 0.2) 4px, rgba(156, 163, 175, 0.2) 8px)',
                              border: '1px dashed #9ca3af',
                              color: '#6b7280',
                              zIndex: 5,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title={`Blokkert av: ${slot.blockedBy}`}
                          >
                            <span className="text-xs">🔒</span>
                            <span className="truncate text-xs font-medium">Blokkert</span>
                          </div>
                        )
                      })}
                      
                      {bookingsStartingThisHour.map((booking) => {
                          const bookingStart = parseISO(booking.startTime)
                          const bookingEnd = parseISO(booking.endTime)
                          const dayStartTime = startOfDay(day)
                          const dayEndTime = endOfDay(day)
                          
                          // For multi-day bookings, calculate effective start/end for this day
                          const effectiveStart = bookingStart < dayStartTime ? dayStartTime : bookingStart
                          const effectiveEnd = bookingEnd > dayEndTime ? dayEndTime : bookingEnd
                          
                          // Set effective start to hour 6 if it's before 6:00 (first visible hour)
                          const displayStart = effectiveStart.getHours() < 6 
                            ? new Date(effectiveStart.setHours(6, 0, 0, 0))
                            : effectiveStart
                          
                          const durationHours = (effectiveEnd.getTime() - displayStart.getTime()) / (1000 * 60 * 60)
                          const isPending = booking.status === "pending"
                          const isCompetition = booking.status === "competition"
                          
                          // Add minimal gap between bookings vertically
                          const gapPx = 1
                          const cellHeight = 48
                          const topPx = (displayStart.getMinutes() / 60) * cellHeight + gapPx
                          const heightPx = Math.max(durationHours * cellHeight - (gapPx * 2), 20)
                          
                          // Get column info for this booking
                          const columnInfo = bookingColumns.get(booking.id) || { column: 0, totalColumns: 1 }
                          const { column, totalColumns } = columnInfo
                          const isSingleBox = totalColumns === 1
                          
                          // Side by side layout for multiple bookings
                          const gapPxHorizontal = 2
                          const widthPercent = 100 / totalColumns
                          const leftPercent = column * widthPercent
                          
                          // For single box: full width with margin. For multiple: side by side
                          const boxWidth = isSingleBox 
                            ? 'calc(100% - 4px)' 
                            : `calc(${widthPercent}% - ${gapPxHorizontal}px)`

                          // Determine colors based on status - use resource color for consistency
                          const getColors = () => {
                            if (isCompetition) {
                              return {
                                bg: '#f97316', // Orange for competitions
                                border: '#ea580c',
                                text: 'white'
                              }
                            }
                            if (isPending) {
                              return {
                                bg: `${resourceColor}20`,
                                border: resourceColor,
                                text: 'black'
                              }
                            }
                            return {
                              bg: resourceColor,
                              border: undefined,
                              text: 'white'
                            }
                          }
                          const colors = getColors()

                          // Dynamic height (like main calendar) - only show title, no extra info
                          const actualHeight = Math.max(heightPx, 20)
                          
                          return (
                            <div
                              key={booking.id}
                              onClick={() => !isCompetition && handleBookingClick(booking)}
                              className={`absolute rounded-md px-1 sm:px-2 py-0.5 sm:py-1 overflow-hidden pointer-events-auto ${
                                isPending ? 'border-2 border-dashed' : 'border border-black'
                              } ${isCompetition ? 'cursor-default' : 'cursor-pointer hover:opacity-90'}`}
                              style={{
                                top: `${topPx}px`,
                                left: isSingleBox ? '2px' : `calc(${leftPercent}% + ${gapPxHorizontal / 2}px)`,
                                width: boxWidth,
                                height: `${actualHeight}px`,
                                minHeight: '20px',
                                backgroundColor: colors.bg,
                                borderColor: isPending ? colors.border : (isCompetition ? '#f97316' : 'black'),
                                color: colors.text,
                                boxShadow: isPending ? 'none' : '0 1px 2px rgba(0,0,0,0.15)',
                                zIndex: 10 + (totalColumns - column),
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'flex-start',
                                alignItems: 'flex-start'
                              }}
                              title={`${booking.title}${booking.resourcePartName ? ` (${booking.resourcePartName})` : ''}${isPending ? ' (venter på godkjenning)' : ''}${isCompetition ? ' (Turneringskamp)' : ''}`}
                            >
                              <p className="font-medium text-[7px] sm:text-[10px] leading-tight w-full truncate">{booking.title}</p>
                            </div>
                          )
                        })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Month view */}
      {!isLoadingBookings && viewMode === "month" && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
            {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((day) => (
              <div key={day} className="p-3 text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {monthDays.map((day, index) => {
              const dayBookings = getBookingsForDay(day)
              const isCurrentMonth = isSameMonth(day, currentDate)
              
              return (
                <div 
                  key={day.toISOString()} 
                  className={`min-h-[100px] p-2 border-b border-r border-gray-100 ${
                    index % 7 === 0 ? 'border-l-0' : ''
                  } ${!isCurrentMonth ? 'bg-gray-50/50' : ''} ${
                    isToday(day) ? 'bg-blue-50' : ''
                  }`}
                >
                  <p className={`text-sm font-medium mb-1 ${
                    isToday(day) 
                      ? 'text-blue-600' 
                      : isCurrentMonth 
                        ? 'text-gray-900' 
                        : 'text-gray-400'
                  }`}>
                    {format(day, "d")}
                  </p>
                  <div className="space-y-1">
                    {dayBookings.slice(0, 3).map((booking) => {
                      const isPending = booking.status === "pending"
                      const isCompetition = booking.status === "competition"
                      
                      // Get class names based on status
                      const getClassNames = () => {
                        if (isCompetition) {
                          return "bg-orange-500 text-white"
                        }
                        if (isPending) {
                          return "border border-dashed text-black"
                        }
                        return "text-white"
                      }
                      
                      const getInlineStyles = () => {
                        if (isCompetition) return {}
                        if (isPending) {
                          return {
                            backgroundColor: `${resourceColor}20`,
                            borderColor: resourceColor
                          }
                        }
                        return { backgroundColor: resourceColor }
                      }
                      
                      return (
                        <div
                          key={booking.id}
                          onClick={() => !isCompetition && handleBookingClick(booking)}
                          className={`px-1.5 py-0.5 rounded text-xs truncate ${isCompetition ? 'cursor-default' : 'cursor-pointer'} ${getClassNames()}`}
                          style={getInlineStyles()}
                          title={`${booking.title} - ${format(parseISO(booking.startTime), "HH:mm")}${booking.resourcePartName ? ` (${booking.resourcePartName})` : ''}${isPending ? ' (venter)' : ''}${isCompetition ? ' (Turneringskamp)' : ''}`}
                        >
                          {format(parseISO(booking.startTime), "HH:mm")} {booking.title}
                        </div>
                      )
                    })}
                    {dayBookings.length > 3 && (
                      <p className="text-xs text-gray-500 pl-1">
                        +{dayBookings.length - 3} til
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div 
            className="w-4 h-4 rounded"
            style={{ backgroundColor: resourceColor }}
          />
          <span className="text-gray-600">Godkjent</span>
        </div>
        <div className="flex items-center gap-2">
          <div 
            className="w-4 h-3 rounded border-2 border-dashed"
            style={{ 
              backgroundColor: `${resourceColor}20`, 
              borderColor: resourceColor 
            }} 
          />
          <span className="text-gray-600">Venter på godkjenning</span>
        </div>
      </div>

      {/* Booking Info Modal */}
      {selectedBooking && fullBookingData && (
        <BookingModal
          booking={fullBookingData}
          isOpen={true}
          onClose={closeBookingModal}
          userRole={canManageBookings ? (isAdmin ? "admin" : "moderator") : "user"}
          pricingEnabled={pricingEnabled}
          isProcessing={isProcessing}
          onApprove={canManageBookings ? async (bookingId) => {
            await handleBookingAction(bookingId, "approve")
            closeBookingModal()
          } : undefined}
          onReject={canManageBookings ? (bookingId) => {
            setRejectingBookingId(bookingId)
            closeBookingModal()
          } : undefined}
          onEdit={(booking) => {
            setEditingBooking({
              id: selectedBooking.id,
              title: selectedBooking.title,
              startTime: selectedBooking.startTime,
              endTime: selectedBooking.endTime,
              status: selectedBooking.status,
              resourcePartId: selectedBooking.resourcePartId || null,
              resourcePartName: selectedBooking.resourcePartName || null,
              resourcePartParentId: selectedBooking.resourcePartParentId || null,
              userId: selectedBooking.userId || null,
              userName: selectedBooking.userName || null,
              userEmail: selectedBooking.userEmail || null,
              isRecurring: selectedBooking.isRecurring || false,
              parentBookingId: selectedBooking.parentBookingId || null
            } as Booking)
            closeBookingModal()
          }}
          onCancel={async (bookingId) => {
            setCancellingBookingId(bookingId)
            closeBookingModal()
          }}
        />
      )}
      
      {/* Loading state for booking modal */}
      {selectedBooking && !fullBookingData && isLoadingBookingDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 shadow-2xl flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-gray-600">Laster booking...</p>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectingBookingId && (() => {
        const booking = bookings.find(b => b.id === rejectingBookingId)
        const isRecurring = booking?.isRecurring && applyToAll
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full shadow-2xl p-6">
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
                    setRejectingBookingId(null)
                    setRejectReason("")
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={async () => {
                    await handleBookingAction(rejectingBookingId, "reject", rejectReason || undefined)
                    setRejectingBookingId(null)
                    setRejectReason("")
                  }}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
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

      {/* Cancel Confirmation Modal */}
      {cancellingBookingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl p-6 animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
              Kanseller booking?
            </h3>
            <p className="text-gray-600 text-center mb-6">
              Er du sikker på at du vil kansellere denne bookingen? Denne handlingen kan ikke angres.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancellingBookingId(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={async () => {
                  await handleBookingAction(cancellingBookingId, "cancel")
                  setCancellingBookingId(null)
                }}
                disabled={isProcessing}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Kanseller
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
            description: null,
            startTime: editingBooking.startTime,
            endTime: editingBooking.endTime,
            status: editingBooking.status,
            resourceId: resourceId,
            resourceName: resourceName,
            resourcePartId: editingBooking.resourcePartId || null,
            resourcePartName: editingBooking.resourcePartName || null
          }}
          isAdmin={canManageBookings}
          onClose={() => setEditingBooking(null)}
          onSaved={(updatedBooking) => {
            setBookings(prev => prev.map(b => 
              b.id === updatedBooking.id 
                ? { 
                    ...b, 
                    title: updatedBooking.title,
                    startTime: updatedBooking.startTime,
                    endTime: updatedBooking.endTime,
                    status: updatedBooking.status
                  } 
                : b
            ))
            setEditingBooking(null)
            // Refresh page to get updated data from server
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}

