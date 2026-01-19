"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { PageLayout } from "@/components/PageLayout"
import { format, parseISO, startOfDay, addDays, setHours, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameWeek, isSameMonth, addWeeks, subWeeks, addMonths, subMonths, isToday, getWeek } from "date-fns"
import { nb } from "date-fns/locale"
import { Calendar, ChevronLeft, ChevronRight, GanttChart, Filter, X, Clock, User, MapPin, CheckCircle2, XCircle, Trash2, Loader2, Repeat, Pencil, Star } from "lucide-react"
import { EditBookingModal } from "@/components/EditBookingModal"

interface Booking {
  id: string
  title: string
  startTime: string
  endTime: string
  status: "approved" | "pending" | "competition"
  userId: string
  isRecurring?: boolean
  isCompetition?: boolean
  competitionName?: string
  roundName?: string
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
  user?: {
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

export default function CalendarPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  // User roles - define early so we can use isLoggedIn in initial state
  const isLoggedIn = session?.user !== undefined
  // Sjekk både systemRole og role (legacy) for bakoverkompatibilitet
  const isAdmin = session?.user?.systemRole === "admin" || session?.user?.role === "admin"
  const isModerator = session?.user?.hasModeratorAccess ?? false
  const canManageBookings = isAdmin || isModerator
  
  const [selectedDate, setSelectedDate] = useState(new Date())
  // Default to month view for all users
  const [viewMode, setViewMode] = useState<"day" | "week" | "month" | "overview">("month")
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set())
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [applyToAll, setApplyToAll] = useState(true)
  const [rejectingBookingId, setRejectingBookingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [datePickerMonth, setDatePickerMonth] = useState(new Date())
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  const timelineContainerRef = useRef<HTMLDivElement>(null)
  const dayViewScrollRef = useRef<HTMLDivElement>(null)
  const weekViewScrollRef = useRef<HTMLDivElement>(null)
  const datePickerRef = useRef<HTMLDivElement>(null)
  const mobileDatePickerRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)

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
      
      if (viewMode === "day" || viewMode === "overview") {
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

  // Load user preferences on mount - fetch immediately, don't wait for timelineData
  // This prevents the flash where we show default view before switching to preferred view
  useEffect(() => {
    if (isLoggedIn && !preferencesLoaded) {
      fetch("/api/user/preferences")
        .then(res => res.json())
        .then(prefs => {
          // Load calendar preferences
          // Use defaultCalendarView for viewMode (day/week/month/overview)
          if (prefs.defaultCalendarView && ["day", "week", "month", "overview"].includes(prefs.defaultCalendarView)) {
            setViewMode(prefs.defaultCalendarView as "day" | "week" | "month" | "overview")
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
  }, [isLoggedIn, preferencesLoaded])

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

  // Swipe handlers for mobile navigation
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchEndX.current = null
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!touchStartX.current || !touchEndX.current) return
    
    const diff = touchStartX.current - touchEndX.current
    const minSwipeDistance = 50 // minimum distance for swipe
    
    if (Math.abs(diff) < minSwipeDistance) return
    
    if (diff > 0) {
      // Swipe left = next
      if (viewMode === "day") {
        setSelectedDate(prev => addDays(prev, 1))
      } else if (viewMode === "week") {
        setSelectedDate(prev => addWeeks(prev, 1))
      } else if (viewMode === "month") {
        setSelectedDate(prev => addMonths(prev, 1))
      }
    } else {
      // Swipe right = previous
      if (viewMode === "day") {
        setSelectedDate(prev => addDays(prev, -1))
      } else if (viewMode === "week") {
        setSelectedDate(prev => subWeeks(prev, 1))
      } else if (viewMode === "month") {
        setSelectedDate(prev => subMonths(prev, 1))
      }
    }
    
    touchStartX.current = null
    touchEndX.current = null
  }, [viewMode])

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

  // Get all categories
  const categories = useMemo(() => {
    if (!timelineData) return []
    const categorySet = new Map<string, { id: string; name: string; color: string | null }>()
    timelineData.resources.forEach(resource => {
      if (resource.category) {
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

  // Initialize selected resources when data loads (select all by default for overview)
  const isInitialLoad = useRef(true)
  useEffect(() => {
    if (timelineData && timelineData.resources.length > 0 && viewMode === "overview") {
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
  }, [timelineData, viewMode])

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

  // Calculate overlap columns for bookings in a day (for calendar view)
  // Improved algorithm: Consistent widths within each column
  const getBookingColumns = useCallback((dayBookings: Booking[]) => {
    if (dayBookings.length === 0) return new Map<string, { column: number; totalColumns: number }>()
    
    // Sort by start time, then by duration (longer first), then by id for stable ordering
    const sorted = [...dayBookings].sort((a, b) => {
      const aStart = parseISO(a.startTime).getTime()
      const bStart = parseISO(b.startTime).getTime()
      if (aStart !== bStart) return aStart - bStart
      
      // Longer events first (they're more important to see)
      const aDuration = parseISO(a.endTime).getTime() - aStart
      const bDuration = parseISO(b.endTime).getTime() - bStart
      if (aDuration !== bDuration) return bDuration - aDuration
      
      return a.id.localeCompare(b.id)
    })
    
    const columns = new Map<string, { column: number; totalColumns: number }>()
    const columnEndTimes: Date[] = []
    
    // First pass: Assign columns greedily (reuse columns when possible)
    sorted.forEach(booking => {
      const start = parseISO(booking.startTime)
      const end = parseISO(booking.endTime)
      
      // Find first available column (where previous event has ended)
      let column = 0
      while (column < columnEndTimes.length && columnEndTimes[column] > start) {
        column++
      }
      
      columnEndTimes[column] = end
      columns.set(booking.id, { column, totalColumns: 1 })
    })
    
    // Second pass: Calculate max concurrent bookings at each time point
    // This determines the actual width needed
    sorted.forEach(booking => {
      const start = parseISO(booking.startTime)
      const end = parseISO(booking.endTime)
      
      // Find bookings that overlap with this one AT THE SAME TIME
      const concurrent = sorted.filter(b => {
        const bStart = parseISO(b.startTime)
        const bEnd = parseISO(b.endTime)
        // Check if they overlap (not just touch)
        return start < bEnd && end > bStart
      })
      
      // The number of columns needed is the max column index + 1 among concurrent bookings
      const maxColumnUsed = Math.max(...concurrent.map(b => columns.get(b.id)?.column || 0))
      const totalColumnsNeeded = maxColumnUsed + 1
      
      // Update all concurrent bookings to know how many columns their group uses
      concurrent.forEach(b => {
        const current = columns.get(b.id)
        if (current) {
          // Only increase totalColumns, never decrease
          columns.set(b.id, { 
            ...current, 
            totalColumns: Math.max(current.totalColumns, totalColumnsNeeded) 
          })
        }
      })
    })
    
    // Third pass: Ensure consistent widths within each column
    // All bookings in the same column should have the same totalColumns (use the max)
    const maxTotalColumnsPerColumn = new Map<number, number>()
    columns.forEach((value) => {
      const current = maxTotalColumnsPerColumn.get(value.column) || 0
      maxTotalColumnsPerColumn.set(value.column, Math.max(current, value.totalColumns))
    })
    
    // Also find the global max totalColumns for the day
    const globalMaxColumns = Math.max(...Array.from(columns.values()).map(v => v.totalColumns))
    
    // Update all bookings to use the global max (ensures all columns have same width)
    columns.forEach((value, key) => {
      columns.set(key, { ...value, totalColumns: globalMaxColumns })
    })
    
    return columns
  }, [])

  // Get filtered bookings for calendar view
  // Show all when no filter, filter by category when category selected, then resource, then part
  const filteredBookingsForCalendar = useMemo(() => {
    if (!timelineData) return []
    
    return timelineData.bookings.filter(b => {
      // Always show competition events (they block the whole facility)
      if (b.status === "competition") {
        // If a specific resource is selected, only show competitions for that resource
        if (selectedResourceId) {
          return b.resource.id === selectedResourceId
        }
        // If a category is selected, show competitions for resources in that category
        if (selectedCategoryId) {
          return b.resource.category?.id === selectedCategoryId
        }
        // Show all competitions if no filter
        return true
      }
      
      // Filter out whole facility bookings if allowWholeBooking is false
      const resource = timelineData.resources.find(r => r.id === b.resource.id)
      if (resource && !resource.allowWholeBooking && !b.resourcePart) {
        return false
      }
      
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

  // Group resources with their parts and bookings (filtered by selected resources) - for overview view
  const groupedData = useMemo(() => {
    if (!timelineData || viewMode !== "overview") return []

    const grouped: Array<{
      resource: Resource
      allBookings: Booking[]
      parts: Array<{
        part: { id: string; name: string; parentId?: string | null } | null
        bookings: Booking[]
        isChild: boolean
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

      // Sort parts hierarchically: parents first, then their children
      const sortPartsHierarchically = (parts: typeof resource.parts) => {
        const partMap = new Map(parts.map(p => [p.id, p]))
        const roots: typeof parts = []
        const childrenMap = new Map<string, typeof parts>()
        
        // Separate roots and children
        parts.forEach(part => {
          if (!part.parentId || !partMap.has(part.parentId)) {
            roots.push(part)
          } else {
            if (!childrenMap.has(part.parentId)) {
              childrenMap.set(part.parentId, [])
            }
            childrenMap.get(part.parentId)!.push(part)
          }
        })
        
        // Sort each level by name
        roots.sort((a, b) => a.name.localeCompare(b.name, 'no'))
        childrenMap.forEach(children => children.sort((a, b) => a.name.localeCompare(b.name, 'no')))
        
        // Flatten: parent followed by its children
        const result: Array<{ part: typeof parts[0]; isChild: boolean }> = []
        roots.forEach(root => {
          result.push({ part: root, isChild: false })
          const children = childrenMap.get(root.id) || []
          children.forEach(child => {
            result.push({ part: child, isChild: true })
          })
        })
        
        return result
      }

      // Convert to array format
      const parts: Array<{
        part: { id: string; name: string; parentId?: string | null } | null
        bookings: Booking[]
        isChild: boolean
      }> = []

      // Add whole resource row first (hoveddel) only if allowWholeBooking is true
      if (resource.allowWholeBooking) {
        parts.push({
          part: null,
          bookings: partsMap.get("whole") || [],
          isChild: false
        })
      }

      // Add part rows in hierarchical order
      const sortedParts = sortPartsHierarchically(resource.parts)
      sortedParts.forEach(({ part, isChild }) => {
        const bookings = partsMap.get(part.id) || []
        parts.push({
          part: { id: part.id, name: part.name, parentId: part.parentId },
          bookings,
          isChild
        })
      })

      if (parts.length > 0) {
        grouped.push({ resource, allBookings: resourceBookings, parts })
      }
    })

    return grouped
  }, [timelineData, selectedResources, viewMode])

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
      const target = event.target as Node
      const isOutsideDesktop = datePickerRef.current && !datePickerRef.current.contains(target)
      const isOutsideMobile = mobileDatePickerRef.current && !mobileDatePickerRef.current.contains(target)
      // Close if clicking outside both refs (one will be null depending on screen size)
      if ((isOutsideDesktop || !datePickerRef.current) && (isOutsideMobile || !mobileDatePickerRef.current)) {
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

  // Wait for preferences to load for logged-in users to prevent view mode flash
  if (status === "loading" || isLoading || (isLoggedIn && !preferencesLoaded)) {
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
      {/* Mobile: Full screen layout - calendar fills available space */}
      {/* On mobile: full height minus top navbar (3.5rem) and bottom nav padding is handled by ClientLayout pb-20 */}
      <div className="w-full px-0 sm:px-4 md:px-6 lg:px-8 py-0 sm:py-6 md:block flex flex-col h-[calc(100dvh-7.5rem)] md:h-auto overflow-x-hidden overflow-y-hidden md:overflow-visible">
          {/* Header - Ultra compact on mobile */}
          <div className="px-2 py-1.5 sm:px-0 sm:py-0 sm:mb-6 flex-shrink-0">
            <div className="flex items-center justify-between gap-2 sm:mb-4">
              {/* Left side - Mobile: Title + Filter, Desktop: Title + filters */}
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap flex-1">
                {/* Title - visible on both mobile and desktop */}
                <h1 className="flex text-sm sm:text-2xl font-bold text-gray-900 items-center gap-2">
                  <Calendar className="w-4 h-4 sm:w-6 sm:h-6" />
                  <span>Kalender</span>
                </h1>
                
                {/* Mobile: Filter button after title */}
                {viewMode !== "overview" && (
                  <button
                    onClick={() => setShowMobileFilters(!showMobileFilters)}
                    className={`sm:hidden flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${
                      showMobileFilters || selectedCategoryId || selectedResourceId
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    <Filter className="w-3 h-3" />
                    {(selectedCategoryId || selectedResourceId) && (
                      <span className="w-1.5 h-1.5 bg-white rounded-full" />
                    )}
                  </button>
                )}
                
                {/* Desktop Filter dropdowns - only show for non-overview views */}
                {viewMode !== "overview" && (
                  <div className="hidden sm:flex items-center gap-2 sm:gap-3 flex-wrap">
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
                )}
                {/* Filter Button for Overview */}
                {viewMode === "overview" && (
                  <button
                    onClick={() => setShowFilter(!showFilter)}
                    className={`sm:hidden flex items-center justify-center px-1.5 py-0.5 rounded transition-colors ${
                      showFilter || selectedResources.size > 0
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    <Filter className="w-3 h-3" />
                  </button>
                )}
                {viewMode === "overview" && (
                  <button
                    onClick={() => setShowFilter(!showFilter)}
                    className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm ${
                      showFilter
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <Filter className="w-4 h-4" />
                    <span>Filter</span>
                    {selectedResources.size > 0 && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                        {selectedResources.size}
                      </span>
                    )}
                  </button>
                )}
              </div>
              
              {/* Mobile: Date picker + view mode buttons on right */}
              <div className="sm:hidden flex items-center gap-1">
                <div className="relative" ref={mobileDatePickerRef}>
                  <button 
                    className="px-2 py-1 border border-gray-300 rounded-lg bg-white text-xs text-gray-700 flex items-center gap-1"
                    onClick={handleDatePickerClick}
                  >
                    <span>{formattedDate}</span>
                    <Calendar className="w-3 h-3 text-gray-400" />
                  </button>
                  {showDatePicker && (
                    <div className="fixed left-1/2 transform -translate-x-1/2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-3" style={{ minWidth: "280px", top: "6.5rem" }}>
                      {/* Month Navigation */}
                      <div className="flex items-center justify-between mb-3">
                        <button
                          onClick={() => setDatePickerMonth(prev => subMonths(prev, 1))}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="text-sm font-medium text-gray-900">
                          {format(datePickerMonth, "MMMM yyyy", { locale: nb })}
                        </div>
                        <button
                          onClick={() => setDatePickerMonth(prev => addMonths(prev, 1))}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Day Labels */}
                      <div className="grid grid-cols-8 gap-0 mb-2">
                        <div className="text-[10px] text-gray-500 font-medium text-center py-1"></div>
                        {["ma", "ti", "on", "to", "fr", "lø", "sø"].map((day) => (
                          <div key={day} className="text-[10px] text-gray-500 font-medium text-center py-1">
                            {day}
                          </div>
                        ))}
                      </div>

                      {/* Calendar Grid */}
                      {(() => {
                        const monthStart = startOfMonth(datePickerMonth)
                        const monthEnd = endOfMonth(datePickerMonth)
                        const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
                        const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
                        const weeks: Date[][] = []
                        let currentWeekStart = calendarStart
                        while (currentWeekStart <= calendarEnd) {
                          const weekDays = eachDayOfInterval({ start: currentWeekStart, end: endOfWeek(currentWeekStart, { weekStartsOn: 1 }) })
                          weeks.push(weekDays)
                          currentWeekStart = addDays(currentWeekStart, 7)
                        }
                        return (
                          <div className="space-y-0">
                            {weeks.map((week, weekIndex) => (
                              <div key={weekIndex} className="grid grid-cols-8 gap-0">
                                <div className="text-[10px] text-gray-400 text-center py-1.5 font-medium">{getWeek(week[0], { weekStartsOn: 1 })}</div>
                                {week.map((day, dayIndex) => {
                                  const isCurrentMonth = isSameMonth(day, datePickerMonth)
                                  const isSelected = isSameDay(day, selectedDate)
                                  const isTodayDate = isToday(day)
                                  return (
                                    <button
                                      key={dayIndex}
                                      onClick={() => { setSelectedDate(day); setShowDatePicker(false) }}
                                      className={`text-xs py-1.5 rounded transition-colors ${
                                        isSelected ? "bg-blue-600 text-white" :
                                        isTodayDate ? "bg-blue-100 text-blue-700 font-medium" :
                                        isCurrentMonth ? "text-gray-900 hover:bg-gray-100" : "text-gray-400"
                                      }`}
                                    >
                                      {format(day, "d")}
                                    </button>
                                  )
                                })}
                              </div>
                            ))}
                          </div>
                        )
                      })()}

                      {/* Today button */}
                      <button onClick={() => { setSelectedDate(new Date()); setDatePickerMonth(new Date()); setShowDatePicker(false) }} className="mt-3 w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium">I dag</button>
                    </div>
                  )}
                </div>
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode("day")}
                    className={`px-1.5 py-1 text-[10px] transition-colors ${
                      viewMode === "day"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700"
                    }`}
                  >
                    Dag
                  </button>
                  <button
                    onClick={() => setViewMode("week")}
                    className={`px-1.5 py-1 text-[10px] transition-colors border-l border-gray-300 ${
                      viewMode === "week"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700"
                    }`}
                  >
                    Uke
                  </button>
                  <button
                    onClick={() => setViewMode("month")}
                    className={`px-1.5 py-1 text-[10px] transition-colors border-l border-gray-300 ${
                      viewMode === "month"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700"
                    }`}
                  >
                    Mnd
                  </button>
                  <button
                    onClick={() => setViewMode("overview")}
                    className={`px-1.5 py-1 text-[10px] transition-colors border-l border-gray-300 ${
                      viewMode === "overview"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700"
                    }`}
                  >
                    Alle
                  </button>
                </div>
              </div>
              
              {/* Desktop: Date Navigation with arrows */}
              <div className="hidden sm:flex items-center gap-4">
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
                
                <div className="hidden sm:flex items-center">
                  <div className="relative" ref={datePickerRef}>
                    <div className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-700 min-w-[140px] cursor-pointer flex items-center justify-between gap-1"
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
                    className="hidden sm:block px-3 sm:px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    I dag
                  </button>
                )}
                
                <div className="flex items-center gap-1 sm:gap-3">
                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                    <button
                      onClick={() => {
                        setViewMode("day")
                        setSelectedDate(new Date())
                      }}
                      className={`px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm transition-colors ${
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
                      className={`px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm transition-colors border-l border-gray-300 ${
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
                      className={`px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm transition-colors border-l border-gray-300 ${
                        viewMode === "month"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Mnd
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setViewMode("overview")
                      setSelectedDate(new Date())
                    }}
                    className={`px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm transition-colors border border-gray-300 rounded-lg hidden sm:block ${
                      viewMode === "overview"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Oversikt
                  </button>
                </div>

                {/* Save as default button - hidden on mobile */}
                {isLoggedIn && (
                  <button
                    onClick={savePreferences}
                    disabled={savingPreferences}
                    className={`hidden sm:block p-2 rounded-lg transition-all ${
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

          {/* Mobile Filter Panel */}
          {showMobileFilters && viewMode !== "overview" && (
            <div className="sm:hidden mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex flex-col gap-2">
                <select
                  value={selectedCategoryId || ""}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">Alle kategorier</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {availableResources.length > 0 && (
                  <select
                    value={selectedResourceId || ""}
                    onChange={(e) => handleResourceChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">Alle fasiliteter</option>
                    {availableResources.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                )}
                {selectedResource && selectedResource.parts.length > 0 && (
                  <select
                    value={selectedPartId || ""}
                    onChange={(e) => setSelectedPartId(e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">Alle deler</option>
                    {selectedResource.parts.map((part) => (
                      <option key={part.id} value={part.id}>{part.name}</option>
                    ))}
                  </select>
                )}
                {(selectedCategoryId || selectedResourceId || selectedPartId) && (
                  <button
                    onClick={() => {
                      setSelectedCategoryId(null)
                      setSelectedResourceId(null)
                      setSelectedPartId(null)
                    }}
                    className="text-sm text-red-600 py-1"
                  >
                    Nullstill filter
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Calendar View (Week/Month) - fills remaining space on mobile */}
          <div className="flex-1 min-h-0 md:flex-none">
          {viewMode === "week" ? (
            <div 
              className="bg-white md:rounded-xl border-y md:border border-gray-200 md:shadow-sm h-full md:h-auto"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div ref={weekViewScrollRef} className="h-full md:h-[calc(100vh-300px)] overflow-auto md:rounded-xl">
                <div className="min-w-0 md:min-w-[800px]">
                  {/* Calendar Header */}
                  <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200">
                    <div className="flex">
                      <div className="flex-shrink-0 w-8 sm:w-20 p-1 sm:p-3 font-medium text-gray-700 text-[8px] sm:text-sm border-r border-gray-200 bg-gray-50 flex items-center justify-center">
                        <span className="hidden sm:inline">Tid</span>
                      </div>
                      {viewDays.map((day, index) => (
                        <div
                          key={index}
                          className="flex-1 border-r border-gray-200 last:border-r-0 p-0.5 sm:p-3 text-center bg-gray-50"
                        >
                          <div className="text-[9px] sm:text-sm font-medium text-gray-900">
                            <span className="sm:hidden">{format(day, "EEEEE", { locale: nb })}</span>
                            <span className="hidden sm:inline">{format(day, "EEEE", { locale: nb })}</span>
                          </div>
                          <div className="text-[8px] sm:text-xs text-gray-600">
                            <span className="sm:hidden">{format(day, "d", { locale: nb })}</span>
                            <span className="hidden sm:inline">{format(day, "d. MMM", { locale: nb })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Calendar Body */}
                  <div className="flex">
                    {/* Time Labels */}
                    <div className="flex-shrink-0 w-8 sm:w-20 border-r border-gray-200 bg-gray-50" style={{ height: "1440px" }}>
                      {Array.from({ length: 24 }).map((_, hour) => (
                        <div key={hour} className="flex items-center justify-center border-b border-gray-100" style={{ height: "60px" }}>
                          <div className="text-[8px] sm:text-sm font-medium text-gray-700">
                            {format(setHours(startOfDay(selectedDate), hour), "HH")}
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
                              const isCompetition = booking.status === "competition"
                              const resourceColor = isCompetition ? "#f97316" : (booking.resource.color || booking.resource.category?.color || "#3b82f6")
                              
                              // Get column info for this booking
                              const columnInfo = bookingColumns.get(booking.id) || { column: 0, totalColumns: 1 }
                              const { column, totalColumns } = columnInfo
                              const isSingleBox = totalColumns === 1
                              
                              // Side by side layout for multiple bookings
                              const gapPx = 1
                              const widthPercent = 100 / totalColumns
                              const leftPercent = column * widthPercent
                              
                              // For single box: full width with margin. For multiple: side by side with gap
                              const boxWidth = isSingleBox 
                                ? 'calc(100% - 2px)' 
                                : `calc(${widthPercent}% - ${gapPx * 2}px)`
                              
                              const boxLeft = isSingleBox 
                                ? '1px' 
                                : `calc(${leftPercent}% + ${gapPx}px)`

                              // Check if there's a booking directly above or below this one (for border merging)
                              const bookingAbove = allDayBookings.find(b => {
                                if (b.id === booking.id) return false
                                const bEnd = parseISO(b.endTime)
                                const bColumnInfo = bookingColumns.get(b.id) || { column: 0, totalColumns: 1 }
                                // Check if booking ends exactly where this one starts (within same column)
                                return Math.abs(bEnd.getTime() - cappedStart.getTime()) < 60000 && bColumnInfo.column === column
                              })
                              const hasBookingAbove = !!bookingAbove
                              const hasPendingAbove = bookingAbove?.status === "pending"
                              
                              const bookingBelow = allDayBookings.find(b => {
                                if (b.id === booking.id) return false
                                const bStart = parseISO(b.startTime)
                                const bColumnInfo = bookingColumns.get(b.id) || { column: 0, totalColumns: 1 }
                                // Check if booking starts exactly where this one ends (within same column)
                                return Math.abs(bStart.getTime() - cappedEnd.getTime()) < 60000 && bColumnInfo.column === column
                              })
                              const hasBookingBelow = !!bookingBelow
                              const hasPendingBelow = bookingBelow?.status === "pending"

                              {/* Dynamic text based on box height:
                                  - Tiny (<30px): Nothing visible (rely on tooltip)
                                  - Small (<50px): Only title, truncated
                                  - Medium (<80px): Title + time
                                  - Large (>=80px): Full info
                              */}
                              const actualHeight = Math.max(heightPx, 20)
                              const isNarrow = totalColumns > 2
                              const showTime = actualHeight >= 50 && !isNarrow
                              const showResource = actualHeight >= 80 && !isNarrow
                              
                              // For pending: show single line between adjacent pending bookings
                              // Keep bottom border on this box, remove top border on box below (so we get one line, not two or zero)
                              const pendingBorderTop = isPending ? (hasPendingAbove ? 'none' : `2px dashed ${resourceColor}`) : undefined
                              const pendingBorderBottom = isPending ? `2px dashed ${resourceColor}` : undefined
                              
                              // Calculate border-radius: remove top corners where this box meets one above
                              // Bottom corners stay rounded since bottom border is always shown
                              const topLeftRadius = (isPending && hasPendingAbove) ? '0' : '6px'
                              const topRightRadius = (isPending && hasPendingAbove) ? '0' : '6px'
                              const borderRadiusStyle = `${topLeftRadius} ${topRightRadius} 6px 6px`
                              
                              return (
                                <div
                                  key={booking.id}
                                  onClick={() => !isCompetition && setSelectedBooking(booking)}
                                  className={`absolute px-1 sm:px-2 py-0.5 sm:py-1 text-xs pointer-events-auto transition-opacity overflow-hidden ${
                                    isPending ? 'cursor-pointer hover:opacity-90' : 
                                    isCompetition ? 'cursor-default' : 'cursor-pointer hover:opacity-90'
                                  }`}
                                  style={{
                                    top: `${topPx}px`,
                                    left: boxLeft,
                                    width: boxWidth,
                                    height: `${actualHeight}px`,
                                    minHeight: '20px',
                                    borderRadius: isPending ? borderRadiusStyle : '6px',
                                    backgroundColor: isCompetition 
                                      ? '#fdba74' 
                                      : isPending 
                                        ? `${resourceColor}20`
                                        : resourceColor,
                                    color: isCompetition ? '#9a3412' : 'black',
                                    borderTop: isPending ? pendingBorderTop : isCompetition ? '2px solid #f97316' : hasBookingAbove ? '1px solid rgba(0,0,0,0.3)' : '1px solid black',
                                    borderBottom: isPending ? pendingBorderBottom : isCompetition ? '2px solid #f97316' : hasBookingBelow ? '1px solid rgba(0,0,0,0.3)' : '1px solid black',
                                    borderLeft: isPending ? `2px dashed ${resourceColor}` : isCompetition ? '2px solid #f97316' : '1px solid black',
                                    borderRight: isPending ? `2px dashed ${resourceColor}` : isCompetition ? '2px solid #f97316' : '1px solid black',
                                    boxShadow: isPending ? 'none' : '0 1px 2px rgba(0,0,0,0.15)',
                                    zIndex: 10 + (totalColumns - column),
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'flex-start',
                                    alignItems: 'flex-start'
                                  }}
                                  title={`${format(start, "HH:mm")}-${format(end, "HH:mm")} ${booking.title} - ${booking.resource.name}${booking.resourcePart?.name ? ` (${booking.resourcePart.name})` : ''}${isPending ? ' (venter på godkjenning)' : isCompetition ? ' (konkurranse)' : ''}`}
                                >
                                  <p className="font-medium text-[7px] sm:text-[10px] leading-tight w-full truncate">{booking.title}</p>
                                  {showTime && (
                                    <p className={`text-[6px] sm:text-[9px] leading-tight w-full truncate ${isPending ? 'opacity-70' : 'opacity-80'}`}>
                                      {format(start, "HH:mm")}-{format(end, "HH:mm")}
                                    </p>
                                  )}
                                  {showResource && (
                                    <p className={`text-[5px] sm:text-[8px] leading-tight w-full truncate ${isPending ? 'opacity-60' : 'opacity-70'}`}>
                                      {booking.resourcePart?.name || booking.resource.name}
                                    </p>
                                  )}
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
            <div 
              className="bg-white md:rounded-xl border-y md:border border-gray-200 md:shadow-sm overflow-hidden h-full md:h-[calc(100vh-300px)] flex flex-col"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Calendar Header */}
              <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200 flex-shrink-0">
                {["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"].map((day, i) => (
                  <div key={day} className="p-1 sm:p-3 text-center text-[10px] sm:text-sm font-medium text-gray-500">
                    <span className="sm:hidden">{day}</span>
                    <span className="hidden sm:inline">{["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"][i]}</span>
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
                      className={`p-0.5 sm:p-2 border-b border-r border-gray-100 min-h-0 ${
                        index % 7 === 0 ? 'border-l-0' : ''
                      } ${!isCurrentMonth ? 'bg-gray-50/50' : ''} ${
                        isToday(day) ? 'bg-blue-50' : ''
                      }`}
                      style={{ display: "flex", flexDirection: "column" }}
                    >
                      <p className={`text-[10px] sm:text-sm font-medium mb-0.5 sm:mb-1 flex-shrink-0 ${
                        isToday(day) 
                          ? 'text-blue-600' 
                          : isCurrentMonth 
                            ? 'text-gray-900' 
                            : 'text-gray-400'
                      }`}>
                        {format(day, "d")}
                      </p>
                      <div className="space-y-0.5 sm:space-y-1 flex-1 overflow-y-auto min-h-0">
                        {dayBookings.map((booking) => {
                          const isPending = booking.status === "pending"
                          const isCompetition = booking.status === "competition"
                          const bookingColor = isCompetition ? "#f97316" : (booking.resource.color || booking.resource.category?.color || "#3b82f6")
                          
                          return (
                            <div
                              key={booking.id}
                              onClick={() => !isCompetition && setSelectedBooking(booking)}
                              className={`px-0.5 sm:px-1.5 py-0.5 rounded text-[8px] sm:text-xs transition-opacity flex-shrink-0 flex flex-col ${
                                isPending 
                                  ? "bg-green-50 text-green-700 border border-dashed border-green-400 cursor-pointer hover:opacity-90" 
                                  : isCompetition
                                    ? "bg-orange-100 text-orange-800 border-2 border-orange-500 cursor-default"
                                    : "text-black border border-black cursor-pointer hover:opacity-90"
                              }`}
                              style={!isPending && !isCompetition ? { 
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
                              title={`${format(parseISO(booking.startTime), "HH:mm")}-${format(parseISO(booking.endTime), "HH:mm")} ${booking.title} - ${booking.resource.name}${booking.resourcePart?.name ? ` (${booking.resourcePart.name})` : ''}${isPending ? ' (venter på godkjenning)' : isCompetition ? ' (konkurranse)' : ''}`}
                            >
                              <p className="font-medium text-[7px] sm:text-xs leading-tight w-full overflow-hidden">{booking.title}</p>
                              <p className={`text-[6px] sm:text-[10px] leading-tight w-full overflow-hidden ${isPending ? 'opacity-70' : 'opacity-80'}`}>
                                {format(parseISO(booking.startTime), "HH:mm")}-{format(parseISO(booking.endTime), "HH:mm")} {booking.resourcePart?.name || booking.resource.name}
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
          ) : viewMode === "overview" ? (
          /* Overview View - Timeline Style */
          !timelineData ? (
            <div className="card p-12 text-center">
              <GanttChart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Laster data...</p>
            </div>
          ) : (
            <>
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

              {/* Timeline View */}
              {groupedData.length === 0 ? (
                <div className="card p-12 text-center">
                  <GanttChart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Ingen bookinger for denne dagen</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl sm:rounded-xl border border-gray-200 shadow-sm">
                  {/* Scrollable container with sticky header */}
                  <div ref={timelineContainerRef} className="max-h-[calc(100dvh-10rem)] sm:max-h-[calc(100vh-300px)] overflow-y-auto overflow-x-auto rounded-xl relative">
                    {/* Time Header - sticky within scroll container */}
                    <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200">
                      <div className="flex" style={{ minWidth: '1200px' }}>
                        <div className="w-36 sm:w-64 flex-shrink-0 p-1.5 sm:p-3 font-medium text-gray-700 text-[10px] sm:text-sm border-r border-gray-200 bg-gray-50">
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
                                <Link 
                                  href={`/resources/${resource.id}`}
                                  className="w-36 sm:w-64 flex-shrink-0 p-1.5 sm:p-3 border-r border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                                >
                                  <div className="font-semibold text-gray-900 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-base">
                                    {resource.category && (
                                      <div
                                        className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: resource.category.color || "#6b7280" }}
                                      />
                                    )}
                                    <span className="truncate hover:text-blue-600 transition-colors">{resource.name}</span>
                                  </div>
                                  {resource.category && (
                                    <div className="hidden sm:block text-xs text-gray-500 mt-1 truncate">
                                      {resource.category.name}
                                    </div>
                                  )}
                                </Link>
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
                            {parts.map(({ part, bookings, isChild }) => (
                              <div
                                key={part ? part.id : `whole-${resource.id}`}
                                className="flex border-b border-gray-100 hover:bg-gray-50 transition-colors"
                              >
                                {/* Part Label */}
                                <div className="w-36 sm:w-64 flex-shrink-0 p-1 sm:p-3 border-r border-gray-200">
                                  <div className={`text-[10px] sm:text-sm text-gray-700 ${isChild ? 'pl-2 sm:pl-5' : ''}`}>
                                    {part ? (
                                      <span className={`truncate block flex items-center gap-1 ${isChild ? 'text-gray-500' : 'text-gray-600'}`}>
                                        {isChild && <span className="text-gray-300 text-[8px] sm:text-base">└</span>}
                                        {part.name}
                                      </span>
                                    ) : (
                                      <span className="font-medium text-gray-900">Hele</span>
                                    )}
                                  </div>
                                </div>

                                {/* Timeline Bar Area */}
                                <div className="flex-1 relative" style={{ minHeight: "36px" }}>
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
                                          <span className="text-[7px] sm:text-[10px] font-medium">Blokkert</span>
                                        </div>
                                      </div>
                                    )
                                  })}

                                  {/* Bookings */}
                                  {bookings.map((booking) => {
                                    const style = getBookingStyle(booking, bookings)
                                    const isPending = booking.status === "pending"
                                    const isCompetition = booking.status === "competition"
                                    const color = isCompetition ? "#f97316" : (resource.color || resource.category?.color || "#3b82f6")
                                    const startTime = parseISO(booking.startTime)
                                    const endTime = parseISO(booking.endTime)
                                    const timeStr = `${format(startTime, "HH:mm")} - ${format(endTime, "HH:mm")}`
                                    
                                    return (
                                      <button
                                        key={booking.id}
                                        onClick={() => !isCompetition && setSelectedBooking(booking)}
                                        className={`absolute top-1 bottom-1 rounded px-2 py-1 text-xs font-medium transition-all overflow-hidden text-left ${
                                          isCompetition 
                                            ? 'cursor-default' 
                                            : 'cursor-pointer hover:shadow-lg hover:scale-[1.02]'
                                        }`}
                                        style={{
                                          ...style,
                                          backgroundColor: isCompetition ? '#fdba74' : (isPending ? `${color}80` : color),
                                          border: isCompetition ? '2px solid #f97316' : (isPending ? `2px dashed ${color}` : 'none'),
                                          color: isCompetition ? '#9a3412' : 'white',
                                        }}
                                        title={isCompetition ? `${booking.title} (konkurranse)` : `Klikk for mer info`}
                                      >
                                        <div className="font-semibold text-[7px] sm:text-xs leading-tight overflow-hidden">{booking.title}</div>
                                        <div className="text-[6px] sm:text-[10px] leading-tight opacity-90 overflow-hidden">
                                          {timeStr}
                                        </div>
                                        {!isCompetition && booking.user?.name && (
                                          <div className="text-[6px] sm:text-[10px] leading-tight opacity-75 overflow-hidden">
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
            </>
          )
          ) : (
          /* Day View - Calendar Style */
          !timelineData ? (
            <div className="card p-12 text-center">
              <GanttChart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Laster data...</p>
            </div>
          ) : (
            <div 
              className="bg-white md:rounded-xl border-y md:border border-gray-200 md:shadow-sm h-full md:h-auto"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="h-full md:h-[calc(100vh-300px)] overflow-hidden md:overflow-x-auto rounded-xl flex flex-col">
                {/* Calendar Header */}
                <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 flex-shrink-0">
                  <div className="flex">
                    <div className="flex-shrink-0 w-12 sm:w-20 p-1 sm:p-3 font-medium text-gray-700 text-[10px] sm:text-sm border-r border-gray-200 bg-gray-50 text-center">
                      Tid
                    </div>
                    <div className="flex-1 border-r border-gray-200 last:border-r-0 p-1 sm:p-3 text-center bg-gray-50">
                      <div className="text-xs sm:text-sm font-medium text-gray-900">
                        {format(selectedDate, "EEE", { locale: nb })}
                      </div>
                      <div className="text-[10px] text-gray-600">
                        {format(selectedDate, "d. MMM", { locale: nb })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Calendar Body - Single row showing entire day */}
                <div ref={dayViewScrollRef} className="overflow-y-auto flex-1 min-h-0">
                  <div className="flex">
                    {/* Time Labels */}
                    <div className="flex-shrink-0 w-12 sm:w-20 border-r border-gray-200 bg-gray-50" style={{ height: "1440px" }}>
                      {Array.from({ length: 24 }).map((_, hour) => (
                        <div key={hour} className="flex items-center justify-center border-b border-gray-100" style={{ height: "60px" }}>
                          <div className="text-[10px] sm:text-sm font-medium text-gray-700">
                            {format(setHours(startOfDay(selectedDate), hour), "HH")}
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
                          const isCompetition = booking.status === "competition"
                          const resourceColor = isCompetition ? "#f97316" : (booking.resource.color || booking.resource.category?.color || "#3b82f6")
                          
                          // Get column info for this booking
                          const columnInfo = bookingColumns.get(booking.id) || { column: 0, totalColumns: 1 }
                          const { column, totalColumns } = columnInfo
                          const isSingleBox = totalColumns === 1
                          
                          // Side by side layout for multiple bookings
                          const gapPx = 1
                          const widthPercent = 100 / totalColumns
                          const leftPercent = column * widthPercent
                          
                          // For single box: full width with margin. For multiple: side by side with gap
                          const boxWidth = isSingleBox 
                            ? 'calc(100% - 2px)' 
                            : `calc(${widthPercent}% - ${gapPx * 2}px)`
                          
                          const boxLeft = isSingleBox 
                            ? '1px' 
                            : `calc(${leftPercent}% + ${gapPx}px)`

                          // Check if there's a booking directly above or below this one (for border merging)
                          const bookingAboveDay = dayBookings.find(b => {
                            if (b.id === booking.id) return false
                            const bEnd = parseISO(b.endTime)
                            const bColumnInfo = bookingColumns.get(b.id) || { column: 0, totalColumns: 1 }
                            return Math.abs(bEnd.getTime() - cappedStart.getTime()) < 60000 && bColumnInfo.column === column
                          })
                          const hasBookingAbove = !!bookingAboveDay
                          const hasPendingAbove = bookingAboveDay?.status === "pending"
                          
                          const bookingBelowDay = dayBookings.find(b => {
                            if (b.id === booking.id) return false
                            const bStart = parseISO(b.startTime)
                            const bColumnInfo = bookingColumns.get(b.id) || { column: 0, totalColumns: 1 }
                            return Math.abs(bStart.getTime() - cappedEnd.getTime()) < 60000 && bColumnInfo.column === column
                          })
                          const hasBookingBelow = !!bookingBelowDay
                          const hasPendingBelow = bookingBelowDay?.status === "pending"

                          {/* Dynamic text based on box height - Day view */}
                          const actualHeight = Math.max(heightPx, 20)
                          const isNarrow = totalColumns > 2
                          const showTime = actualHeight >= 50 && !isNarrow
                          const showResource = actualHeight >= 80 && !isNarrow
                          
                          // For pending: show single line between adjacent pending bookings
                          // Keep bottom border on this box, remove top border on box below (so we get one line, not two or zero)
                          const pendingBorderTopDay = isPending ? (hasPendingAbove ? 'none' : `2px dashed ${resourceColor}`) : undefined
                          const pendingBorderBottomDay = isPending ? `2px dashed ${resourceColor}` : undefined
                          
                          // Calculate border-radius: remove top corners where this box meets one above
                          // Bottom corners stay rounded since bottom border is always shown
                          const topLeftRadiusDay = (isPending && hasPendingAbove) ? '0' : '6px'
                          const topRightRadiusDay = (isPending && hasPendingAbove) ? '0' : '6px'
                          const borderRadiusStyleDay = `${topLeftRadiusDay} ${topRightRadiusDay} 6px 6px`
                          
                          return (
                            <div
                              key={booking.id}
                              onClick={() => !isCompetition && setSelectedBooking(booking)}
                              className={`absolute px-1 sm:px-2 py-0.5 sm:py-1 text-xs pointer-events-auto transition-opacity overflow-hidden ${
                                isPending ? 'cursor-pointer hover:opacity-90' : 
                                isCompetition ? 'cursor-default' : 'cursor-pointer hover:opacity-90'
                              }`}
                              style={{
                                top: `${topPx}px`,
                                left: boxLeft,
                                width: boxWidth,
                                height: `${actualHeight}px`,
                                minHeight: '20px',
                                borderRadius: isPending ? borderRadiusStyleDay : '6px',
                                backgroundColor: isCompetition 
                                  ? '#fdba74' 
                                  : isPending 
                                    ? `${resourceColor}20`
                                    : resourceColor,
                                color: isCompetition ? '#9a3412' : 'black',
                                borderTop: isPending ? pendingBorderTopDay : isCompetition ? '2px solid #f97316' : hasBookingAbove ? '1px solid rgba(0,0,0,0.3)' : '1px solid black',
                                borderBottom: isPending ? pendingBorderBottomDay : isCompetition ? '2px solid #f97316' : hasBookingBelow ? '1px solid rgba(0,0,0,0.3)' : '1px solid black',
                                borderLeft: isPending ? `2px dashed ${resourceColor}` : isCompetition ? '2px solid #f97316' : '1px solid black',
                                borderRight: isPending ? `2px dashed ${resourceColor}` : isCompetition ? '2px solid #f97316' : '1px solid black',
                                boxShadow: isPending ? 'none' : '0 1px 2px rgba(0,0,0,0.15)',
                                zIndex: 10 + (totalColumns - column),
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'flex-start',
                                alignItems: 'flex-start'
                              }}
                              title={`${format(start, "HH:mm")}-${format(end, "HH:mm")} ${booking.title} - ${booking.resource.name}${booking.resourcePart?.name ? ` (${booking.resourcePart.name})` : ''}${isPending ? ' (venter på godkjenning)' : isCompetition ? ' (konkurranse)' : ''}`}
                            >
                              <p className="font-medium text-[7px] sm:text-[10px] leading-tight w-full truncate">{booking.title}</p>
                              {showTime && (
                                <p className={`text-[6px] sm:text-[9px] leading-tight w-full truncate ${isPending ? 'opacity-70' : 'opacity-80'}`}>
                                  {format(start, "HH:mm")}-{format(end, "HH:mm")}
                                </p>
                              )}
                              {showResource && (
                                <p className={`text-[5px] sm:text-[8px] leading-tight w-full truncate ${isPending ? 'opacity-60' : 'opacity-70'}`}>
                                  {booking.resourcePart?.name || booking.resource.name}
                                </p>
                              )}
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
                {/* GDPR: Show user info to admins/moderators OR if it's your own booking */}
                {(canManageBookings || selectedBooking.userId === session?.user?.id) && selectedBooking.user?.name && (
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
                // Ingen handlingsknapper for denne bookingen - footer er tom
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
    </PageLayout>
  )
}
