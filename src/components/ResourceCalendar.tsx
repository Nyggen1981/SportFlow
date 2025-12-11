"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { ChevronLeft, ChevronRight, X, Calendar, Clock, User, Repeat, CheckCircle2, XCircle, Trash2, Pencil, Loader2 } from "lucide-react"
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
  resourcePartName?: string | null
  userId?: string | null
  userName?: string | null
  userEmail?: string | null
  isRecurring?: boolean
  parentBookingId?: string | null
}

interface Part {
  id: string
  name: string
}

interface Props {
  resourceId: string
  resourceName: string
  bookings: Booking[]
  parts: Part[]
}

export function ResourceCalendar({ resourceId, resourceName, bookings, parts }: Props) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "admin"
  const isLoggedIn = session?.user !== undefined
  
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedPart, setSelectedPart] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [applyToAll, setApplyToAll] = useState(true)
  const [rejectingBookingId, setRejectingBookingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const weekViewScrollRef = useRef<HTMLDivElement>(null)

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
  useEffect(() => {
    if (viewMode === "week" && weekViewScrollRef.current) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        if (weekViewScrollRef.current) {
          weekViewScrollRef.current.scrollTop = weekViewScrollRef.current.scrollHeight
        }
      }, 100)
    }
  }, [viewMode, currentDate, selectedPart])

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
        // Refresh the page to get updated bookings
        window.location.reload()
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
    <div>
      {/* Controls */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => viewMode === "week" 
                ? setCurrentDate(subWeeks(currentDate, 1))
                : setCurrentDate(subMonths(currentDate, 1))
              }
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="font-semibold text-gray-900 min-w-[200px] text-center">
              {viewMode === "week" 
                ? `${format(weekStart, "d. MMMM", { locale: nb })} - ${format(addDays(weekStart, 6), "d. MMMM yyyy", { locale: nb })}`
                : format(currentDate, "MMMM yyyy", { locale: nb })
              }
            </h3>
            <button
              onClick={() => viewMode === "week"
                ? setCurrentDate(addWeeks(currentDate, 1))
                : setCurrentDate(addMonths(currentDate, 1))
              }
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="ml-2 px-3 py-1.5 text-sm rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
            >
              I dag
            </button>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === "week" 
                  ? "bg-white text-gray-900 shadow-sm" 
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Uke
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === "month" 
                  ? "bg-white text-gray-900 shadow-sm" 
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Måned
            </button>
          </div>
        </div>

        {parts.length > 0 && (
          <select
            value={selectedPart || ""}
            onChange={(e) => setSelectedPart(e.target.value || null)}
            className="input max-w-[200px]"
          >
            <option value="">Alle deler</option>
            {parts.map(part => (
              <option key={part.id} value={part.name}>{part.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Week view */}
      {viewMode === "week" && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {/* Time grid with sticky header */}
          <div ref={weekViewScrollRef} className="max-h-[600px] overflow-y-auto pr-[17px]">
            {/* Header - sticky */}
            <div className="grid bg-gray-50 border-b border-gray-200 sticky top-0 z-10 gap-x-2" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
              <div className="p-3 text-center text-sm font-medium text-gray-500" />
              {weekDays.map((day) => (
                <div 
                  key={day.toISOString()} 
                  className={`p-3 text-center border-l border-gray-200 ${
                    isToday(day) ? 'bg-blue-50' : ''
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

            {/* Time slots */}
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
                  const bookingsStartingThisHour = allDayBookings.filter(booking => {
                    const start = parseISO(booking.startTime)
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
                          
                          const durationHours = (cappedEnd.getTime() - start.getTime()) / (1000 * 60 * 60)
                          const isPending = booking.status === "pending"
                          
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

                          return (
                            <div
                              key={booking.id}
                              onClick={() => setSelectedBooking(booking)}
                              className={`absolute rounded-md px-2 py-1 text-xs overflow-hidden pointer-events-auto cursor-pointer ${
                                isPending ? 'border-2 border-dashed' : ''
                              }`}
                              style={{
                                top: `${topPx}px`,
                                left: isSingleBox ? '2px' : `calc(${leftPercent}% + ${gapPxHorizontal / 2}px)`,
                                width: boxWidth,
                                height: `${Math.max(heightPx, 36)}px`,
                                backgroundColor: isPending ? '#dcfce7' : '#22c55e',
                                borderColor: isPending ? '#22c55e' : undefined,
                                color: isPending ? '#15803d' : 'white',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                zIndex: 10,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'flex-start',
                                alignItems: 'flex-start'
                              }}
                              title={`${booking.title}${booking.resourcePartName ? ` (${booking.resourcePartName})` : ''}${isPending ? ' (venter på godkjenning)' : ''}`}
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
      {viewMode === "month" && (
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
                      
                      return (
                        <div
                          key={booking.id}
                          onClick={() => setSelectedBooking(booking)}
                          className={`px-1.5 py-0.5 rounded text-xs truncate cursor-pointer ${
                            isPending 
                              ? "bg-green-50 text-green-700 border border-dashed border-green-400" 
                              : "bg-green-500 text-white"
                          }`}
                          title={`${booking.title} - ${format(parseISO(booking.startTime), "HH:mm")}${booking.resourcePartName ? ` (${booking.resourcePartName})` : ''}${isPending ? ' (venter)' : ''}`}
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
                {selectedBooking.userName && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="w-4 h-4 text-gray-400" />
                    {selectedBooking.userName}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {(() => {
              const isOwner = selectedBooking.userId === session?.user?.id
              const canCancel = isOwner && (selectedBooking.status === "pending" || selectedBooking.status === "approved")
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
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700">
                          Gjelder for alle gjentakende bookinger
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
                    
                    {canCancel && !isPast && (
                      <button
                        onClick={() => handleBookingAction(selectedBooking.id, "cancel")}
                        disabled={isProcessing}
                        className="w-full btn btn-secondary text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Kanseller
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedBooking(null)}
                      className="w-full btn btn-secondary"
                    >
                      Lukk
                    </button>
                  </div>
                )
              } else if (isLoggedIn) {
                return (
                  <div className="p-4 border-t bg-gray-50 rounded-b-xl space-y-3">
                    {canCancel && !isPast && (
                      <button
                        onClick={() => handleBookingAction(selectedBooking.id, "cancel")}
                        disabled={isProcessing}
                        className="w-full btn btn-secondary text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Kanseller
                      </button>
                    )}

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

