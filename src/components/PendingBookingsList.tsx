"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Check, 
  Loader2,
  Calendar,
  Clock,
  User,
  MapPin,
  ChevronDown
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { nb } from "date-fns/locale"

interface Booking {
  id: string
  title: string
  resourceName: string
  resourcePartName: string | null
  userName: string
  startTime: string
  endTime: string
}

interface Props {
  bookings: Booking[]
}

export function PendingBookingsList({ bookings: initialBookings }: Props) {
  const router = useRouter()
  const [bookings, setBookings] = useState(initialBookings)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleAction = async (id: string, action: "approved" | "rejected") => {
    setLoadingId(id)
    
    try {
      const response = await fetch(`/api/admin/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action })
      })

      if (response.ok) {
        setBookings(bookings.filter(b => b.id !== id))
        router.refresh()
      }
    } catch (error) {
      console.error("Error updating booking:", error)
    } finally {
      setLoadingId(null)
    }
  }

  if (bookings.length === 0) {
    return (
      <div className="card p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <p className="text-gray-600">Ingen ventende bookinger 🎉</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="divide-y divide-gray-100">
        {bookings.map((booking) => {
          const isExpanded = expandedId === booking.id
          const isLoading = loadingId === booking.id
          const startDate = parseISO(booking.startTime)
          const endDate = parseISO(booking.endTime)

          return (
            <div key={booking.id} className="transition-colors">
              {/* Clickable header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : booking.id)}
                className="w-full p-4 hover:bg-gray-50 text-left"
                disabled={isLoading}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <h3 className="font-medium text-gray-900">{booking.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600">
                      {booking.resourceName}
                      {booking.resourcePartName && ` → ${booking.resourcePartName}`}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Av {booking.userName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {format(startDate, "d. MMM", { locale: nb })}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(startDate, "HH:mm")} - {format(endDate, "HH:mm")}
                      </p>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </button>

              {/* Expanded details with actions */}
              {isExpanded && (
                <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                  <div className="pt-4 space-y-3">
                    {/* Details */}
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {format(startDate, "EEEE d. MMMM yyyy", { locale: nb })}
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {format(startDate, "HH:mm")} - {format(endDate, "HH:mm")}
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {booking.resourceName}
                        {booking.resourcePartName && ` (${booking.resourcePartName})`}
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <User className="w-4 h-4 text-gray-400" />
                        {booking.userName}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleAction(booking.id, "approved")}
                        disabled={isLoading}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Godkjenn
                      </button>
                      <button
                        onClick={() => handleAction(booking.id, "rejected")}
                        disabled={isLoading}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                        Avslå
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

