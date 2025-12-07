"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { 
  format, 
  startOfWeek, 
  addDays, 
  addWeeks, 
  subWeeks,
  isSameDay,
  parseISO,
  isToday
} from "date-fns"
import { nb } from "date-fns/locale"

interface Booking {
  id: string
  title: string
  startTime: string
  endTime: string
  status: string
  resourcePartName?: string | null
}

interface Part {
  id: string
  name: string
}

interface Props {
  resourceId: string
  bookings: Booking[]
  parts: Part[]
}

export function ResourceCalendar({ bookings, parts }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedPart, setSelectedPart] = useState<string | null>(null)

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const hours = Array.from({ length: 16 }, (_, i) => i + 7) // 07:00 - 22:00

  const filteredBookings = useMemo(() => {
    return bookings.filter(booking => {
      if (selectedPart && booking.resourcePartName !== selectedPart) {
        return false
      }
      const bookingDate = parseISO(booking.startTime)
      return weekDays.some(day => isSameDay(day, bookingDate))
    })
  }, [bookings, selectedPart, weekDays])

  const getBookingsForDayAndHour = (day: Date, hour: number) => {
    return filteredBookings.filter(booking => {
      const start = parseISO(booking.startTime)
      const end = parseISO(booking.endTime)
      
      if (!isSameDay(day, start)) return false
      
      const startHour = start.getHours()
      const endHour = end.getHours() + (end.getMinutes() > 0 ? 1 : 0)
      
      return hour >= startHour && hour < endHour
    })
  }

  const getBookingStyle = (booking: Booking, hour: number) => {
    const start = parseISO(booking.startTime)
    const end = parseISO(booking.endTime)
    const startHour = start.getHours()
    const startMinute = start.getMinutes()
    
    const isFirstHour = hour === startHour
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60)
    const heightMultiplier = durationMinutes / 60

    if (!isFirstHour) return null

    return {
      top: `${(startMinute / 60) * 100}%`,
      height: `${heightMultiplier * 100}%`,
      minHeight: '48px'
    }
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="font-semibold text-gray-900 min-w-[200px] text-center">
            {format(weekStart, "d. MMMM", { locale: nb })} - {format(addDays(weekStart, 6), "d. MMMM yyyy", { locale: nb })}
          </h3>
          <button
            onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
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

      {/* Calendar grid */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
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

        {/* Time slots */}
        <div className="max-h-[600px] overflow-y-auto">
          {hours.map((hour) => (
            <div key={hour} className="grid grid-cols-8 border-b border-gray-100 last:border-b-0">
              <div className="p-2 text-right text-xs text-gray-400 pr-3">
                {hour.toString().padStart(2, "0")}:00
              </div>
              {weekDays.map((day) => {
                const dayBookings = getBookingsForDayAndHour(day, hour)
                return (
                  <div 
                    key={`${day.toISOString()}-${hour}`} 
                    className={`relative min-h-[48px] border-l border-gray-100 ${
                      isToday(day) ? 'bg-blue-50/30' : ''
                    }`}
                  >
                    {dayBookings.map((booking) => {
                      const style = getBookingStyle(booking, hour)
                      if (!style) return null

                      return (
                        <div
                          key={booking.id}
                          className={`booking-block ${
                            booking.status === "approved" ? "booking-approved" : "booking-pending"
                          }`}
                          style={style}
                          title={`${booking.title}${booking.resourcePartName ? ` (${booking.resourcePartName})` : ''}`}
                        >
                          <p className="font-medium truncate text-xs">{booking.title}</p>
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

      {/* Legend */}
      <div className="flex items-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded booking-approved" />
          <span className="text-gray-600">Godkjent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded booking-pending" />
          <span className="text-gray-600">Venter på godkjenning</span>
        </div>
      </div>
    </div>
  )
}

