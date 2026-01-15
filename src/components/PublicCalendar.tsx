"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { ChevronLeft, ChevronRight, List, Grid3X3, Calendar, Clock, MapPin, X } from "lucide-react"
import { 
  format, 
  startOfWeek, 
  startOfMonth,
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
  parentId?: string | null
  children?: { id: string; name: string }[]
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
  resourceId: string
  resourceName: string
  resourcePartId?: string | null
  resourcePartName?: string | null
}

interface BlockedSlot {
  startTime: string
  endTime: string
  partId: string | null
  blockedBy: string
  bookingId: string
}

interface Props {
  categories: Category[]
  resources: Resource[]
  bookings: Booking[]
}

type ViewMode = "week" | "month"

export function PublicCalendar({ categories, resources, bookings }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [helpDismissed, setHelpDismissed] = useState(true)
  const weekViewScrollRef = useRef<HTMLDivElement>(null)

  // Sjekk om hjelpetext er dismisset
  useEffect(() => {
    const dismissed = localStorage.getItem("calendar-help-dismissed")
    setHelpDismissed(dismissed === "true")
  }, [])

  const dismissHelp = () => {
    localStorage.setItem("calendar-help-dismissed", "true")
    setHelpDismissed(true)
  }

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

  // Calculate blocked slots based on hierarchy for the selected resource
  const blockedSlots = useMemo(() => {
    if (!selectedResourceId || !selectedResource) return []
    
    const slots: BlockedSlot[] = []
    const resourceBookings = bookings.filter(b => b.resourceId === selectedResourceId)
    
    resourceBookings.forEach(booking => {
      // If booking is for whole facility (no part), all parts are blocked
      if (!booking.resourcePartId) {
        selectedResource.parts.forEach(part => {
          slots.push({
            startTime: booking.startTime,
            endTime: booking.endTime,
            partId: part.id,
            blockedBy: `Hele ${selectedResource.name}`,
            bookingId: booking.id
          })
          // Also block children
          if (part.children) {
            part.children.forEach(child => {
              slots.push({
                startTime: booking.startTime,
                endTime: booking.endTime,
                partId: child.id,
                blockedBy: `Hele ${selectedResource.name}`,
                bookingId: booking.id
              })
            })
          }
        })
      } else {
        // Booking is for a specific part - block whole facility
        slots.push({
          startTime: booking.startTime,
          endTime: booking.endTime,
          partId: null,
          blockedBy: booking.resourcePartName || "En del",
          bookingId: booking.id
        })
        
        // Find the booked part and check hierarchy
        const bookedPart = selectedResource.parts.find(p => p.id === booking.resourcePartId)
        
        // If booking is for a parent, block children
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
        
        // If booking is for a child, block parent
        if (bookedPart?.parentId) {
          slots.push({
            startTime: booking.startTime,
            endTime: booking.endTime,
            partId: bookedPart.parentId,
            blockedBy: booking.resourcePartName || "En del",
            bookingId: booking.id
          })
        }
      }
    })
    
    return slots
  }, [bookings, selectedResourceId, selectedResource])

  // Get blocked slots for the selected part view
  const getBlockedSlotsForDay = useCallback((day: Date) => {
    // Don't show blocked slots when viewing "Alle deler" - actual bookings show the full picture
    if (!selectedPartId) return []
    
    return blockedSlots.filter(slot => {
      const start = parseISO(slot.startTime)
      if (!isSameDay(day, start)) return false
      
      // If viewing a specific part, show blocks for that part
      return slot.partId === selectedPartId
    })
  }, [blockedSlots, selectedPartId])

  const handleCategoryChange = useCallback((categoryId: string) => {
    setSelectedCategoryId(categoryId)
    setSelectedResourceId(null) // Reset resource when category changes
    setSelectedPartId(null) // Reset part when category changes
  }, [])

  const handleResourceChange = useCallback((resourceId: string) => {
    setSelectedResourceId(resourceId)
    setSelectedPartId(null) // Reset part selection when resource changes
  }, [])

  // Week view data
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const hours = Array.from({ length: 18 }, (_, i) => i + 6) // 06:00 - 23:00

  // Month view data
  const monthStart = startOfMonth(currentDate)
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

  const navigate = (direction: "prev" | "next") => {
    if (viewMode === "week") {
      setCurrentDate(direction === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1))
    } else {
      setCurrentDate(direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1))
    }
  }

  // Scroll to bottom of week view on mount and when viewMode changes
  useEffect(() => {
    if (viewMode === "week" && weekViewScrollRef.current) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        if (weekViewScrollRef.current) {
          weekViewScrollRef.current.scrollTop = weekViewScrollRef.current.scrollHeight
        }
      }, 100)
    }
  }, [viewMode, selectedCategoryId, selectedResourceId, selectedPartId])

  return (
    <div className="space-y-4">
      {/* Help text */}
      {!helpDismissed && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 relative">
          <button
            onClick={dismissHelp}
            className="absolute top-2 right-2 p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
            aria-label="Lukk"
            title="Lukk"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="pr-10">
            <p className="font-medium mb-1">Slik finner du frem i kalenderen:</p>
            <p className="text-blue-700">Velg først en kategori, deretter en fasilitet. Hvis fasiliteten har underdeler, kan du velge en spesifikk del eller se alle deler.</p>
            <p className="text-blue-700 mt-2"><strong>Vil du booke?</strong> Registrer deg eller logg inn for å reservere fasiliteter.</p>
          </div>
        </div>
      )}

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
              <h2 className="font-semibold text-gray-900 min-w-[140px] sm:min-w-[200px] text-center text-sm sm:text-base">
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
          </div>
        </div>

      </div>

      {/* Week View */}
      {viewMode === "week" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Time grid with sticky header */}
          <div ref={weekViewScrollRef} className="max-h-[650px] overflow-y-auto pr-[17px]">
            {/* Header - sticky */}
            <div className="grid bg-gray-50 border-b border-gray-200 sticky top-0 z-10" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
              <div className="p-3 text-center text-sm font-medium text-gray-500" />
              {weekDays.map((day) => (
                <div 
                  key={day.toISOString()} 
                  className={`p-3 text-center border-l border-gray-200 ${
                    isToday(day) ? 'bg-blue-50' : 'bg-gray-50'
                  }`}
                >
                  <p className="text-xs text-gray-500 uppercase font-medium">
                    {format(day, "EEE", { locale: nb })}
                  </p>
                  <p className={`text-xl font-bold ${
                    isToday(day) ? 'text-blue-600' : 'text-gray-900'
                  }`}>
                    {format(day, "d")}
                  </p>
                </div>
              ))}
            </div>

            {/* Time rows */}
            {hours.map((hour) => (
              <div key={hour} className="grid border-b border-gray-100 last:border-b-0" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
                <div className="p-2 text-right text-xs text-gray-400 pr-3 font-medium">
                  {hour.toString().padStart(2, "0")}:00
                </div>
                {weekDays.map((day) => {
                  const dayBookings = getBookingsForDay(day).filter(b => {
                    const start = parseISO(b.startTime)
                    const end = parseISO(b.endTime)
                    const startHour = start.getHours()
                    const endHour = end.getHours() + (end.getMinutes() > 0 ? 1 : 0)
                    return hour >= startHour && hour < endHour
                  })
                  
                  const bookingsStartingThisHour = dayBookings.filter(b => {
                    const start = parseISO(b.startTime)
                    return start.getHours() === hour
                  })
                  
                  // Group overlapping bookings
                  const bookingGroups: Booking[][] = []
                  bookingsStartingThisHour.forEach(booking => {
                    const bookingStart = parseISO(booking.startTime)
                    const bookingEnd = parseISO(booking.endTime)
                    
                    // Find a group this booking overlaps with
                    let addedToGroup = false
                    for (const group of bookingGroups) {
                      const overlaps = group.some(b => {
                        const bStart = parseISO(b.startTime)
                        const bEnd = parseISO(b.endTime)
                        return (bookingStart < bEnd && bookingEnd > bStart)
                      })
                      
                      if (overlaps) {
                        group.push(booking)
                        addedToGroup = true
                        break
                      }
                    }
                    
                    // If no overlap found, create new group
                    if (!addedToGroup) {
                      bookingGroups.push([booking])
                    }
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
                      
                      {bookingGroups.flatMap((group) =>
                        group.map((booking, index) => {
                          const start = parseISO(booking.startTime)
                          const end = parseISO(booking.endTime)
                          const bookingStart = start
                          const bookingEnd = end
                          const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
                          const resourceColor = getResourceColor(booking.resourceId)

                          // Add minimal gap between bookings vertically
                          const gapPx = 1
                          const cellHeight = 48 // min-h-[48px]
                          const topPx = (start.getMinutes() / 60) * cellHeight + gapPx
                          const heightPx = duration * cellHeight - (gapPx * 2)
                          
                          // Calculate width and position for overlapping bookings
                          const groupSize = group.length
                          // Only add gap if bookings actually overlap (not just same start time)
                          const hasOverlap = group.some((b, i) => {
                            if (i === index) return false
                            const bStart = parseISO(b.startTime)
                            const bEnd = parseISO(b.endTime)
                            return (bookingStart < bEnd && bookingEnd > bStart && 
                                    (bookingStart.getTime() !== bStart.getTime() || bookingEnd.getTime() !== bEnd.getTime()))
                          })
                          const gapBetweenPx = hasOverlap ? 3 : 0 // More gap horizontally (3px) vs vertical (1px)
                          const bookingWidthPercent = 100 / groupSize
                          const marginRight = index < groupSize - 1 ? gapBetweenPx : 0
                          const isSingleBox = groupSize === 1
                          // Horizontal padding for spacing between boxes and column edges
                          const horizontalPadding = 4 // 2px on each side
                          // No margin from column lines - boxes fill the column with small padding
                          const boxWidth = isSingleBox 
                            ? `calc(100% - ${horizontalPadding}px)` 
                            : (marginRight > 0 
                              ? `calc(${bookingWidthPercent}% - ${marginRight + horizontalPadding}px)` 
                              : `calc(${bookingWidthPercent}% - ${horizontalPadding}px)`)

                          return (
                            <button
                              key={booking.id}
                              onClick={() => setSelectedBooking(booking)}
                              className="absolute rounded px-1.5 py-1 text-xs overflow-hidden cursor-pointer z-10 pointer-events-auto text-left booking-event"
                              style={{
                                top: `${topPx}px`,
                                left: isSingleBox ? '2px' : `calc(${index * bookingWidthPercent}% + 2px)`,
                                width: boxWidth,
                                height: `${Math.max(heightPx, 36)}px`,
                                backgroundColor: resourceColor,
                                color: 'white',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'flex-start',
                                alignItems: 'flex-start',
                              }}
                            >
                              <p className="font-semibold truncate text-[11px]">{booking.title}</p>
                              <p className="truncate text-[9px] opacity-80">
                                {format(start, "HH:mm")}-{format(end, "HH:mm")}
                              </p>
                            </button>
                          )
                        })
                      )}
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
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Header */}
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
            {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((day) => (
              <div key={day} className="p-2 text-center text-xs font-semibold text-gray-600 uppercase">
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
                  className={`min-h-[90px] p-1.5 border-b border-r border-gray-100 ${
                    !isCurrentMonth ? 'bg-gray-50/50' : ''
                  } ${isToday(day) ? 'bg-blue-50' : ''} ${
                    i % 7 === 0 ? 'border-l-0' : ''
                  }`}
                >
                  <p className={`text-xs font-semibold mb-1 ${
                    !isCurrentMonth ? 'text-gray-400' : 
                    isToday(day) ? 'text-blue-600' : 'text-gray-900'
                  }`}>
                    {format(day, "d")}
                  </p>
                  <div className="space-y-0.5">
                    {dayBookings.slice(0, 2).map((booking) => {
                      const resourceColor = getResourceColor(booking.resourceId)
                      
                      return (
                        <button
                          key={booking.id}
                          onClick={() => setSelectedBooking(booking)}
                          className="w-full text-[10px] px-1 py-0.5 rounded truncate text-left booking-event"
                          style={{
                            backgroundColor: resourceColor,
                            color: 'white'
                          }}
                        >
                          {format(parseISO(booking.startTime), "HH:mm")} {booking.title}
                        </button>
                      )
                    })}
                    {dayBookings.length > 2 && (
                      <p className="text-[10px] text-gray-500 px-1 font-medium">
                        +{dayBookings.length - 2} til
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}


      {/* Booking detail modal */}
      {selectedBooking && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedBooking(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div 
              className="p-6 rounded-t-2xl"
              style={{ backgroundColor: getResourceColor(selectedBooking.resourceId) }}
            >
              <p className="text-white/80 text-sm font-medium">
                {selectedBooking.resourceName}
                {selectedBooking.resourcePartName && ` • ${selectedBooking.resourcePartName}`}
              </p>
              <h3 className="text-2xl font-bold text-white mt-1">
                {selectedBooking.title}
              </h3>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-gray-600">
                <Calendar className="w-5 h-5 text-gray-400" />
                <span>
                  {format(parseISO(selectedBooking.startTime), "EEEE d. MMMM yyyy", { locale: nb })}
                </span>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <Clock className="w-5 h-5 text-gray-400" />
                <span>
                  {format(parseISO(selectedBooking.startTime), "HH:mm")} - {format(parseISO(selectedBooking.endTime), "HH:mm")}
                </span>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <MapPin className="w-5 h-5 text-gray-400" />
                <span>
                  {selectedBooking.resourceName}
                  {selectedBooking.resourcePartName && ` (${selectedBooking.resourcePartName})`}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6">
              <button
                onClick={() => setSelectedBooking(null)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Lukk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
