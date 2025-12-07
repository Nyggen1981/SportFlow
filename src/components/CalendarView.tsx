"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight, List, Grid3X3 } from "lucide-react"
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

interface Resource {
  id: string
  name: string
  color: string
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
}

interface Props {
  resources: Resource[]
  bookings: Booking[]
}

type ViewMode = "week" | "month"

export function CalendarView({ resources, bookings }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [selectedResource, setSelectedResource] = useState<string | null>(null)

  const filteredBookings = useMemo(() => {
    if (!selectedResource) return bookings
    return bookings.filter(b => b.resourceId === selectedResource)
  }, [bookings, selectedResource])

  // Week view data
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const hours = Array.from({ length: 16 }, (_, i) => i + 7)

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

  const navigate = (direction: "prev" | "next") => {
    if (viewMode === "week") {
      setCurrentDate(direction === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1))
    } else {
      setCurrentDate(direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1))
    }
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("prev")}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
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

        <div className="flex items-center gap-3">
          {/* Resource filter */}
          <select
            value={selectedResource || ""}
            onChange={(e) => setSelectedResource(e.target.value || null)}
            className="input max-w-[200px]"
          >
            <option value="">Alle fasiliteter</option>
            {resources.map(resource => (
              <option key={resource.id} value={resource.id}>{resource.name}</option>
            ))}
          </select>

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

      {/* Week View */}
      {viewMode === "week" && (
        <div className="card overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-8 bg-gray-50 border-b border-gray-200">
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

          {/* Time grid */}
          <div className="max-h-[600px] overflow-y-auto">
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b border-gray-100 last:border-b-0">
                <div className="p-2 text-right text-xs text-gray-400 pr-3">
                  {hour.toString().padStart(2, "0")}:00
                </div>
                {weekDays.map((day) => {
                  // Get bookings that overlap with this hour
                  const dayBookings = getBookingsForDay(day).filter(b => {
                    const start = parseISO(b.startTime)
                    const end = parseISO(b.endTime)
                    const startHour = start.getHours()
                    const endHour = end.getHours() + (end.getMinutes() > 0 ? 1 : 0)
                    return hour >= startHour && hour < endHour
                  })
                  
                  // Only render bookings that START in this hour (to avoid duplicates)
                  const bookingsStartingThisHour = dayBookings.filter(b => {
                    const start = parseISO(b.startTime)
                    return start.getHours() === hour
                  })
                  
                  return (
                    <div 
                      key={`${day.toISOString()}-${hour}`} 
                      className={`relative min-h-[48px] border-l border-gray-100 ${
                        isToday(day) ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {bookingsStartingThisHour.map((booking) => {
                        const start = parseISO(booking.startTime)
                        const end = parseISO(booking.endTime)
                        const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
                        const top = (start.getMinutes() / 60) * 100
                        const isPending = booking.status === "pending"
                        const resourceColor = getResourceColor(booking.resourceId)

                        return (
                          <div
                            key={booking.id}
                            className={`absolute left-1 right-1 rounded-md px-2 py-1 text-xs overflow-hidden cursor-pointer transition-transform hover:scale-[1.02] hover:z-10 ${
                              isPending ? 'border-2 border-dashed' : ''
                            }`}
                            style={{
                              top: `${top}%`,
                              height: `${Math.max(duration * 100, 100)}%`,
                              minHeight: '40px',
                              backgroundColor: isPending 
                                ? `${resourceColor}20`
                                : resourceColor,
                              borderColor: isPending ? resourceColor : 'transparent',
                              color: isPending ? resourceColor : 'white'
                            }}
                            title={`${format(start, "HH:mm")}-${format(end, "HH:mm")} ${booking.title} - ${booking.resourceName}${booking.resourcePartName ? ` (${booking.resourcePartName})` : ''}${isPending ? ' (venter på godkjenning)' : ''}`}
                          >
                            <p className="font-medium truncate">{booking.title}</p>
                            <p className={`truncate text-[10px] ${isPending ? 'opacity-70' : 'opacity-80'}`}>{booking.resourceName}</p>
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
                          className={`text-xs px-1.5 py-0.5 rounded truncate ${
                            isPending ? 'border border-dashed' : ''
                          }`}
                          style={{
                            backgroundColor: isPending 
                              ? `${resourceColor}20`
                              : resourceColor,
                            borderColor: isPending ? resourceColor : 'transparent',
                            color: isPending ? resourceColor : 'white'
                          }}
                          title={`${format(parseISO(booking.startTime), "HH:mm")} ${booking.title}${isPending ? ' (venter)' : ''}`}
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

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-gray-500">Fasiliteter:</span>
        {resources.map((resource) => (
          <div key={resource.id} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded" 
              style={{ backgroundColor: resource.color }}
            />
            <span className="text-gray-600">{resource.name}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-200">
          <div className="w-4 h-3 rounded border-2 border-dashed border-gray-400 bg-gray-100" />
          <span className="text-gray-600">Venter på godkjenning</span>
        </div>
      </div>
    </div>
  )
}

