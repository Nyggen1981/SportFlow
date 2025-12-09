"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight, List, Grid3X3, Calendar, Clock, MapPin, Filter, Check, X, ChevronDown } from "lucide-react"
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

interface Resource {
  id: string
  name: string
  color: string
  categoryId: string | null
  categoryName?: string | null
}

interface Booking {
  id: string
  title: string
  startTime: string
  endTime: string
  resourceId: string
  resourceName: string
  resourcePartName?: string | null
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
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(categories.map(c => c.id)))
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set(resources.map(r => r.id)))
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [showFilterPanel, setShowFilterPanel] = useState(false)

  // Filter resources by selected categories first, then by selected resources
  const visibleResources = useMemo(() => {
    return resources.filter(r => {
      // If resource has no category, show it if "Ukategorisert" is selected or if all categories are selected
      if (!r.categoryId) {
        return selectedCategories.has('uncategorized') || selectedCategories.size === categories.length + 1
      }
      return selectedCategories.has(r.categoryId) && selectedResources.has(r.id)
    })
  }, [resources, selectedCategories, selectedResources, categories.length])

  const filteredBookings = useMemo(() => {
    const visibleResourceIds = new Set(visibleResources.map(r => r.id))
    return bookings.filter(b => visibleResourceIds.has(b.resourceId) && selectedResources.has(b.resourceId))
  }, [bookings, visibleResources, selectedResources])

  // Week view data
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const hours = Array.from({ length: 16 }, (_, i) => i + 7)

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

  const toggleCategory = (categoryId: string) => {
    const newSelected = new Set(selectedCategories)
    if (newSelected.has(categoryId)) {
      newSelected.delete(categoryId)
      // Also deselect all resources in this category
      resources.filter(r => r.categoryId === categoryId || (categoryId === 'uncategorized' && !r.categoryId))
        .forEach(r => selectedResources.delete(r.id))
      setSelectedResources(new Set(selectedResources))
    } else {
      newSelected.add(categoryId)
      // Also select all resources in this category
      const newResources = new Set(selectedResources)
      resources.filter(r => r.categoryId === categoryId || (categoryId === 'uncategorized' && !r.categoryId))
        .forEach(r => newResources.add(r.id))
      setSelectedResources(newResources)
    }
    setSelectedCategories(newSelected)
  }

  const toggleResource = (resourceId: string) => {
    const newSelected = new Set(selectedResources)
    if (newSelected.has(resourceId)) {
      newSelected.delete(resourceId)
    } else {
      newSelected.add(resourceId)
    }
    setSelectedResources(newSelected)
  }

  const selectAll = () => {
    setSelectedCategories(new Set([...categories.map(c => c.id), 'uncategorized']))
    setSelectedResources(new Set(resources.map(r => r.id)))
  }
  
  const selectNone = () => {
    setSelectedCategories(new Set())
    setSelectedResources(new Set())
  }

  // Group resources by category
  const resourcesByCategory = useMemo(() => {
    const grouped: { [key: string]: { category: Category | null, resources: Resource[] } } = {}
    
    // Initialize with categories
    categories.forEach(c => {
      grouped[c.id] = { category: c, resources: [] }
    })
    
    // Add uncategorized
    grouped['uncategorized'] = { category: null, resources: [] }
    
    // Group resources
    resources.forEach(r => {
      const key = r.categoryId || 'uncategorized'
      if (grouped[key]) {
        grouped[key].resources.push(r)
      }
    })
    
    // Filter out empty categories
    return Object.entries(grouped).filter(([_, v]) => v.resources.length > 0)
  }, [categories, resources])

  const activeFilterCount = resources.length - selectedResources.size

  // Resources to show in legend (only selected ones)
  const legendResources = resources.filter(r => selectedResources.has(r.id))

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
          {/* Navigation */}
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

          {/* View controls */}
          <div className="flex items-center gap-2">
            {/* Filter button */}
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                showFilterPanel || activeFilterCount > 0
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filter
              {activeFilterCount > 0 && (
                <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilterPanel ? 'rotate-180' : ''}`} />
            </button>

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

        {/* Filter panel */}
        {showFilterPanel && (
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-700">Filtrer visning</span>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Velg alle
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={selectNone}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Fjern alle
                </button>
              </div>
            </div>

            {/* Categories and resources */}
            <div className="space-y-4">
              {resourcesByCategory.map(([categoryId, { category, resources: catResources }]) => (
                <div key={categoryId} className="space-y-2">
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(categoryId)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all w-full ${
                      selectedCategories.has(categoryId)
                        ? 'bg-white shadow-sm border border-gray-200'
                        : 'bg-gray-200/50 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    <div 
                      className={`w-5 h-5 rounded flex items-center justify-center ${
                        selectedCategories.has(categoryId) ? '' : 'bg-gray-300'
                      }`}
                      style={selectedCategories.has(categoryId) ? { 
                        backgroundColor: category?.color || '#6b7280' 
                      } : undefined}
                    >
                      {selectedCategories.has(categoryId) && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <span style={selectedCategories.has(categoryId) ? { color: category?.color || '#374151' } : undefined}>
                      {category?.name || 'Ukategorisert'}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {catResources.filter(r => selectedResources.has(r.id)).length}/{catResources.length}
                    </span>
                  </button>

                  {/* Resources in category */}
                  {selectedCategories.has(categoryId) && (
                    <div className="flex flex-wrap gap-2 pl-4">
                      {catResources.map((resource) => {
                        const isSelected = selectedResources.has(resource.id)
                        return (
                          <button
                            key={resource.id}
                            onClick={() => toggleResource(resource.id)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              isSelected 
                                ? 'bg-white shadow-sm border' 
                                : 'bg-gray-200/50 text-gray-500 hover:bg-gray-200'
                            }`}
                            style={isSelected ? { 
                              borderColor: resource.color,
                              color: resource.color
                            } : undefined}
                          >
                            <div 
                              className={`w-3 h-3 rounded-full ${isSelected ? '' : 'bg-gray-300'}`}
                              style={isSelected ? { backgroundColor: resource.color } : undefined}
                            />
                            {resource.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {selectedResources.size === 0 && (
              <p className="text-sm text-amber-600 mt-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Ingen fasiliteter valgt - kalenderen er tom
              </p>
            )}
          </div>
        )}
      </div>

      {/* Active filters summary (when panel is closed) */}
      {!showFilterPanel && activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">Viser:</span>
          {legendResources.slice(0, 5).map((resource) => (
            <span
              key={resource.id}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: resource.color }}
            >
              {resource.name}
              <button
                onClick={() => toggleResource(resource.id)}
                className="hover:bg-white/20 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {legendResources.length > 5 && (
            <span className="text-xs text-gray-500">+{legendResources.length - 5} til</span>
          )}
          <button
            onClick={selectAll}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium ml-2"
          >
            Vis alle
          </button>
        </div>
      )}

      {/* Week View */}
      {viewMode === "week" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Time grid with sticky header */}
          <div className="max-h-[650px] overflow-y-auto">
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
                        const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
                        const top = (start.getMinutes() / 60) * 100
                        const resourceColor = getResourceColor(booking.resourceId)

                        return (
                          <button
                            key={booking.id}
                            onClick={() => setSelectedBooking(booking)}
                            className="absolute left-0.5 right-0.5 rounded px-1.5 py-1 text-xs overflow-hidden cursor-pointer z-10 pointer-events-auto text-left booking-event"
                            style={{
                              top: `${top}%`,
                              height: `${Math.max(duration * 100, 100)}%`,
                              minHeight: '40px',
                              backgroundColor: resourceColor,
                              color: 'white'
                            }}
                          >
                            <p className="font-semibold truncate text-[11px]">{booking.title}</p>
                            <p className="truncate text-[9px] opacity-80">
                              {format(start, "HH:mm")}-{format(end, "HH:mm")}
                            </p>
                          </button>
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

      {/* Compact legend - only show selected resources */}
      {legendResources.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
          <span className="font-medium">Farger:</span>
          {legendResources.map((resource) => (
            <span key={resource.id} className="flex items-center gap-1">
              <span 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ backgroundColor: resource.color }}
              />
              {resource.name}
            </span>
          ))}
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
