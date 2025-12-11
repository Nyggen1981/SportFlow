"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import { format, parseISO, startOfDay, addDays, setHours } from "date-fns"
import { nb } from "date-fns/locale"
import { Calendar, ChevronLeft, ChevronRight, GanttChart, Filter } from "lucide-react"

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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/timeline")
    }
  }, [status, router])

  const fetchTimelineData = useCallback(async () => {
    setIsLoading(true)
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd")
      const response = await fetch(`/api/timeline?date=${dateStr}`)
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
      // Only initialize if no resources are selected yet, or if selected resources don't match available resources
      const hasValidSelection = selectedResources.size > 0 && 
        Array.from(selectedResources).every(id => allResourceIds.has(id))
      
      if (!hasValidSelection) {
        setSelectedResources(allResourceIds)
      }
    }
  }, [timelineData, selectedResources])

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

      // Add whole resource row if there are bookings or if no parts exist
      if (partsMap.get("whole")!.length > 0 || resource.parts.length === 0) {
        parts.push({
          part: null,
          bookings: partsMap.get("whole") || []
        })
      }

      // Add part rows
      resource.parts.forEach(part => {
        const bookings = partsMap.get(part.id) || []
        parts.push({
          part: { id: part.id, name: part.name },
          bookings
        })
      })

      if (parts.length > 0) {
        grouped.push({ resource, parts })
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

  // Calculate booking position and width - memoized
  const getBookingStyle = useCallback((booking: Booking) => {
    const bookingStart = parseISO(booking.startTime)
    const bookingEnd = parseISO(booking.endTime)
    const { dayStart, dayEnd, dayDuration } = dayBoundaries

    // Clamp booking times to the day
    const startTime = bookingStart < dayStart ? dayStart : bookingStart
    const endTime = bookingEnd > dayEnd ? dayEnd : bookingEnd

    const startOffset = startTime.getTime() - dayStart.getTime()
    const duration = endTime.getTime() - startTime.getTime()

    const leftPercent = (startOffset / dayDuration) * 100
    const widthPercent = (duration / dayDuration) * 100

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
      minWidth: '20px'
    }
  }, [dayBoundaries])

  const changeDate = useCallback((days: number) => {
    setSelectedDate(prev => addDays(prev, days))
  }, [])

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
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <GanttChart className="w-5 h-5 sm:w-6 sm:h-6" />
                  Tidslinje
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

          {/* Timeline */}
          {groupedData.length === 0 ? (
            <div className="card p-12 text-center">
              <GanttChart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Ingen bookinger for denne dagen</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Time Header - sticky */}
              <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200">
                <div className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  <div className="flex min-w-[800px]">
                    <div className="w-48 sm:w-64 flex-shrink-0 p-2 sm:p-3 font-medium text-gray-700 text-xs sm:text-sm border-r border-gray-200">
                      <span className="hidden sm:inline">Fasilitet / Del</span>
                      <span className="sm:hidden">Fasilitet</span>
                    </div>
                    <div className="flex-1 flex min-w-0">
                      {timeSlots.map((time, index) => (
                        <div
                          key={index}
                          className="flex-1 border-r border-gray-200 last:border-r-0 p-1 sm:p-2 text-center min-w-0"
                        >
                          <div className="text-[10px] sm:text-xs font-medium text-gray-600 truncate">
                            {format(time, "HH:mm")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline Rows */}
              <div className="overflow-x-auto">
                <div className="min-w-[800px] divide-y divide-gray-100">
                    {groupedData.map(({ resource, parts }) => (
                      <div key={resource.id}>
                        {/* Resource Header */}
                        <div className="bg-gray-50 border-b border-gray-200">
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
                            <div className="flex-1"></div>
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
                              {/* Time Grid Lines */}
                              {timeSlots.map((_, index) => (
                                <div
                                  key={index}
                                  className="absolute top-0 bottom-0 border-r border-gray-200"
                                  style={{ left: `${(index / 24) * 100}%` }}
                                />
                              ))}

                              {/* Bookings */}
                              {bookings.map((booking) => {
                                const style = getBookingStyle(booking)
                                const isPending = booking.status === "pending"
                                const color = resource.color || resource.category?.color || "#3b82f6"
                                const startTime = parseISO(booking.startTime)
                                const endTime = parseISO(booking.endTime)
                                const timeStr = `${format(startTime, "HH:mm")} - ${format(endTime, "HH:mm")}`
                                
                                return (
                                  <div
                                    key={booking.id}
                                    className="absolute top-1 bottom-1 rounded px-2 py-1 text-white text-xs font-medium cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                                    style={{
                                      ...style,
                                      backgroundColor: isPending ? `${color}80` : color,
                                      border: isPending ? `2px dashed ${color}` : 'none',
                                    }}
                                    title={`${booking.title}\n${timeStr}\n${booking.user.name || booking.user.email}\n${isPending ? "Venter på godkjenning" : "Godkjent"}`}
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
                                  </div>
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
      </main>

      <Footer />
    </div>
  )
}

