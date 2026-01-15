"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { format, addDays, subDays, startOfWeek, eachDayOfInterval, isSameDay, isToday } from "date-fns"
import { nb } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import Link from "next/link"

interface Booking {
  id: string
  title: string
  startTime: string
  endTime: string
  status: string
  resource: {
    id: string
    name: string
    category?: {
      color: string | null
    } | null
  }
  resourcePart?: {
    name: string
  } | null
}

interface MobileCalendarProps {
  onBookingClick?: (booking: Booking) => void
}

export function MobileCalendar({ onBookingClick }: MobileCalendarProps) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Get week days for horizontal scroll
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({
    start: subDays(weekStart, 7),
    end: addDays(weekStart, 13),
  })

  // Fetch bookings for selected date
  const fetchBookings = useCallback(async () => {
    setIsLoading(true)
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd")
      const res = await fetch(`/api/timeline?date=${dateStr}`)
      if (res.ok) {
        const data = await res.json()
        setBookings(data.bookings || [])
      }
    } catch (error) {
      console.error("Error fetching bookings:", error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  // Filter bookings for selected date
  const dayBookings = bookings.filter((b) => {
    const bookingDate = new Date(b.startTime)
    return isSameDay(bookingDate, selectedDate)
  }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  // Navigate dates
  const goToPreviousDay = () => setSelectedDate((d) => subDays(d, 1))
  const goToNextDay = () => setSelectedDate((d) => addDays(d, 1))
  const goToToday = () => setSelectedDate(new Date())

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Month/Year header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button
          onClick={goToPreviousDay}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">
            {format(selectedDate, "MMMM yyyy", { locale: nb })}
          </h2>
          {!isToday(selectedDate) && (
            <button
              onClick={goToToday}
              className="text-xs text-teal-600 font-medium"
            >
              Gå til i dag
            </button>
          )}
        </div>
        
        <button
          onClick={goToNextDay}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Horizontal date picker */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto scrollbar-hide py-3 px-2 border-b border-gray-100 gap-1"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {weekDays.map((day) => {
          const isSelected = isSameDay(day, selectedDate)
          const isDayToday = isToday(day)

          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDate(day)}
              className={`flex flex-col items-center justify-center min-w-[48px] h-16 rounded-xl transition-all ${
                isSelected
                  ? "bg-teal-600 text-white shadow-md"
                  : isDayToday
                    ? "bg-teal-50 text-teal-700"
                    : "text-gray-600 hover:bg-gray-100"
              }`}
              style={{ scrollSnapAlign: "center" }}
            >
              <span className={`text-xs uppercase ${isSelected ? "text-teal-100" : "text-gray-400"}`}>
                {format(day, "EEE", { locale: nb })}
              </span>
              <span className={`text-lg font-semibold ${isSelected ? "" : ""}`}>
                {format(day, "d")}
              </span>
            </button>
          )
        })}
      </div>

      {/* Bookings list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
          </div>
        ) : dayBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <p className="text-sm">Ingen bookinger denne dagen</p>
            <Link
              href="/resources"
              className="mt-2 text-sm text-teal-600 font-medium"
            >
              Book nå →
            </Link>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {dayBookings.map((booking) => {
              const startTime = format(new Date(booking.startTime), "HH:mm")
              const endTime = format(new Date(booking.endTime), "HH:mm")
              const color = booking.resource.category?.color || "#22c55e"

              return (
                <button
                  key={booking.id}
                  onClick={() => onBookingClick?.(booking)}
                  className="w-full text-left p-3 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    {/* Color indicator */}
                    <div
                      className="w-1 h-full min-h-[40px] rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    
                    <div className="flex-1 min-w-0">
                      {/* Time */}
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <span className="font-medium">{startTime}</span>
                        <span>-</span>
                        <span>{endTime}</span>
                      </div>
                      
                      {/* Title */}
                      <h3 className="font-medium text-gray-900 truncate">
                        {booking.title}
                      </h3>
                      
                      {/* Resource */}
                      <p className="text-sm text-gray-500 truncate">
                        {booking.resource.name}
                        {booking.resourcePart && ` · ${booking.resourcePart.name}`}
                      </p>
                    </div>

                    {/* Status indicator */}
                    <div
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        booking.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : booking.status === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {booking.status === "approved" ? "Godkjent" : booking.status === "pending" ? "Venter" : booking.status}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

