"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import { format, parseISO, startOfDay, addDays, setHours, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameWeek, isSameMonth, addWeeks, subWeeks, addMonths, subMonths, isToday, getWeek } from "date-fns"
import { nb } from "date-fns/locale"
import { Calendar, ChevronLeft, ChevronRight, GanttChart, Filter, X, Clock, User, MapPin, CheckCircle2, XCircle, Trash2, Loader2, Repeat, Pencil, Star } from "lucide-react"
import { EditBookingModal } from "@/components/EditBookingModal"

interface Booking {
  id: string
  title: string
  startTime: string
  endTime: string
  status: "approved" | "pending"
  userId: string
  isRecurring?: boolean
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
  category: {
    id: string
    name: string
    color: string | null
    isActive?: boolean
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

export default function CalendarPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day")
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [applyToAll, setApplyToAll] = useState(false)
  const [rejectingBookingId, setRejectingBookingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [datePickerMonth, setDatePickerMonth] = useState(new Date())
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  // User roles
  const isAdmin = session?.user?.role === "admin"
  const isModerator = session?.user?.role === "moderator"
  const canManageBookings = isAdmin || isModerator
  const isLoggedIn = session?.user !== undefined
  const timelineContainerRef = useRef<HTMLDivElement>(null)
  const dayViewScrollRef = useRef<HTMLDivElement>(null)
  const weekViewScrollRef = useRef<HTMLDivElement>(null)
  const datePickerRef = useRef<HTMLDivElement>(null)

  // Allow public access - no redirect to login

  // Update current time every minute
  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date())
    const interval = setInterval(updateTime, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  const fetchTimelineData = useCallback(async () => {
    setIsLoading(true)
    try {
      let startDate: Date
      let endDate: Date
      
      if (viewMode === "day") {
        startDate = startOfDay(selectedDate)
        endDate = new Date(startDate)
        endDate.setHours(23, 59, 59, 999)
      } else if (viewMode === "week") {
        startDate = startOfWeek(selectedDate, { weekStartsOn: 1, locale: nb })
        endDate = endOfWeek(selectedDate, { weekStartsOn: 1, locale: nb })
      } else { // month
        startDate = startOfMonth(selectedDate)
        endDate = endOfMonth(selectedDate)
      }
      
      const startStr = format(startDate, "yyyy-MM-dd")
      const endStr = format(endDate, "yyyy-MM-dd")
      // Use public API if not logged in, otherwise use authenticated API
      const apiEndpoint = isLoggedIn 
        ? `/api/timeline?startDate=${startStr}&endDate=${endStr}`
        : `/api/timeline/public?startDate=${startStr}&endDate=${endStr}`
      const response = await fetch(apiEndpoint)
      if (response.ok) {
        const data = await response.json()
        setTimelineData(data)
      }
    } catch (error) {
      console.error("Failed to fetch timeline data:", error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedDate, viewMode, isLoggedIn])

  useEffect(() => {
    fetchTimelineData()
  }, [fetchTimelineData])

  // Load user preferences on mount
  useEffect(() => {
    if (isLoggedIn && !preferencesLoaded && timelineData) {
      fetch("/api/user/preferences")
        .then(res => res.json())
        .then(prefs => {
          // Load calendar preferences
          // Use defaultCalendarView for viewMode (day/week/month)
          if (prefs.defaultCalendarView && ["day", "week", "month"].includes(prefs.defaultCalendarView)) {
            setViewMode(prefs.defaultCalendarView as "day" | "week" | "month")
          }
          if (prefs.selectedCategoryIds && prefs.selectedCategoryIds.length > 0) {
            setSelectedCategoryId(prefs.selectedCategoryIds[0])
          }
          if (prefs.selectedResourceIds && prefs.selectedResourceIds.length > 0) {
            setSelectedResourceId(prefs.selectedResourceIds[0])
          }
          setPreferencesLoaded(true)
        })
        .catch(err => {
          console.error("Failed to load preferences:", err)
          setPreferencesLoaded(true)
        })
    } else if (!isLoggedIn) {
      setPreferencesLoaded(true)
    }
  }, [isLoggedIn, preferencesLoaded, timelineData])

  // Save preferences
  const savePreferences = useCallback(async () => {
    if (!isLoggedIn) return

    setSavingPreferences(true)
    try {
      const preferencesToSave: any = {
        defaultCalendarView: viewMode,
        selectedCategoryIds: selectedCategoryId ? [selectedCategoryId] : [],
        selectedResourceIds: selectedResourceId ? [selectedResourceId] : []
      }
      
      await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferencesToSave)
      })
      setShowSaveSuccess(true)
      setTimeout(() => setShowSaveSuccess(false), 2000)
    } catch (error) {
      console.error("Failed to save preferences:", error)
    } finally {
      setSavingPreferences(false)
    }
  }, [isLoggedIn, viewMode, selectedCategoryId, selectedResourceId])

  const handleBookingAction = useCallback(async (bookingId: string, action: "approve" | "reject" | "cancel", statusNote?: string) => {
    setIsProcessing(true)
    const booking = timelineData?.bookings.find(b => b.id === bookingId)
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
        // Refresh the timeline data
        await fetchTimelineData()
        setSelectedBooking(null)
        setRejectingBookingId(null)
        setRejectReason("")
      } else {
        const error = await response.json()
        alert(error.error || "En feil oppstod")
      }
    } catch (error) {
      console.error("Failed to handle booking action:", error)
      alert("En feil oppstod")
    } finally {
      setIsProcessing(false)
    }
  }, [applyToAll, timelineData, fetchTimelineData])

  // Scroll to bottom when day or week view loads (most activity is in the afternoon/evening)
  useEffect(() => {
    if (viewMode === "day" && dayViewScrollRef.current && timelineData) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        if (dayViewScrollRef.current) {
          dayViewScrollRef.current.scrollTop = dayViewScrollRef.current.scrollHeight
        }
      }, 100)
    } else if (viewMode === "week" && weekViewScrollRef.current && timelineData) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        if (weekViewScrollRef.current) {
          weekViewScrollRef.current.scrollTop = weekViewScrollRef.current.scrollHeight
        }
      }, 100)
    }
  }, [viewMode, selectedDate, timelineData])

  // Generate time slots (00:00 to 23:00, hourly)
  const timeSlots = useMemo(() => {
    const slots = []
    for (let hour = 0; hour < 24; hour++) {
      slots.push(setHours(startOfDay(selectedDate), hour))
    }
    return slots
  }, [selectedDate])


  // Filter resources by selected category - show all if no category selected
  const availableResources = useMemo(() => {
    if (!timelineData) return []
    if (!selectedCategoryId) return timelineData.resources // Show all resources when no category selected
    return timelineData.resources.filter(r => r.category?.id === selectedCategoryId)
  }, [timelineData, selectedCategoryId])

  // Find selected resource from all resources, not just availableResources
  const selectedResource = useMemo(() => {
    if (!timelineData || !selectedResourceId) return null
    return timelineData.resources.find(r => r.id === selectedResourceId) || null
  }, [timelineData, selectedResourceId])

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

  // Get all active categories
  const categories = useMemo(() => {
    if (!timelineData) return []
    const categorySet = new Map<string, { id: string; name: string; color: string | null }>()
    timelineData.resources.forEach(resource => {
      // Only include active categories in the dropdown
      if (resource.category && resource.category.isActive !== false) {
        categorySet.set(resource.category.id, {
          id: resource.category.id,
          name: resource.category.name,
          color: resource.category.color
        })
      }
    })
    return Array.from(categorySet.values())
  }, [timelineData])

  const handleCategoryChange = useCallback((categoryId: string) => {
    setSelectedCategoryId(categoryId || null)
    setSelectedResourceId(null) // Reset resource when category changes
    setSelectedPartId(null) // Reset part when category changes
  }, [])

  const handleResourceChange = useCallback((resourceId: string) => {
    setSelectedResourceId(resourceId || null)
    setSelectedPartId(null) // Reset part selection when resource changes
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

  // Calculate overlap columns for bookings in a day (for calendar view)
  const getBookingColumns = useCallback((dayBookings: Booking[]) => {
    if (dayBookings.length === 0) return new Map<string, { column: number; totalColumns: number }>()
    
    const sorted = [...dayBookings].sort((a, b) => 
      parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime()
    )
    
    const columns = new Map<string, { column: number; totalColumns: number }>()
    const columnEndTimes: Date[] = []
    
    sorted.forEach(booking => {
      const start = parseISO(booking.startTime)
      const end = parseISO(booking.endTime)
      
      let column = 0
      while (column < columnEndTimes.length && columnEndTimes[column] > start) {
        column++
      }
      
      columnEndTimes[column] = end
      columns.set(booking.id, { column, totalColumns: 1 })
    })
    
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

  // Get filtered bookings for calendar view
  // Show all when no filter, filter by category when category selected, then resource, then part
  const filteredBookingsForCalendar = useMemo(() => {
    if (!timelineData) return []
    
    return timelineData.bookings.filter(b => {
      // If a specific part is selected, only show bookings for that part
      if (selectedPartId && selectedResource) {
        const selectedPart = selectedResource.parts.find(p => p.id === selectedPartId)
        if (!selectedPart) return false
        return b.resourcePart?.name === selectedPart.name
      }
      
      // If a specific resource is selected, show all bookings for that resource
      if (selectedResourceId) {
        return b.resource.id === selectedResourceId
      }
      
      // If a category is selected, show all bookings for resources in that category
      if (selectedCategoryId) {
        return b.resource.category?.id === selectedCategoryId
      }
      
      // If no filter is set, show all bookings
      return true
    })
  }, [timelineData, selectedCategoryId, selectedResourceId, selectedPartId, selectedResource])

  // Get days for current view
  const viewDays = useMemo(() => {
    if (viewMode === "day") {
      return [selectedDate]
    } else if (viewMode === "week") {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1, locale: nb })
      return eachDayOfInterval({ start: weekStart, end: endOfWeek(selectedDate, { weekStartsOn: 1, locale: nb }) })
    } else { // month - calendar grid
      const monthStart = startOfMonth(selectedDate)
      const monthEnd = endOfMonth(selectedDate)
      const monthStartWeek = startOfWeek(monthStart, { weekStartsOn: 1, locale: nb })
      const days = []
      let day = monthStartWeek
      while (day <= monthEnd || days.length % 7 !== 0) {
        days.push(day)
        day = addDays(day, 1)
      }
      return days
    }
  }, [selectedDate, viewMode])

  // Get bookings for a specific day
  const getBookingsForDay = useCallback((day: Date) => {
    if (!timelineData) return []
    return filteredBookingsForCalendar.filter(booking => {
      const bookingStart = parseISO(booking.startTime)
      return isSameDay(bookingStart, day)
    })
  }, [timelineData, filteredBookingsForCalendar])


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
    setDatePickerMonth(selectedDate)
    setShowDatePicker(true)
  }, [selectedDate])

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false)
      }
    }

    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDatePicker])

  // Memoize formatted dates - show different format based on viewMode
  const formattedDate = useMemo(() => {
    if (viewMode === "week") {
      const weekNumber = getWeek(selectedDate, { weekStartsOn: 1, locale: nb })
      return `Uke ${weekNumber}`
    } else if (viewMode === "month") {
      return format(selectedDate, "MMMM yy", { locale: nb })
    } else {
      // Day view
      return format(selectedDate, "d. MMM yyyy", { locale: nb })
    }
  }, [selectedDate, viewMode])
  const dateInputValue = useMemo(() => {
    if (viewMode === "week") {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1, locale: nb })
      return format(weekStart, "yyyy-MM-dd")
    } else if (viewMode === "month") {
      const monthStart = startOfMonth(selectedDate)
      return format(monthStart, "yyyy-MM-dd")
    } else {
      return format(selectedDate, "yyyy-MM-dd")
    }
  }, [selectedDate, viewMode])

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
                  Kalender
                </h1>
                
                {/* Filter dropdowns */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <select
                    value={selectedCategoryId || ""}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Alle kategorier</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {availableResources.length > 0 && (
                    <select
                      value={selectedResourceId || ""}
                      onChange={(e) => handleResourceChange(e.target.value)}
                      className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Alle fasiliteter</option>
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
                      className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              </div>
              
              {/* Date Navigation */}
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                <button
                  onClick={() => {
                    if (viewMode === "week") {
                      setSelectedDate(prev => subWeeks(prev, 1))
                    } else if (viewMode === "month") {
                      setSelectedDate(prev => subMonths(prev, 1))
                    } else {
                      changeDate(-1)
                    }
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label={viewMode === "week" ? "Forrige uke" : viewMode === "month" ? "Forrige måned" : "Forrige dag"}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500 hidden sm:block" />
                  <div className="relative" ref={datePickerRef}>
                    <div className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 min-w-[120px] sm:min-w-[140px] cursor-pointer flex items-center justify-between"
                      onClick={handleDatePickerClick}
                    >
                      <span>{formattedDate}</span>
                      <Calendar className="w-4 h-4 text-gray-400" />
                    </div>
                    {showDatePicker && (
                      <div className="absolute top-full left-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-4" style={{ minWidth: "300px" }}>
                        {/* Month Navigation */}
                        <div className="flex items-center justify-between mb-4">
                          <button
                            onClick={() => setDatePickerMonth(prev => subMonths(prev, 1))}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <div className="text-sm font-medium text-gray-900">
                            {format(datePickerMonth, "MMMM yyyy", { locale: nb })}
                          </div>
                          <button
                            onClick={() => setDatePickerMonth(prev => addMonths(prev, 1))}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>

                        {/* Day Labels */}
                        <div className="grid grid-cols-8 gap-0 mb-2">
                          <div className="text-xs text-gray-500 font-medium text-center py-2"></div>
                          {["ma.", "ti.", "on.", "to.", "fr.", "lø.", "sø."].map((day) => (
                            <div key={day} className="text-xs text-gray-500 font-medium text-center py-2">
                              {day}
                            </div>
                          ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-8 gap-0">
                          {(() => {
                            const monthStart = startOfMonth(datePickerMonth)
                            const monthEnd = endOfMonth(datePickerMonth)
                            const startDate = startOfWeek(monthStart, { weekStartsOn: 1, locale: nb })
                            const endDate = endOfWeek(monthEnd, { weekStartsOn: 1, locale: nb })
                            const days = eachDayOfInterval({ start: startDate, end: endDate })
                            
                            // Group days by week
                            const weeks: Date[][] = []
                            let currentWeek: Date[] = []
                            days.forEach((day, index) => {
                              if (index % 7 === 0 && currentWeek.length > 0) {
                                weeks.push(currentWeek)
                                currentWeek = []
                              }
                              currentWeek.push(day)
                            })
                            if (currentWeek.length > 0) {
                              weeks.push(currentWeek)
                            }

                            return weeks.flatMap((week, weekIndex) => {
                              const weekNumber = getWeek(week[0], { weekStartsOn: 1, locale: nb })
                              return [
                                // Week number column
                                <div key={`week-${weekIndex}`} className="text-xs text-gray-600 font-medium text-center py-2 border-r border-gray-200">
                                  {weekNumber}
                                </div>,
                                // Days of the week
                                ...week.map((day) => {
                                  const isCurrentMonth = isSameMonth(day, datePickerMonth)
                                  const isSelected = isSameDay(day, selectedDate)
                                  const isTodayDate = isToday(day)
                                  
    return (
                                    <button
                                      key={day.toISOString()}
                                      onClick={() => {
                                        setSelectedDate(day)
                                        setShowDatePicker(false)
                                      }}
                                      className={`
                                        text-sm py-2 px-1 rounded
                                        ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-900'}
                                        ${isSelected ? 'bg-blue-600 text-white' : isTodayDate ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'}
                                      `}
                                    >
                                      {format(day, "d")}
                                    </button>
                                  )
                                })
                              ]
                            })
                          })()}
          </div>

                        {/* Footer Buttons */}
                        <div className="flex justify-between mt-4 pt-4 border-t border-gray-200">
                          <button
                            onClick={() => {
                              setSelectedDate(new Date())
                              setShowDatePicker(false)
                            }}
                            className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1"
                          >
                            I dag
                          </button>
                          <button
                            onClick={() => setShowDatePicker(false)}
                            className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1"
                          >
                            Tøm
                          </button>
        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    if (viewMode === "week") {
                      setSelectedDate(prev => addWeeks(prev, 1))
                    } else if (viewMode === "month") {
                      setSelectedDate(prev => addMonths(prev, 1))
                    } else {
                      changeDate(1)
                    }
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label={viewMode === "week" ? "Neste uke" : viewMode === "month" ? "Neste måned" : "Neste dag"}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                
                {viewMode === "day" && (
                  <button
                    onClick={() => setSelectedDate(new Date())}
                    className="px-3 sm:px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    I dag
                  </button>
                )}
                
                <div className="flex items-center gap-1 border border-gray-300 rounded-lg overflow-hidden">
                  <button
                    onClick={() => {
                      setViewMode("day")
                      setSelectedDate(new Date())
                    }}
                    className={`px-3 py-2 text-sm transition-colors ${
                      viewMode === "day"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Dag
                  </button>
                  <button
                    onClick={() => {
                      setViewMode("week")
                      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1, locale: nb })
                      setSelectedDate(weekStart)
                    }}
                    className={`px-3 py-2 text-sm transition-colors border-l border-gray-300 ${
                      viewMode === "week"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Uke
                  </button>
                  <button
                    onClick={() => {
                      setViewMode("month")
                      setSelectedDate(startOfMonth(new Date()))
                    }}
                    className={`px-3 py-2 text-sm transition-colors border-l border-gray-300 ${
                      viewMode === "month"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
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


          {/* Calendar View (Week/Month) */}
          {viewMode === "week" ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div ref={weekViewScrollRef} className="h-[calc(100vh-300px)] overflow-auto rounded-xl">
                <div style={{ minWidth: "800px" }}>
                  {/* Calendar Header */}
                  <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200">
                    <div className="flex">
                      <div className="flex-shrink-0 p-2 sm:p-3 font-medium text-gray-700 text-xs sm:text-sm border-r border-gray-200 bg-gray-50" style={{ width: "80px" }}>
                        Tid
                      </div>
                      {viewDays.map((day, index) => (
                        <div
                          key={index}
                          className="flex-1 border-r border-gray-200 last:border-r-0 p-2 sm:p-3 text-center bg-gray-50"
                          style={{ minWidth: "100px" }}
                        >
                          <div className="text-xs sm:text-sm font-medium text-gray-900">
                            {format(day, "EEEE", { locale: nb })}
                          </div>
                          <div className="text-[10px] sm:text-xs text-gray-600 mt-1">
                            {format(day, "d. MMM", { locale: nb })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Calendar Body */}
                  <div className="flex">
                    {/* Time Labels */}
                    <div className="flex-shrink-0 border-r border-gray-200 bg-gray-50" style={{ height: "1440px", width: "80px" }}>
                      {Array.from({ length: 24 }).map((_, hour) => (
                        <div key={hour} className="flex items-center justify-start pl-2 border-b border-gray-100" style={{ height: "60px" }}>
                          <div className="text-xs sm:text-sm font-medium text-gray-700 text-left">
                            {format(setHours(startOfDay(selectedDate), hour), "HH:mm")}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Week Columns - All bookings with absolute positioning */}
                    <div className="flex flex-1" style={{ height: "1440px" }}>
                      {viewDays.map((day, dayIndex) => {
                        // Get all bookings for this day and calculate columns
                        const allDayBookings = filteredBookingsForCalendar.filter(booking => {
                          const bookingStart = parseISO(booking.startTime)
                          return isSameDay(bookingStart, day)
                        })
                        
                        const bookingColumns = getBookingColumns(allDayBookings)

                        return (
                          <div
                            key={dayIndex}
                            className="flex-1 border-r border-gray-200 last:border-r-0 relative"
                            style={{ 
                              minWidth: "100px",
                              height: "1440px",
                              backgroundColor: isToday(day) ? 'rgba(59, 130, 246, 0.1)' : 'rgba(249, 250, 251, 0.3)'
                            }}
                          >
                            {/* Time Grid Lines */}
                            {Array.from({ length: 25 }).map((_, hour) => (
                              <div
                                key={hour}
                                className="absolute border-b border-gray-100"
                                style={{
                                  top: `${hour * 60}px`,
                                  left: 0,
                                  right: 0,
                                  height: '1px'
                                }}
                              />
                            ))}
                            
                            {/* All bookings for this day */}
                            {allDayBookings.map((booking) => {
                              const start = parseISO(booking.startTime)
                              const end = parseISO(booking.endTime)
                              
                              // Cap the end time to end of day to prevent overflow
                              const dayStart = startOfDay(day)
                              const dayEnd = new Date(dayStart)
                              dayEnd.setHours(23, 59, 59, 999)
                              const cappedStart = start < dayStart ? dayStart : start
                              const cappedEnd = end > dayEnd ? dayEnd : end
                              
                              // Calculate position in pixels (each hour is 60px, total 1440px for 24 hours)
                              const startMinutes = cappedStart.getHours() * 60 + cappedStart.getMinutes()
                              const endMinutes = cappedEnd.getHours() * 60 + cappedEnd.getMinutes()
                              const topPx = (startMinutes / 60) * 60
                              const heightPx = ((endMinutes - startMinutes) / 60) * 60
                              
                              const isPending = booking.status === "pending"
                              const resourceColor = booking.resource.color || booking.resource.category?.color || "#3b82f6"
                              
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

                              // Check if there's a booking directly above or below this one
                              const hasBookingAbove = allDayBookings.some(b => {
                                if (b.id === booking.id) return false
                                const bStart = parseISO(b.startTime)
                                const bEnd = parseISO(b.endTime)
                                const bDayStart = startOfDay(day)
                                const bDayEnd = new Date(bDayStart)
                                bDayEnd.setHours(23, 59, 59, 999)
                                const bCappedStart = bStart < bDayStart ? bDayStart : bStart
                                const bCappedEnd = bEnd > bDayEnd ? bDayEnd : bEnd
                                // Check if booking ends exactly where this one starts (within same column)
                                const bColumnInfo = bookingColumns.get(b.id) || { column: 0, totalColumns: 1 }
                                return Math.abs(bCappedEnd.getTime() - cappedStart.getTime()) < 1000 && bColumnInfo.column === column
                              })
                              
                              const hasBookingBelow = allDayBookings.some(b => {
                                if (b.id === booking.id) return false
                                const bStart = parseISO(b.startTime)
                                const bEnd = parseISO(b.endTime)
                                const bDayStart = startOfDay(day)
                                const bDayEnd = new Date(bDayStart)
                                bDayEnd.setHours(23, 59, 59, 999)
                                const bCappedStart = bStart < bDayStart ? bDayStart : bStart
                                const bCappedEnd = bEnd > bDayEnd ? bDayEnd : bEnd
                                // Check if booking starts exactly where this one ends (within same column)
                                const bColumnInfo = bookingColumns.get(b.id) || { column: 0, totalColumns: 1 }
                                return Math.abs(bCappedStart.getTime() - cappedEnd.getTime()) < 1000 && bColumnInfo.column === column
                              })

                              return (
                                <div
                                  key={booking.id}
                                  onClick={() => setSelectedBooking(booking)}
                                  className={`absolute rounded-md px-2 py-1 text-xs cursor-pointer pointer-events-auto hover:opacity-90 transition-opacity ${
                                    isPending ? 'border-2 border-dashed' : ''
                                  }`}
                                  style={{
                                    top: `${topPx}px`,
                                    left: isSingleBox ? '2px' : `calc(${leftPercent}% + ${gapPxHorizontal / 2}px)`,
                                    width: boxWidth,
                                    height: `${Math.max(heightPx, 40)}px`,
                                    minHeight: '40px',
                                    backgroundColor: isPending 
                                      ? `${resourceColor}20`
                                      : resourceColor,
                                    borderColor: isPending ? resourceColor : 'black',
                                    color: 'black',
                                    borderTop: isPending ? '2px dashed' : hasBookingAbove ? '1px solid rgba(0,0,0,0.3)' : '1px solid black',
                                    borderBottom: isPending ? '2px dashed' : hasBookingBelow ? '1px solid rgba(0,0,0,0.3)' : '1px solid black',
                                    borderLeft: isPending ? '2px dashed' : '1px solid black',
                                    borderRight: isPending ? '2px dashed' : '1px solid black',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                    zIndex: 10,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'flex-start',
                                    alignItems: 'flex-start'
                                  }}
                                  title={`${format(start, "HH:mm")}-${format(end, "HH:mm")} ${booking.title} - ${booking.resource.name}${booking.resourcePart?.name ? ` (${booking.resourcePart.name})` : ''}${isPending ? ' (venter på godkjenning)' : ''} - Klikk for mer info`}
                                >
                                  <p className="font-medium truncate w-full">{booking.title}</p>
                                  <p className={`truncate text-[10px] w-full ${isPending ? 'opacity-70' : 'opacity-80'}`}>
                                    {format(start, "HH:mm")} - {format(end, "HH:mm")} {booking.resourcePart?.name || booking.resource.name}
                                  </p>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : viewMode === "month" ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-[calc(100vh-300px)] flex flex-col">
              {/* Calendar Header */}
              <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200 flex-shrink-0">
                {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((day) => (
                  <div key={day} className="p-3 text-center text-sm font-medium text-gray-500">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 flex-1 min-h-0" style={{ gridAutoRows: "1fr" }}>
                {viewDays.map((day, index) => {
                  const dayBookings = getBookingsForDay(day)
                  const isCurrentMonth = isSameMonth(day, selectedDate)
                  const resourceColor = dayBookings.length > 0 
                    ? (dayBookings[0].resource.color || dayBookings[0].resource.category?.color || "#3b82f6")
                    : "#3b82f6"
                  
                  return (
                    <div 
                      key={day.toISOString()} 
                      className={`p-2 border-b border-r border-gray-100 min-h-0 ${
                        index % 7 === 0 ? 'border-l-0' : ''
                      } ${!isCurrentMonth ? 'bg-gray-50/50' : ''} ${
                        isToday(day) ? 'bg-blue-50' : ''
                      }`}
                      style={{ display: "flex", flexDirection: "column" }}
                    >
                      <p className={`text-sm font-medium mb-1 flex-shrink-0 ${
                        isToday(day) 
                          ? 'text-blue-600' 
                          : isCurrentMonth 
                            ? 'text-gray-900' 
                            : 'text-gray-400'
                      }`}>
                        {format(day, "d")}
                      </p>
                      <div className="space-y-1 flex-1 overflow-y-auto min-h-0">
                        {dayBookings.map((booking) => {
                          const isPending = booking.status === "pending"
                          const bookingColor = booking.resource.color || booking.resource.category?.color || "#3b82f6"
                          
                          return (
                            <div
                              key={booking.id}
                              onClick={() => setSelectedBooking(booking)}
                              className={`px-1.5 py-0.5 rounded text-xs cursor-pointer hover:opacity-90 transition-opacity flex-shrink-0 flex flex-col ${
                                isPending 
                                  ? "bg-green-50 text-green-700 border border-dashed border-green-400" 
                                  : "text-black border border-black"
                              }`}
                              style={!isPending ? { 
                                backgroundColor: bookingColor,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'flex-start',
                                alignItems: 'flex-start'
                              } : {
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'flex-start',
                                alignItems: 'flex-start'
                              }}
                              title={`${format(parseISO(booking.startTime), "HH:mm")}-${format(parseISO(booking.endTime), "HH:mm")} ${booking.title} - ${booking.resource.name}${booking.resourcePart?.name ? ` (${booking.resourcePart.name})` : ''}${isPending ? ' (venter på godkjenning)' : ''} - Klikk for mer info`}
                            >
                              <p className="font-medium truncate w-full">{booking.title}</p>
                              <p className={`truncate text-[10px] w-full ${isPending ? 'opacity-70' : 'opacity-80'}`}>
                                {format(parseISO(booking.startTime), "HH:mm")} - {format(parseISO(booking.endTime), "HH:mm")} {booking.resourcePart?.name || booking.resource.name}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
          /* Day View - Calendar Style */
          !timelineData ? (
            <div className="card p-12 text-center">
              <GanttChart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Laster data...</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="h-[calc(100vh-300px)] overflow-x-auto rounded-xl flex flex-col">
                {/* Calendar Header */}
                <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 flex-shrink-0">
                  <div className="flex" style={{ minWidth: "800px" }}>
                    <div className="flex-shrink-0 p-2 sm:p-3 font-medium text-gray-700 text-xs sm:text-sm border-r border-gray-200 bg-gray-50" style={{ width: "80px" }}>
                      Tid
                    </div>
                    <div className="flex-1 border-r border-gray-200 last:border-r-0 p-2 sm:p-3 text-center bg-gray-50">
                      <div className="text-xs sm:text-sm font-medium text-gray-900">
                        {format(selectedDate, "EEEE", { locale: nb })}
                      </div>
                      <div className="text-[10px] text-gray-600 mt-1">
                        {format(selectedDate, "d. MMM yyyy", { locale: nb })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Calendar Body - Single row showing entire day */}
                <div ref={dayViewScrollRef} className="overflow-y-auto flex-1 min-h-0" style={{ minWidth: "800px" }}>
                  <div className="flex">
                    {/* Time Labels */}
                    <div className="flex-shrink-0 border-r border-gray-200 bg-gray-50" style={{ height: "1440px", width: "80px" }}>
                      {Array.from({ length: 24 }).map((_, hour) => (
                        <div key={hour} className="flex items-center justify-start pl-2 border-b border-gray-100" style={{ height: "60px" }}>
                          <div className="text-xs sm:text-sm font-medium text-gray-700 text-left">
                            {format(setHours(startOfDay(selectedDate), hour), "HH:mm")}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Day Column - All bookings with absolute positioning */}
                    <div className="flex-1 relative" style={{ height: "1440px" }}>
                      {/* Time Grid Lines */}
                      {Array.from({ length: 25 }).map((_, hour) => (
                        <div
                          key={hour}
                          className="absolute border-b border-gray-100"
                          style={{
                            top: `${hour * 60}px`,
                            left: 0,
                            right: 0,
                            height: '1px'
                          }}
                        />
                      ))}
                      
                      {/* Get all bookings for the selected day filtered by selected resources */}
                      {(() => {
                        const dayBookings = filteredBookingsForCalendar.filter(booking => {
                          const bookingStart = parseISO(booking.startTime)
                          return isSameDay(bookingStart, selectedDate)
                        })
                        
                        const bookingColumns = getBookingColumns(dayBookings)
                        
                        return dayBookings.map((booking) => {
                          const start = parseISO(booking.startTime)
                          const end = parseISO(booking.endTime)
                          
                          // Cap the end time to end of day to prevent overflow
                          const dayStart = startOfDay(selectedDate)
                          const dayEnd = new Date(dayStart)
                          dayEnd.setHours(23, 59, 59, 999)
                          const cappedStart = start < dayStart ? dayStart : start
                          const cappedEnd = end > dayEnd ? dayEnd : end
                          
                          // Calculate position in pixels (each hour is 60px, total 1440px for 24 hours)
                          const startMinutes = cappedStart.getHours() * 60 + cappedStart.getMinutes()
                          const endMinutes = cappedEnd.getHours() * 60 + cappedEnd.getMinutes()
                          const topPx = (startMinutes / 60) * 60
                          const heightPx = ((endMinutes - startMinutes) / 60) * 60
                          
                          const isPending = booking.status === "pending"
                          const resourceColor = booking.resource.color || booking.resource.category?.color || "#3b82f6"
                          
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

                          // Check if there's a booking directly above or below this one
                          const hasBookingAbove = dayBookings.some(b => {
                            if (b.id === booking.id) return false
                            const bStart = parseISO(b.startTime)
                            const bEnd = parseISO(b.endTime)
                            const bDayStart = startOfDay(selectedDate)
                            const bDayEnd = new Date(bDayStart)
                            bDayEnd.setHours(23, 59, 59, 999)
                            const bCappedStart = bStart < bDayStart ? bDayStart : bStart
                            const bCappedEnd = bEnd > bDayEnd ? bDayEnd : bEnd
                            // Check if booking ends exactly where this one starts (within same column)
                            const bColumnInfo = bookingColumns.get(b.id) || { column: 0, totalColumns: 1 }
                            return Math.abs(bCappedEnd.getTime() - cappedStart.getTime()) < 1000 && bColumnInfo.column === column
                          })
                          
                          const hasBookingBelow = dayBookings.some(b => {
                            if (b.id === booking.id) return false
                            const bStart = parseISO(b.startTime)
                            const bEnd = parseISO(b.endTime)
                            const bDayStart = startOfDay(selectedDate)
                            const bDayEnd = new Date(bDayStart)
                            bDayEnd.setHours(23, 59, 59, 999)
                            const bCappedStart = bStart < bDayStart ? bDayStart : bStart
                            const bCappedEnd = bEnd > bDayEnd ? bDayEnd : bEnd
                            // Check if booking starts exactly where this one ends (within same column)
                            const bColumnInfo = bookingColumns.get(b.id) || { column: 0, totalColumns: 1 }
                            return Math.abs(bCappedStart.getTime() - cappedEnd.getTime()) < 1000 && bColumnInfo.column === column
                          })

                          return (
                            <div
                              key={booking.id}
                              onClick={() => setSelectedBooking(booking)}
                              className={`absolute rounded-md px-2 py-1 text-xs cursor-pointer pointer-events-auto hover:opacity-90 transition-opacity ${
                                isPending ? 'border-2 border-dashed' : ''
                              }`}
                              style={{
                                top: `${topPx}px`,
                                left: isSingleBox ? '2px' : `calc(${leftPercent}% + ${gapPxHorizontal / 2}px)`,
                                width: boxWidth,
                                height: `${Math.max(heightPx, 40)}px`,
                                minHeight: '40px',
                                backgroundColor: isPending 
                                  ? `${resourceColor}20`
                                  : resourceColor,
                                borderColor: isPending ? resourceColor : 'black',
                                color: 'black',
                                borderTop: isPending ? '2px dashed' : hasBookingAbove ? '1px solid rgba(0,0,0,0.3)' : '1px solid black',
                                borderBottom: isPending ? '2px dashed' : hasBookingBelow ? '1px solid rgba(0,0,0,0.3)' : '1px solid black',
                                borderLeft: isPending ? '2px dashed' : '1px solid black',
                                borderRight: isPending ? '2px dashed' : '1px solid black',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                zIndex: 10,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'flex-start',
                                alignItems: 'flex-start'
                              }}
                              title={`${format(start, "HH:mm")}-${format(end, "HH:mm")} ${booking.title} - ${booking.resource.name}${booking.resourcePart?.name ? ` (${booking.resourcePart.name})` : ''}${isPending ? ' (venter på godkjenning)' : ''} - Klikk for mer info`}
                            >
                              <p className="font-medium truncate w-full">{booking.title}</p>
                              <p className={`truncate text-[10px] w-full ${isPending ? 'opacity-70' : 'opacity-80'}`}>
                                {format(start, "HH:mm")} - {format(end, "HH:mm")} {booking.resourcePart?.name || booking.resource.name}
                              </p>
                            </div>
                          )
                        })
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
          )}
        </div>
      </main>

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
                    style={{ backgroundColor: selectedBooking.resource.color || selectedBooking.resource.category?.color || "#3b82f6" }}
                  />
                  <span>
                    {selectedBooking.resource.name}
                    {selectedBooking.resourcePart && ` → ${selectedBooking.resourcePart.name}`}
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
                {selectedBooking.user.name && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="w-4 h-4 text-gray-400" />
                    {selectedBooking.user.name}
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
                              ...selectedBooking,
                              resourceId: selectedBooking.resource.id,
                              resourceName: selectedBooking.resource.name,
                              resourcePartId: selectedBooking.resourcePart?.id || null,
                              resourcePartName: selectedBooking.resourcePart?.name || null
                            } as any)
                            setSelectedBooking(null)
                          }}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <Pencil className="w-4 h-4" />
                          Rediger
                        </button>
                      )}
                      <button
                        onClick={() => handleBookingAction(selectedBooking.id, "cancel")}
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
                            ...selectedBooking,
                            resourceId: selectedBooking.resource.id,
                            resourceName: selectedBooking.resource.name,
                            resourcePartId: selectedBooking.resourcePart?.id || null,
                            resourcePartName: selectedBooking.resourcePart?.name || null
                          } as any)
                          setSelectedBooking(null)
                        }}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Pencil className="w-4 h-4" />
                        Rediger
                      </button>
                      <button
                        onClick={() => handleBookingAction(selectedBooking.id, "cancel")}
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
        const booking = timelineData?.bookings.find(b => b.id === rejectingBookingId)
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
            resourceId: editingBooking.resource.id,
            resourceName: editingBooking.resource.name,
            resourcePartId: editingBooking.resourcePart?.id || null,
            resourcePartName: editingBooking.resourcePart?.name || null
          }}
          isAdmin={canManageBookings}
          onClose={() => setEditingBooking(null)}
          onSaved={(updatedBooking) => {
            if (timelineData) {
              setTimelineData({
                ...timelineData,
                bookings: timelineData.bookings.map(b => 
                  b.id === updatedBooking.id 
                    ? { 
                        ...b, 
                        title: updatedBooking.title,
                        startTime: updatedBooking.startTime,
                        endTime: updatedBooking.endTime,
                        status: updatedBooking.status
                      } 
                    : b
                )
              })
            }
            setEditingBooking(null)
          }}
        />
      )}

      <Footer />
    </div>
  )
}
