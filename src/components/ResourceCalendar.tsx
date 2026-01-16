"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { ChevronLeft, ChevronRight, X, Calendar, Clock, User, Repeat, CheckCircle2, XCircle, Trash2, Pencil, Loader2 } from "lucide-react"
import { EditBookingModal } from "@/components/EditBookingModal"
import { 
  format, 
  startOfWeek, 
  startOfMonth,
  endOfMonth,
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
  bookings?: Booking[] // Now optional - will fetch client-side if not provided
  parts: Part[]
}

export function ResourceCalendar({ resourceId, resourceName, bookings: initialBookings, parts }: Props) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "admin"
  const isModerator = session?.user?.role === "moderator"
  const canManageBookings = isAdmin || isModerator
  const isLoggedIn = session?.user !== undefined
  
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedPart, setSelectedPart] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)
  const [bookings, setBookings] = useState<Booking[]>(initialBookings || [])
  const [isProcessing, setIsProcessing] = useState(false)
  const [applyToAll, setApplyToAll] = useState(true)
  const [rejectingBookingId, setRejectingBookingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null)
  const [isLoadingBookings, setIsLoadingBookings] = useState(!initialBookings)
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
      const bookingDate = parseISO(booking.startTime)
      if (viewMode === "week") {
        return weekDays.some(day => isSameDay(day, bookingDate))
      } else {
        return monthDays.some(day => isSameDay(day, bookingDate))
      }
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
      const start = parseISO(booking.startTime)
      return isSameDay(day, start)
    })
  }, [filteredBookings])

  const getBookingsForDayAndHour = useCallback((day: Date, hour: number) => {
    return filteredBookings.filter(booking => {
      const start = parseISO(booking.startTime)
      const end = parseISO(booking.endTime)
      
      if (!isSameDay(day, start)) return false
      
      const startHour = start.getHours()
      const endHour = end.getHours() + (end.getMinutes() > 0 ? 1 : 0)
      
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
                  
                  // Only render bookings that START in this hour (to avoid duplicates)
                  const bookingsStartingThisHour = allDayBookings.filter(booking => {
                    const start = parseISO(booking.startTime)
                    return start.getHours() === hour
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
                          const start = parseISO(booking.startTime)
                          const end = parseISO(booking.endTime)
                          
                          // Cap the end time to midnight of the same day to prevent overflow
                          const endOfDay = new Date(start)
                          endOfDay.setHours(23, 59, 59, 999)
                          const cappedEnd = end > endOfDay ? endOfDay : end
                          
                          const durationHours = (cappedEnd.getTime() - start.getTime()) / (1000 * 60 * 60)
                          const isPending = booking.status === "pending"
                          const isCompetition = booking.status === "competition"
                          
                          // Add minimal gap between bookings vertically
                          const gapPx = 1
                          const cellHeight = 48
                          const topPx = (start.getMinutes() / 60) * cellHeight + gapPx
                          const heightPx = durationHours * cellHeight - (gapPx * 2)
                          
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

                          // Determine colors based on status
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
                                bg: '#dcfce7',
                                border: '#22c55e',
                                text: '#15803d'
                              }
                            }
                            return {
                              bg: '#22c55e',
                              border: undefined,
                              text: 'white'
                            }
                          }
                          const colors = getColors()

                          return (
                            <div
                              key={booking.id}
                              onClick={() => !isCompetition && setSelectedBooking(booking)}
                              className={`absolute rounded-md px-2 py-1 text-xs overflow-hidden pointer-events-auto ${
                                isPending ? 'border-2 border-dashed' : ''
                              } ${isCompetition ? 'cursor-default' : 'cursor-pointer'}`}
                              style={{
                                top: `${topPx}px`,
                                left: isSingleBox ? '2px' : `calc(${leftPercent}% + ${gapPxHorizontal / 2}px)`,
                                width: boxWidth,
                                height: `${Math.max(heightPx, 36)}px`,
                                backgroundColor: colors.bg,
                                borderColor: colors.border,
                                color: colors.text,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                zIndex: 10,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'flex-start',
                                alignItems: 'flex-start'
                              }}
                              title={`${booking.title}${booking.resourcePartName ? ` (${booking.resourcePartName})` : ''}${isPending ? ' (venter på godkjenning)' : ''}${isCompetition ? ' (Turneringskamp)' : ''}`}
                            >
                              <p className="font-medium truncate">{booking.title}</p>
                              {booking.resourcePartName && (
                                <p className="text-[10px] opacity-80 truncate">{booking.resourcePartName}</p>
                              )}
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
                          return "bg-green-50 text-green-700 border border-dashed border-green-400"
                        }
                        return "bg-green-500 text-white"
                      }
                      
                      return (
                        <div
                          key={booking.id}
                          onClick={() => !isCompetition && setSelectedBooking(booking)}
                          className={`px-1.5 py-0.5 rounded text-xs truncate ${isCompetition ? 'cursor-default' : 'cursor-pointer'} ${getClassNames()}`}
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
          <div className="w-4 h-4 rounded booking-approved" />
          <span className="text-gray-600">Godkjent</span>
        </div>
        <div className="flex items-center gap-2">
          <div 
            className="w-4 h-3 rounded border-2 border-dashed" 
            style={{ 
              backgroundColor: '#dcfce7', 
              borderColor: '#22c55e' 
            }} 
          />
          <span className="text-gray-600">Venter på godkjenning</span>
        </div>
      </div>

      {/* Booking Info Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">
                {canManageBookings ? "Behandle booking" : "Booking-detaljer"}
              </h3>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 text-lg">{selectedBooking.title}</h4>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    selectedBooking.status === "pending" 
                      ? "bg-amber-100 text-amber-700" 
                      : "bg-green-100 text-green-700"
                  }`}>
                    {selectedBooking.status === "pending" ? "Venter på godkjenning" : "Godkjent"}
                  </span>
                  {selectedBooking.isRecurring && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      <Repeat className="w-3 h-3" />
                      Gjentakende
                    </span>
                  )}
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: '#22c55e' }}
                  />
                  <span>
                    {resourceName}
                    {selectedBooking.resourcePartName && ` → ${selectedBooking.resourcePartName}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {format(parseISO(selectedBooking.startTime), "EEEE d. MMMM yyyy", { locale: nb })}
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4 text-gray-400" />
                  {format(parseISO(selectedBooking.startTime), "HH:mm")} - {format(parseISO(selectedBooking.endTime), "HH:mm")}
                </div>
                {/* GDPR: Show user info to admins/moderators OR if it's your own booking */}
                {(canManageBookings || selectedBooking.userId === session?.user?.id) && selectedBooking.userName && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="w-4 h-4 text-gray-400" />
                    {selectedBooking.userName}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {(() => {
              // Only show actions if user is logged in
              if (!isLoggedIn) {
                return null
              }

              const isOwner = selectedBooking.userId === session?.user?.id
              const canCancel = isOwner && (selectedBooking.status === "pending" || selectedBooking.status === "approved")
              const canEdit = (isOwner || canManageBookings) && (selectedBooking.status === "pending" || selectedBooking.status === "approved")
              const isPast = new Date(selectedBooking.startTime) < new Date()

              if (canManageBookings) {
                return (
                  <div className="p-4 border-t bg-gray-50 rounded-b-xl space-y-3">
                    {/* Recurring booking checkbox */}
                    {selectedBooking.isRecurring && selectedBooking.status === "pending" && (
                      <label className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={applyToAll}
                          onChange={(e) => setApplyToAll(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-blue-800">
                          Behandle alle gjentakende bookinger
                        </span>
                      </label>
                    )}

                    {selectedBooking.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleBookingAction(selectedBooking.id, "approve")}
                          disabled={isProcessing}
                          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          {selectedBooking.isRecurring && applyToAll ? "Godkjenn alle" : "Godkjenn"}
                        </button>
                        <button
                          onClick={() => {
                            setRejectingBookingId(selectedBooking.id)
                            setSelectedBooking(null)
                          }}
                          disabled={isProcessing}
                          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          {selectedBooking.isRecurring && applyToAll ? "Avslå alle" : "Avslå"}
                        </button>
                      </div>
                    )}
                    
                    {/* Edit and Cancel buttons */}
                    <div className="flex gap-2">
                      {!isPast && (
                        <button
                          onClick={() => { 
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
                            setSelectedBooking(null)
                          }}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <Pencil className="w-4 h-4" />
                          Rediger
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setCancellingBookingId(selectedBooking.id)
                          setSelectedBooking(null)
                        }}
                        disabled={isProcessing}
                        className="flex-1 px-4 py-2 bg-white border border-gray-300 text-red-600 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Kanseller
                      </button>
                    </div>
                  </div>
                )
              } else if (canEdit && !isPast) {
                return (
                  <div className="p-4 border-t bg-gray-50 rounded-b-xl space-y-2">
                    <p className="text-xs text-gray-500 text-center mb-2">Dette er din booking</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { 
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
                          setSelectedBooking(null)
                        }}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Pencil className="w-4 h-4" />
                        Rediger
                      </button>
                      <button
                        onClick={() => {
                          setCancellingBookingId(selectedBooking.id)
                          setSelectedBooking(null)
                        }}
                        disabled={isProcessing}
                        className="flex-1 px-4 py-2 bg-white border border-gray-300 text-red-600 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Kanseller
                      </button>
                    </div>
                  </div>
                )
              } else {
                return null
              }
            })()}
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

