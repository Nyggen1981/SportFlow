"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { PageLayout } from "@/components/PageLayout"
import { format, parseISO, startOfDay, addDays, setHours } from "date-fns"
import { nb } from "date-fns/locale"
import { Calendar, ChevronLeft, ChevronRight, GanttChart, Filter, X, Clock, User, MapPin } from "lucide-react"

interface Booking {
  id: string
  title: string
  startTime: string
  endTime: string
  status: "approved" | "pending"
  resource: {
    id: string
    name: string
    color: string | null
    category: {
      id: string
      name: string
      color: string | null
    } | null
    parts: Array<{
      id: string
      name: string
    }>
  }
  resourcePart: {
    id: string
    name: string
    parentId?: string | null
  } | null
  user: {
    id: string
    name: string | null
    email: string
  }
}

interface Resource {
  id: string
  name: string
  color: string | null
  allowWholeBooking: boolean
  category: {
    id: string
    name: string
    color: string | null
  } | null
  parts: Array<{
    id: string
    name: string
    parentId?: string | null
    children?: Array<{ id: string; name: string }>
  }>
}

interface BlockedSlot {
  startTime: string
  endTime: string
  partId: string | null
  blockedBy: string
  bookingId: string
}

interface TimelineData {
  bookings: Booking[]
  resources: Resource[]
  date: string
}

export default function TimelinePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set())
  const [showFilter, setShowFilter] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const timelineContainerRef = useRef<HTMLDivElement>(null)
  const isInitialLoad = useRef(true)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/timeline")
    }
  }, [status, router])

  // Update current time every minute
  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date())
    const interval = setInterval(updateTime, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  const fetchTimelineData = useCallback(async () => {
    setIsLoading(true)
    try {
      const startDate = startOfDay(selectedDate)
      const endDate = new Date(startDate)
      endDate.setHours(23, 59, 59, 999)
      
      const startStr = format(startDate, "yyyy-MM-dd")
      const endStr = format(endDate, "yyyy-MM-dd")
      const response = await fetch(`/api/timeline?startDate=${startStr}&endDate=${endStr}`)
      if (response.ok) {
        const data = await response.json()
        setTimelineData(data)
      }
    } catch (error) {
      console.error("Failed to fetch timeline data:", error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    if (session) {
      fetchTimelineData()
    }
  }, [session, fetchTimelineData])

  // Initialize selected resources when data loads (select all by default)
  useEffect(() => {
    if (timelineData && timelineData.resources.length > 0) {
      const allResourceIds = new Set(timelineData.resources.map(r => r.id))
      
      if (isInitialLoad.current) {
        // First load: select all by default
        setSelectedResources(allResourceIds)
        isInitialLoad.current = false
      } else {
        // Check if any currently selected resources no longer exist in the data
        setSelectedResources(prev => {
          // If user explicitly removed all, keep it empty
          if (prev.size === 0) {
            return prev
          }
          // Check if any selected resources no longer exist
          const hasInvalidResources = Array.from(prev).some(id => !allResourceIds.has(id))
          if (hasInvalidResources) {
            // Some selected resources were removed from database, reset to all
            return allResourceIds
          }
          // Keep current selection
          return prev
        })
      }
    }
  }, [timelineData])

  // Generate time slots (00:00 to 23:00, hourly)
  const timeSlots = useMemo(() => {
    const slots = []
    for (let hour = 0; hour < 24; hour++) {
      slots.push(setHours(startOfDay(selectedDate), hour))
    }
    return slots
  }, [selectedDate])

  // Group resources with their parts and bookings (filtered by selected resources)
  const groupedData = useMemo(() => {
    if (!timelineData) return []

    const grouped: Array<{
      resource: Resource
      allBookings: Booking[]
      parts: Array<{
        part: { id: string; name: string } | null
        bookings: Booking[]
      }>
    }> = []

    timelineData.resources
      .filter(resource => selectedResources.has(resource.id))
      .forEach(resource => {
      // Get all bookings for this resource
      const resourceBookings = timelineData.bookings.filter(b => b.resource.id === resource.id)

      // Group bookings by part (null for whole resource)
      const partsMap = new Map<string | "whole", Booking[]>()
      
      // Initialize with all parts from resource
      resource.parts.forEach(part => {
        partsMap.set(part.id, [])
      })
      // Add whole resource option
      partsMap.set("whole", [])

      resourceBookings.forEach(booking => {
        const key = booking.resourcePart?.id || "whole"
        if (!partsMap.has(key)) {
          partsMap.set(key, [])
        }
        partsMap.get(key)!.push(booking)
      })

      // Convert to array format
      const parts: Array<{
        part: { id: string; name: string } | null
        bookings: Booking[]
      }> = []

      // Add whole resource row first (hoveddel) only if allowWholeBooking is true
      if (resource.allowWholeBooking) {
        parts.push({
          part: null,
          bookings: partsMap.get("whole") || []
        })
      }

      // Add part rows after (underdeler)
      resource.parts.forEach(part => {
        const bookings = partsMap.get(part.id) || []
        parts.push({
          part: { id: part.id, name: part.name },
          bookings
        })
      })

      if (parts.length > 0) {
        grouped.push({ resource, allBookings: resourceBookings, parts })
      }
    })

    return grouped
  }, [timelineData, selectedResources])

  // Group resources by category for filter
  const resourcesByCategory = useMemo(() => {
    if (!timelineData) return []
    
    const categoryMap = new Map<string, Resource[]>()
    
    timelineData.resources.forEach(resource => {
      const categoryId = resource.category?.id || "uncategorized"
      const categoryName = resource.category?.name || "Uten kategori"
      
      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, [])
      }
      categoryMap.get(categoryId)!.push(resource)
    })
    
    return Array.from(categoryMap.entries()).map(([categoryId, resources]) => ({
      id: categoryId,
      name: resources[0].category?.name || "Uten kategori",
      color: resources[0].category?.color || null,
      resources: resources.sort((a, b) => a.name.localeCompare(b.name))
    }))
  }, [timelineData])

  const toggleResource = useCallback((resourceId: string) => {
    setSelectedResources(prev => {
      const newSet = new Set(prev)
      if (newSet.has(resourceId)) {
        newSet.delete(resourceId)
      } else {
        newSet.add(resourceId)
      }
      return newSet
    })
  }, [])

  const selectAll = useCallback(() => {
    if (!timelineData) return
    const allResourceIds = new Set(timelineData.resources.map(r => r.id))
    setSelectedResources(allResourceIds)
  }, [timelineData])

  const deselectAll = useCallback(() => {
    setSelectedResources(new Set())
  }, [])

  // Memoize day boundaries
  const dayBoundaries = useMemo(() => {
    const dayStart = startOfDay(selectedDate)
    const dayEnd = addDays(dayStart, 1)
    const dayDuration = 24 * 60 * 60 * 1000
    return { dayStart, dayEnd, dayDuration }
  }, [selectedDate])

  // Calculate blocked slots for a specific resource
  const getBlockedSlotsForPart = useCallback((resourceId: string, partId: string | null, allBookings: Booking[], resource: Resource): BlockedSlot[] => {
    const slots: BlockedSlot[] = []
    const resourceBookings = allBookings.filter(b => b.resource.id === resourceId)
    
    resourceBookings.forEach(booking => {
      // If booking is for whole facility (no part), all parts are blocked
      if (!booking.resourcePart) {
        if (partId !== null) {
          // This part is blocked by whole facility booking
          slots.push({
            startTime: booking.startTime,
            endTime: booking.endTime,
            partId: partId,
            blockedBy: `Hele ${resource.name}`,
            bookingId: booking.id
          })
        }
      } else {
        // Booking is for a specific part
        if (partId === null) {
          // Whole facility is blocked by part booking
          slots.push({
            startTime: booking.startTime,
            endTime: booking.endTime,
            partId: null,
            blockedBy: booking.resourcePart.name,
            bookingId: booking.id
          })
        } else {
          // Check if this part is blocked by parent/child booking
          const bookedPart = resource.parts.find(p => p.id === booking.resourcePart?.id)
          
          // If booking is for a parent, this child is blocked
          if (bookedPart?.children?.some(c => c.id === partId)) {
            slots.push({
              startTime: booking.startTime,
              endTime: booking.endTime,
              partId: partId,
              blockedBy: bookedPart.name,
              bookingId: booking.id
            })
          }
          
          // If booking is for a child, parent is blocked
          if (booking.resourcePart.parentId === partId) {
            slots.push({
              startTime: booking.startTime,
              endTime: booking.endTime,
              partId: partId,
              blockedBy: booking.resourcePart.name,
              bookingId: booking.id
            })
          }
        }
      }
    })
    
    return slots
  }, [])

  // Get blocked slot style (similar to booking style)
  const getBlockedSlotStyle = useCallback((slot: BlockedSlot) => {
    const slotStart = parseISO(slot.startTime)
    const slotEnd = parseISO(slot.endTime)
    const { dayStart, dayEnd, dayDuration } = dayBoundaries

    // Clamp times to the day
    const startTime = slotStart < dayStart ? dayStart : slotStart
    const endTime = slotEnd > dayEnd ? dayEnd : slotEnd

    const startOffset = startTime.getTime() - dayStart.getTime()
    const duration = endTime.getTime() - startTime.getTime()

    const leftPercent = (startOffset / dayDuration) * 100
    const widthPercent = (duration / dayDuration) * 100

    return {
      left: `${leftPercent}%`,
      width: `${Math.max(0.3, widthPercent)}%`,
      minWidth: '20px'
    }
  }, [dayBoundaries])

  // Calculate booking position and width with horizontal spacing - memoized
  const getBookingStyle = useCallback((booking: Booking, allBookings: Booking[]) => {
    const bookingStart = parseISO(booking.startTime)
    const bookingEnd = parseISO(booking.endTime)
    const { dayStart, dayEnd, dayDuration } = dayBoundaries

    // Clamp booking times to the day
    const startTime = bookingStart < dayStart ? dayStart : bookingStart
    const endTime = bookingEnd > dayEnd ? dayEnd : bookingEnd

    const startOffset = startTime.getTime() - dayStart.getTime()
    const duration = endTime.getTime() - startTime.getTime()

    // Calculate base position
    const leftPercent = (startOffset / dayDuration) * 100
    const widthPercent = (duration / dayDuration) * 100

    // Add horizontal spacing between bookings
    // Sort other bookings by start time to find adjacent ones
    const sortedBookings = allBookings
      .filter(b => b.id !== booking.id)
      .map(b => ({
        booking: b,
        start: parseISO(b.startTime),
        end: parseISO(b.endTime)
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime())

    // Find the next booking that starts after this one ends
    const nextBooking = sortedBookings.find(b => {
      const gap = b.start.getTime() - endTime.getTime()
      return gap >= 0 && gap < 10 * 60 * 1000 // Within 10 minutes
    })

    // Add a small gap (0.2% of day ≈ 2-3 minutes) before next booking
    const gapPercent = nextBooking ? 0.2 : 0

    return {
      left: `${leftPercent}%`,
      width: `${Math.max(0.3, widthPercent - gapPercent)}%`,
      minWidth: '20px',
      marginRight: nextBooking ? `${gapPercent}%` : '0'
    }
  }, [dayBoundaries])

  const changeDate = useCallback((days: number) => {
    setSelectedDate(prev => addDays(prev, days))
  }, [])

  // Calculate current time position as percentage of day
  const currentTimePosition = useMemo(() => {
    const now = currentTime
    const todayStart = startOfDay(selectedDate)
    const isToday = format(now, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd")
    
    if (!isToday) return null
    
    const hours = now.getHours()
    const minutes = now.getMinutes()
    const totalMinutes = hours * 60 + minutes
    const dayMinutes = 24 * 60
    
    return (totalMinutes / dayMinutes) * 100
  }, [currentTime, selectedDate])

  const handleDatePickerClick = useCallback(() => {
    const input = document.getElementById('timeline-date-input') as HTMLInputElement
    if (input) {
      if ('showPicker' in input && typeof input.showPicker === 'function') {
        input.showPicker()
      } else {
        input.click()
      }
    }
  }, [])

  // Memoize formatted dates
  const formattedDate = useMemo(() => format(selectedDate, "d. MMM yyyy", { locale: nb }), [selectedDate])
  const dateInputValue = useMemo(() => format(selectedDate, "yyyy-MM-dd"), [selectedDate])

  if (status === "loading" || isLoading) {
    return (
      <PageLayout fullWidth>
        <div className="flex-1 flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout fullWidth>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <GanttChart className="w-5 h-5 sm:w-6 sm:h-6" />
                  Kapasitet
                </h1>
                
                {/* Filter Button */}
                <button
                  onClick={() => setShowFilter(!showFilter)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm ${
                    showFilter
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">Filter</span>
                  {selectedResources.size > 0 && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                      {selectedResources.size}
                    </span>
                  )}
                </button>
              </div>
              
              {/* Date Navigation */}
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                <button
                  onClick={() => changeDate(-1)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Forrige dag"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500 hidden sm:block" />
                  <div className="relative group">
                    <div className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 min-w-[120px] sm:min-w-[140px] cursor-pointer flex items-center justify-between"
                      onClick={handleDatePickerClick}
                    >
                      <span>{formattedDate}</span>
                      <Calendar className="w-4 h-4 text-gray-400" />
                    </div>
                    <input
                      id="timeline-date-input"
                      type="date"
                      lang="no"
                      value={dateInputValue}
                      onChange={(e) => setSelectedDate(new Date(e.target.value))}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
                
                <button
                  onClick={() => changeDate(1)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Neste dag"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                
                <button
                  onClick={() => setSelectedDate(new Date())}
                  className="px-3 sm:px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  I dag
                </button>
              </div>
            </div>
            
          </div>

          {/* Filter Panel - Compact */}
          {showFilter && (
            <div className="mb-4 bg-white rounded-lg border border-gray-200 shadow-sm p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {selectedResources.size} av {timelineData?.resources.length || 0} valgt
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={selectAll}
                    className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    Alle
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={deselectAll}
                    className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 rounded transition-colors"
                  >
                    Ingen
                  </button>
                </div>
              </div>
              
              {/* Compact Resource List */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {resourcesByCategory.map((category) => (
                  <div key={category.id} className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      {category.color && (
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: category.color }}
                        />
                      )}
                      <span className="text-xs font-medium text-gray-600">{category.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 ml-3.5">
                      {category.resources.map((resource) => (
                        <button
                          key={resource.id}
                          onClick={() => toggleResource(resource.id)}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            selectedResources.has(resource.id)
                              ? "bg-blue-100 text-blue-700 font-medium"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {resource.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline View (Day) */}
          {groupedData.length === 0 ? (
            <div className="card p-12 text-center">
              <GanttChart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Ingen bookinger for denne dagen</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              {/* Scrollable container with sticky header */}
              <div ref={timelineContainerRef} className="max-h-[calc(100vh-300px)] overflow-y-auto overflow-x-auto rounded-xl relative">
                {/* Time Header - sticky within scroll container */}
                <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200">
                  <div className="flex" style={{ minWidth: '1200px' }}>
                    <div className="w-48 sm:w-64 flex-shrink-0 p-2 sm:p-3 font-medium text-gray-700 text-xs sm:text-sm border-r border-gray-200 bg-gray-50">
                      <span className="hidden sm:inline">Fasilitet / Del</span>
                      <span className="sm:hidden">Fasilitet</span>
                    </div>
                    <div className="flex-1 flex">
                      {timeSlots.map((time, index) => (
                        <div
                          key={index}
                          className="border-r border-gray-200 last:border-r-0 p-1 sm:p-2 text-center bg-gray-50"
                          style={{ width: `${100 / 24}%` }}
                        >
                          <div className="text-[10px] sm:text-xs font-medium text-gray-600">
                            {format(time, "HH:mm")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Timeline Rows */}
                <div className="divide-y divide-gray-100" style={{ minWidth: '1200px' }}>
                    {groupedData.map(({ resource, allBookings, parts }) => (
                      <div key={resource.id}>
                        {/* Resource Header */}
                        <div className="bg-gray-50 border-b border-gray-200 relative">
                          <div className="flex">
                            <div className="w-48 sm:w-64 flex-shrink-0 p-2 sm:p-3 border-r border-gray-200">
                              <div className="font-semibold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                                {resource.category && (
                                  <div
                                    className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: resource.category.color || "#6b7280" }}
                                  />
                                )}
                                <span className="truncate">{resource.name}</span>
                              </div>
                              {resource.category && (
                                <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 truncate">
                                  {resource.category.name}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 relative">
                              {/* Current Time Indicator Line in Resource Header */}
                              {currentTimePosition !== null && (
                                <div 
                                  className="absolute top-0 bottom-0 z-25 pointer-events-none"
                                  style={{ 
                                    left: `${currentTimePosition}%`,
                                    width: '2px',
                                  }}
                                >
                                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-red-500" />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Part Rows */}
                        {parts.map(({ part, bookings }) => (
                          <div
                            key={part ? part.id : `whole-${resource.id}`}
                            className="flex border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          >
                            {/* Part Label */}
                            <div className="w-48 sm:w-64 flex-shrink-0 p-2 sm:p-3 border-r border-gray-200">
                              <div className="text-xs sm:text-sm text-gray-700">
                                {part ? (
                                  <span className="text-gray-600 truncate block">{part.name}</span>
                                ) : (
                                  <span className="font-medium text-gray-900">Hele fasiliteten</span>
                                )}
                              </div>
                            </div>

                            {/* Timeline Bar Area */}
                            <div className="flex-1 relative" style={{ minHeight: "60px" }}>
                              {/* Time Grid Lines - match header columns */}
                              {timeSlots.map((_, index) => (
                                <div
                                  key={index}
                                  className="absolute top-0 bottom-0 border-r border-gray-200"
                                  style={{ left: `${((index + 1) / 24) * 100}%` }}
                                />
                              ))}

                              {/* Current Time Indicator Line */}
                              {currentTimePosition !== null && (
                                <div 
                                  className="absolute top-0 bottom-0 z-25 pointer-events-none"
                                  style={{ 
                                    left: `${currentTimePosition}%`,
                                    width: '2px',
                                  }}
                                >
                                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-red-500" />
                                </div>
                              )}

                              {/* Blocked Slots */}
                              {getBlockedSlotsForPart(resource.id, part?.id || null, allBookings, resource).map((slot, index) => {
                                const style = getBlockedSlotStyle(slot)
                                return (
                                  <div
                                    key={`blocked-${slot.bookingId}-${index}`}
                                    className="absolute top-1 bottom-1 rounded px-1 text-xs overflow-hidden"
                                    style={{
                                      ...style,
                                      backgroundColor: 'rgba(156, 163, 175, 0.3)',
                                      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(156, 163, 175, 0.2) 4px, rgba(156, 163, 175, 0.2) 8px)',
                                      border: '1px dashed #9ca3af',
                                      zIndex: 5,
                                    }}
                                    title={`Blokkert av: ${slot.blockedBy}`}
                                  >
                                    <div className="flex items-center gap-1 h-full text-gray-500">
                                      <span>🔒</span>
                                      <span className="truncate text-[10px] font-medium">Blokkert</span>
                                    </div>
                                  </div>
                                )
                              })}

                              {/* Bookings */}
                              {bookings.map((booking) => {
                                const style = getBookingStyle(booking, bookings)
                                const isPending = booking.status === "pending"
                                const color = resource.color || resource.category?.color || "#3b82f6"
                                const startTime = parseISO(booking.startTime)
                                const endTime = parseISO(booking.endTime)
                                const timeStr = `${format(startTime, "HH:mm")} - ${format(endTime, "HH:mm")}`
                                
                                return (
                                  <button
                                    key={booking.id}
                                    onClick={() => setSelectedBooking(booking)}
                                    className="absolute top-1 bottom-1 rounded px-2 py-1 text-white text-xs font-medium cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all overflow-hidden text-left"
                                    style={{
                                      ...style,
                                      backgroundColor: isPending ? `${color}80` : color,
                                      border: isPending ? `2px dashed ${color}` : 'none',
                                    }}
                                    title={`Klikk for mer info`}
                                  >
                                    <div className="truncate font-semibold">{booking.title}</div>
                                    <div className="truncate text-[10px] opacity-90">
                                      {timeStr}
                                    </div>
                                    {booking.user.name && (
                                      <div className="truncate text-[10px] opacity-75">
                                        {booking.user.name}
                                      </div>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
          )}
        </div>

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedBooking(null)}
        >
          <div 
            className="bg-white rounded-xl max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div 
              className="p-5 rounded-t-xl"
              style={{ 
                backgroundColor: selectedBooking.resource.color || selectedBooking.resource.category?.color || "#3b82f6" 
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white/80 text-sm font-medium">
                    {selectedBooking.resource.name}
                    {selectedBooking.resourcePart && ` • ${selectedBooking.resourcePart.name}`}
                  </p>
                  <h3 className="text-xl font-bold text-white mt-1">
                    {selectedBooking.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="p-1 rounded-full hover:bg-white/20 transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                  selectedBooking.status === "pending" 
                    ? "bg-amber-100 text-amber-700" 
                    : "bg-green-100 text-green-700"
                }`}>
                  {selectedBooking.status === "pending" ? "⏳ Venter på godkjenning" : "✓ Godkjent"}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-3 text-sm">
                {/* Date and time */}
                <div className="flex items-start gap-3 text-gray-600">
                  <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">
                      {format(parseISO(selectedBooking.startTime), "EEEE d. MMMM yyyy", { locale: nb })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-gray-600">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>
                    {format(parseISO(selectedBooking.startTime), "HH:mm")} - {format(parseISO(selectedBooking.endTime), "HH:mm")}
                  </span>
                </div>

                {/* Location */}
                <div className="flex items-start gap-3 text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">{selectedBooking.resource.name}</p>
                    {selectedBooking.resourcePart && (
                      <p className="text-gray-500">{selectedBooking.resourcePart.name}</p>
                    )}
                    {selectedBooking.resource.category && (
                      <p className="text-gray-400 text-xs mt-0.5">{selectedBooking.resource.category.name}</p>
                    )}
                  </div>
                </div>

                {/* GDPR: Show user info to admins/moderators OR if it's your own booking */}
                {((session?.user?.role === "admin" || session?.user?.role === "moderator") || selectedBooking.user?.id === session?.user?.id) && selectedBooking.user && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <User className="w-4 h-4 text-gray-400" />
                    <p className="font-medium text-gray-900">{selectedBooking.user.name || "Ukjent bruker"}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setSelectedBooking(null)}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Lukk
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}

