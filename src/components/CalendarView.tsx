"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { ChevronLeft, ChevronRight, List, Grid3X3, CheckCircle2, XCircle, Trash2, X, Loader2, Calendar, Clock, User, Repeat, Pencil, Save, Star } from "lucide-react"
import { EditBookingModal } from "./EditBookingModal"
import { 
  format, 
  startOfWeek, 
  startOfMonth,
  endOfMonth,
  addDays, 
  addWeeks, 
  addMonths,
  subWeeks,
  subMonths,
  isSameDay,
  isSameMonth,
  parseISO,
  isToday
} from "date-fns"
import { nb } from "date-fns/locale"

interface Category {
  id: string
  name: string
  color: string
}

interface ResourcePart {
  id: string
  name: string
}

interface Resource {
  id: string
  name: string
  color: string
  categoryId: string | null
  categoryName?: string | null
  parts: ResourcePart[]
}

interface Booking {
  id: string
  title: string
  startTime: string
  endTime: string
  status: string
  resourceId: string
  resourceName: string
  resourcePartName?: string | null
  isRecurring?: boolean
  parentBookingId?: string | null
  userId?: string
}

interface UserPreferences {
  defaultCalendarView: "week" | "month"
  defaultResourceId: string | null
  selectedResourceIds: string[]
  selectedCategoryIds: string[]
}

interface Props {
  categories: Category[]
  resources: Resource[]
  bookings: Booking[]
}

type ViewMode = "week" | "month"

export function CalendarView({ categories, resources, bookings: initialBookings }: Props) {
  const { data: session, status: sessionStatus } = useSession()
  const isAdmin = session?.user?.role === "admin"
  const isLoggedIn = sessionStatus === "authenticated"
  
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [applyToAll, setApplyToAll] = useState(true)
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)
  const [rejectingBookingId, setRejectingBookingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  const weekViewScrollRef = useRef<HTMLDivElement>(null)

  // Load user preferences on mount
  useEffect(() => {
    if (isLoggedIn && !preferencesLoaded) {
      fetch("/api/user/preferences")
        .then(res => res.json())
        .then(prefs => {
          if (prefs.defaultCalendarView) {
            setViewMode(prefs.defaultCalendarView)
          }
          if (prefs.defaultResourceId) {
            setSelectedResourceId(prefs.defaultResourceId)
            // Find and set category for this resource
            const resource = resources.find(r => r.id === prefs.defaultResourceId)
            if (resource?.categoryId) {
              setSelectedCategoryId(resource.categoryId)
            }
          }
          setPreferencesLoaded(true)
        })
        .catch(err => {
          console.error("Failed to load preferences:", err)
          setPreferencesLoaded(true)
        })
    }
  }, [isLoggedIn, preferencesLoaded])

  // Save preferences
  const savePreferences = useCallback(async () => {
    if (!isLoggedIn) return

    setSavingPreferences(true)
    try {
      await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultCalendarView: viewMode,
          defaultResourceId: selectedResourceId
        })
      })
      setShowSaveSuccess(true)
      setTimeout(() => setShowSaveSuccess(false), 2000)
    } catch (err) {
      console.error("Failed to save preferences:", err)
    } finally {
      setSavingPreferences(false)
    }
  }, [isLoggedIn, viewMode, selectedResourceId])

  // Filter resources by selected category
  const availableResources = useMemo(() => {
    if (!selectedCategoryId) return []
    return resources.filter(r => r.categoryId === selectedCategoryId)
  }, [resources, selectedCategoryId])

  const selectedResource = availableResources.find(r => r.id === selectedResourceId)

  // Filter bookings based on selections
  const filteredBookings = useMemo(() => {
    if (!selectedResourceId) return []
    
    return bookings.filter(b => {
      if (b.resourceId !== selectedResourceId) return false
      
      // If a specific part is selected, only show bookings for that part
      if (selectedPartId) {
        const selectedPart = selectedResource?.parts.find(p => p.id === selectedPartId)
        return b.resourcePartName === selectedPart?.name
      }
      
      // If "Alle deler" is selected, show all bookings for this resource
      return true
    })
  }, [bookings, selectedResourceId, selectedPartId, selectedResource])

  // Week view data
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const hours = Array.from({ length: 18 }, (_, i) => i + 6) // 06:00 - 23:00

  // Month view data
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarDays = Array.from({ length: 42 }, (_, i) => addDays(calendarStart, i))

  const getBookingsForDay = (day: Date) => {
    return filteredBookings.filter(booking => 
      isSameDay(parseISO(booking.startTime), day)
    )
  }

  const getResourceColor = (resourceId: string) => {
    return resources.find(r => r.id === resourceId)?.color || '#3b82f6'
  }

  // Calculate overlap columns for all bookings in a day
  const getBookingColumns = (dayBookings: Booking[]) => {
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
      columns.set(booking.id, { column, totalColumns: 1 }) // totalColumns will be updated
    })
    
    // Now calculate totalColumns for each booking by finding overlapping bookings
    sorted.forEach(booking => {
      const start = parseISO(booking.startTime)
      const end = parseISO(booking.endTime)
      
      // Count how many bookings overlap with this one
      const overlapping = sorted.filter(b => {
        const bStart = parseISO(b.startTime)
        const bEnd = parseISO(b.endTime)
        return start < bEnd && end > bStart
      })
      
      // Find max column used by overlapping bookings
      const maxColumn = Math.max(...overlapping.map(b => columns.get(b.id)?.column || 0))
      const totalColumns = maxColumn + 1
      
      // Update all overlapping bookings with the same totalColumns
      overlapping.forEach(b => {
        const current = columns.get(b.id)
        if (current) {
          columns.set(b.id, { ...current, totalColumns: Math.max(current.totalColumns, totalColumns) })
        }
      })
    })
    
    return columns
  }

  // Scroll to bottom of week view on mount and when viewMode/date changes
  useEffect(() => {
    if (viewMode === "week" && weekViewScrollRef.current) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        if (weekViewScrollRef.current) {
          weekViewScrollRef.current.scrollTop = weekViewScrollRef.current.scrollHeight
        }
      }, 100)
    }
  }, [viewMode, currentDate, selectedCategoryId, selectedResourceId, selectedPartId])

  const navigate = (direction: "prev" | "next") => {
    if (viewMode === "week") {
      setCurrentDate(direction === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1))
    } else {
      setCurrentDate(direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1))
    }
  }

  const handleBookingAction = async (bookingId: string, action: "approve" | "reject" | "cancel", statusNote?: string) => {
    setIsProcessing(true)
    const booking = bookings.find(b => b.id === bookingId)
    const shouldApplyToAll = applyToAll && booking?.isRecurring
    
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
      const result = await response.json()
      
      if (action === "approve") {
        if (shouldApplyToAll && booking) {
          // Update all related recurring bookings
          const parentId = booking.parentBookingId || booking.id
          setBookings(bookings.map(b => 
            (b.id === parentId || b.parentBookingId === parentId) && b.status === "pending"
              ? { ...b, status: "approved" } 
              : b
          ))
        } else {
          setBookings(bookings.map(b => 
            b.id === bookingId ? { ...b, status: "approved" } : b
          ))
        }
      } else {
        if (shouldApplyToAll && booking) {
          // Remove all related recurring bookings
          const parentId = booking.parentBookingId || booking.id
          setBookings(bookings.filter(b => 
            !(b.id === parentId || b.parentBookingId === parentId)
          ))
        } else {
          setBookings(bookings.filter(b => b.id !== bookingId))
        }
      }
    }
    
    setIsProcessing(false)
    setSelectedBooking(null)
    setApplyToAll(true) // Reset for next time
  }

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategoryId(categoryId)
    setSelectedResourceId(null) // Reset resource when category changes
    setSelectedPartId(null) // Reset part when category changes
  }

  const handleResourceChange = (resourceId: string) => {
    setSelectedResourceId(resourceId)
    setSelectedPartId(null) // Reset part selection when resource changes
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
          {/* Three selectors: Category, Resource, Part */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={selectedCategoryId || ""}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Velg kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {selectedCategoryId && availableResources.length > 0 && (
              <select
                value={selectedResourceId || ""}
                onChange={(e) => handleResourceChange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Velg fasilitet</option>
                {availableResources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
            {selectedResource && selectedResource.parts.length > 0 && (
              <select
                value={selectedPartId || ""}
                onChange={(e) => setSelectedPartId(e.target.value || null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Alle deler</option>
                {selectedResource.parts.map((part) => (
                  <option key={part.id} value={part.id}>
                    {part.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Navigation and view controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("prev")}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Forrige"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="font-semibold text-gray-900 min-w-[200px] text-center">
                {viewMode === "week" 
                  ? `${format(weekStart, "d. MMM", { locale: nb })} - ${format(addDays(weekStart, 6), "d. MMM yyyy", { locale: nb })}`
                  : format(currentDate, "MMMM yyyy", { locale: nb })
                }
              </h2>
              <button
                onClick={() => navigate("next")}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Neste"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="ml-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              >
                I dag
              </button>
            </div>

            {/* View mode toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("week")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                  viewMode === "week" ? "bg-white shadow text-gray-900" : "text-gray-600"
                }`}
              >
                <List className="w-4 h-4" />
                Uke
              </button>
              <button
                onClick={() => setViewMode("month")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                  viewMode === "month" ? "bg-white shadow text-gray-900" : "text-gray-600"
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
                Måned
              </button>
            </div>

            {/* Save as default button - only for logged in users */}
            {isLoggedIn && (
              <button
                onClick={savePreferences}
                disabled={savingPreferences}
                className={`p-2 rounded-lg transition-all ${
                  showSaveSuccess 
                    ? "bg-green-100 text-green-700" 
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                }`}
                title={showSaveSuccess ? "Lagret!" : "Sett som standardvisning"}
              >
                {savingPreferences ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : showSaveSuccess ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Star className="w-5 h-5" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Week View */}
      {viewMode === "week" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Time grid with sticky header */}
          <div ref={weekViewScrollRef} className="max-h-[650px] overflow-y-auto pr-[17px]">
            {/* Header - sticky */}
            <div className="grid bg-gray-50 border-b border-gray-200 sticky top-0 z-10 gap-x-2" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
              <div className="p-3 text-center text-sm font-medium text-gray-500" />
              {weekDays.map((day) => (
                <div 
                  key={day.toISOString()} 
                  className={`p-3 text-center border-l border-gray-200 ${
                    isToday(day) ? 'bg-blue-50' : 'bg-gray-50'
                  }`}
                >
                  <p className="text-xs text-gray-500 uppercase">
                    {format(day, "EEE", { locale: nb })}
                  </p>
                  <p className={`text-lg font-semibold ${
                    isToday(day) ? 'text-blue-600' : 'text-gray-900'
                  }`}>
                    {format(day, "d")}
                  </p>
                </div>
              ))}
            </div>

            {/* Time rows */}
            {hours.map((hour) => (
              <div key={hour} className="grid border-b border-gray-100 last:border-b-0 gap-x-2" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
                <div className="p-2 text-right text-xs text-gray-400 pr-3">
                  {hour.toString().padStart(2, "0")}:00
                </div>
                {weekDays.map((day) => {
                  // Get all bookings for this day and calculate columns
                  const allDayBookings = getBookingsForDay(day)
                  const bookingColumns = getBookingColumns(allDayBookings)
                  
                  // Only render bookings that START in this hour (to avoid duplicates)
                  const bookingsStartingThisHour = allDayBookings.filter(b => {
                    const start = parseISO(b.startTime)
                    return start.getHours() === hour
                  })
                  
                  return (
                    <div 
                      key={`${day.toISOString()}-${hour}`} 
                      className={`relative min-h-[48px] border-l border-gray-100 pointer-events-none ${
                        isToday(day) ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {bookingsStartingThisHour.map((booking) => {
                          const start = parseISO(booking.startTime)
                          const end = parseISO(booking.endTime)
                          
                          // Cap the end time to midnight of the same day to prevent overflow
                          const endOfDay = new Date(start)
                          endOfDay.setHours(23, 59, 59, 999)
                          const cappedEnd = end > endOfDay ? endOfDay : end
                          
                          const duration = (cappedEnd.getTime() - start.getTime()) / (1000 * 60 * 60)
                          const isPending = booking.status === "pending"
                          const resourceColor = getResourceColor(booking.resourceId)

                          // Add minimal gap between bookings vertically
                          const gapPx = 1
                          const cellHeight = 48 // min-h-[48px]
                          const topPx = (start.getMinutes() / 60) * cellHeight + gapPx
                          const heightPx = duration * cellHeight - (gapPx * 2)
                          
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

                          return (
                            <div
                              key={booking.id}
                              onClick={() => setSelectedBooking(booking)}
                              className={`absolute rounded-md px-2 py-1 text-xs overflow-hidden cursor-pointer pointer-events-auto booking-event ${
                                isPending ? 'border-2 border-dashed' : ''
                              }`}
                              style={{
                                top: `${topPx}px`,
                                left: isSingleBox ? '2px' : `calc(${leftPercent}% + ${gapPxHorizontal / 2}px)`,
                                width: boxWidth,
                                height: `${Math.max(heightPx, 36)}px`,
                                backgroundColor: isPending 
                                  ? `${resourceColor}20`
                                  : resourceColor,
                                borderColor: isPending ? resourceColor : undefined,
                                color: isPending ? resourceColor : 'white',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                zIndex: 10,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'flex-start',
                                alignItems: 'flex-start'
                              }}
                              title={`${format(start, "HH:mm")}-${format(end, "HH:mm")} ${booking.title} - ${booking.resourceName}${booking.resourcePartName ? ` (${booking.resourcePartName})` : ''}${isPending ? ' (venter på godkjenning)' : ''} - Klikk for mer info`}
                            >
                              <p className="font-medium truncate">{booking.title}</p>
                              <p className={`truncate text-[10px] ${isPending ? 'opacity-70' : 'opacity-80'}`}>
                                {booking.resourcePartName || booking.resourceName}
                              </p>
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

      {/* Month View */}
      {viewMode === "month" && (
        <div className="card overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
            {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((day) => (
              <div key={day} className="p-3 text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              const dayBookings = getBookingsForDay(day)
              const isCurrentMonth = isSameMonth(day, currentDate)
              
              return (
                <div 
                  key={day.toISOString()}
                  className={`min-h-[100px] p-2 border-b border-r border-gray-100 ${
                    !isCurrentMonth ? 'bg-gray-50' : ''
                  } ${isToday(day) ? 'bg-blue-50' : ''} ${
                    i % 7 === 0 ? 'border-l-0' : ''
                  }`}
                >
                  <p className={`text-sm font-medium mb-1 ${
                    !isCurrentMonth ? 'text-gray-400' : 
                    isToday(day) ? 'text-blue-600' : 'text-gray-900'
                  }`}>
                    {format(day, "d")}
                  </p>
                  <div className="space-y-1">
                    {dayBookings.slice(0, 3).map((booking) => {
                      const isPending = booking.status === "pending"
                      const resourceColor = getResourceColor(booking.resourceId)
                      
                      return (
                        <div
                          key={booking.id}
                          onClick={() => setSelectedBooking(booking)}
                          className={`text-xs px-1.5 py-0.5 rounded truncate cursor-pointer booking-event ${
                            isPending ? 'border border-dashed' : ''
                          }`}
                          style={{
                            backgroundColor: isPending 
                              ? `${resourceColor}20`
                              : resourceColor,
                            borderColor: isPending ? resourceColor : 'transparent',
                            color: isPending ? resourceColor : 'white'
                          }}
                          title={`${format(parseISO(booking.startTime), "HH:mm")} ${booking.title}${isPending ? ' (venter)' : ''} - Klikk for mer info`}
                        >
                          {format(parseISO(booking.startTime), "HH:mm")} {booking.title}
                        </div>
                      )
                    })}
                    {dayBookings.length > 3 && (
                      <p className="text-xs text-gray-500 px-1">
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

      {/* Legend - only show pending status */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 rounded border-2 border-dashed border-gray-400 bg-gray-100" />
          <span className="text-gray-600">Venter på godkjenning</span>
        </div>
        {isAdmin && (
          <div className="ml-4 pl-4 border-l border-gray-200 text-gray-500 italic">
            Klikk på en booking for å behandle
          </div>
        )}
      </div>

      {/* Booking Info Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">
                {isAdmin ? "Behandle booking" : "Booking-detaljer"}
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
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: getResourceColor(selectedBooking.resourceId) }}
                  />
                  <span>
                    {selectedBooking.resourceName}
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
              </div>
            </div>

            {/* Actions */}
            {(() => {
              const isOwner = selectedBooking.userId === session?.user?.id
              const canCancel = isOwner && (selectedBooking.status === "pending" || selectedBooking.status === "approved")
              const canEdit = (isOwner || isAdmin) && (selectedBooking.status === "pending" || selectedBooking.status === "approved")
              const isPast = new Date(selectedBooking.startTime) < new Date()

              if (isAdmin) {
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
                          className="flex-1 btn btn-success disabled:opacity-50"
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
                          className="flex-1 btn btn-danger disabled:opacity-50"
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
                          onClick={() => { setEditingBooking(selectedBooking); setSelectedBooking(null) }}
                          className="flex-1 btn btn-primary disabled:opacity-50"
                        >
                          <Pencil className="w-4 h-4" />
                          Rediger
                        </button>
                      )}
                      <button
                        onClick={() => handleBookingAction(selectedBooking.id, "cancel")}
                        disabled={isProcessing}
                        className="flex-1 btn btn-secondary text-red-600 hover:bg-red-50 disabled:opacity-50"
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
                        onClick={() => { setEditingBooking(selectedBooking); setSelectedBooking(null) }}
                        className="flex-1 btn btn-primary disabled:opacity-50"
                      >
                        <Pencil className="w-4 h-4" />
                        Rediger
                      </button>
                      <button
                        onClick={() => handleBookingAction(selectedBooking.id, "cancel")}
                        disabled={isProcessing}
                        className="flex-1 btn btn-secondary text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Kanseller
                      </button>
                    </div>
                    <button
                      onClick={() => setSelectedBooking(null)}
                      className="w-full btn btn-secondary"
                    >
                      Lukk
                    </button>
                  </div>
                )
              } else {
                return (
                  <div className="p-4 border-t bg-gray-50 rounded-b-xl">
                    <button
                      onClick={() => setSelectedBooking(null)}
                      className="w-full btn btn-secondary"
                    >
                      Lukk
                    </button>
                  </div>
                )
              }
            })()}
          </div>
        </div>
      )}

      {/* Edit Booking Modal */}
      {editingBooking && (
        <EditBookingModal
          booking={editingBooking}
          isAdmin={isAdmin}
          onClose={() => setEditingBooking(null)}
          onSaved={(updatedBooking) => {
            setBookings(bookings.map(b => 
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
          }}
        />
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
    </div>
  )
}

