"use client"

import { useState, useCallback, useMemo } from "react"
import { X, Loader2, Calendar, Clock, AlertCircle } from "lucide-react"
import { format } from "date-fns"

interface EditBookingModalProps {
  booking: {
    id: string
    title: string
    description?: string | null
    startTime: string
    endTime: string
    status: string
    resourceId: string
    resourceName: string
    resourcePartId?: string | null
    resourcePartName?: string | null
  }
  isAdmin: boolean
  onClose: () => void
  onSaved: (updatedBooking: any) => void
}

// Round time to nearest 15 minutes for display
const roundTo15Min = (timeStr: string): string => {
  const [hours, minutes] = timeStr.split(":").map(Number)
  const roundedMinutes = Math.round(minutes / 15) * 15
  const adjustedHours = roundedMinutes === 60 ? hours + 1 : hours
  const finalMinutes = roundedMinutes === 60 ? 0 : roundedMinutes
  return `${String(adjustedHours % 24).padStart(2, "0")}:${String(finalMinutes).padStart(2, "0")}`
}

export function EditBookingModal({ booking, isAdmin, onClose, onSaved }: EditBookingModalProps) {
  const [title, setTitle] = useState(booking.title)
  const [description, setDescription] = useState(booking.description || "")
  const [date, setDate] = useState(format(new Date(booking.startTime), "yyyy-MM-dd"))
  const [startTime, setStartTime] = useState(roundTo15Min(format(new Date(booking.startTime), "HH:mm")))
  const [endTime, setEndTime] = useState(roundTo15Min(format(new Date(booking.endTime), "HH:mm")))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  // Memoize time options to avoid regenerating on every render
  const timeOptions = useMemo(() => {
    return Array.from({ length: 24 * 4 }, (_, i) => {
      const hour = Math.floor(i / 4)
      const minute = (i % 4) * 15
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      return { value: time, label: time }
    })
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      // Combine date and times
      const newStartTime = new Date(`${date}T${startTime}:00`)
      const newEndTime = new Date(`${date}T${endTime}:00`)

      if (newStartTime >= newEndTime) {
        setError("Sluttid må være etter starttid")
        setIsSubmitting(false)
        return
      }

      const response = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          startTime: newStartTime.toISOString(),
          endTime: newEndTime.toISOString()
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Kunne ikke oppdatere booking")
        setIsSubmitting(false)
        return
      }

      onSaved(data)
    } catch (err) {
      setError("En feil oppstod. Prøv igjen.")
      setIsSubmitting(false)
    }
  }, [title, description, date, startTime, endTime, booking.id, onSaved])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold text-gray-900">Rediger booking</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Warning for users */}
          {!isAdmin && booking.status === "approved" && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Hvis du endrer denne bookingen, må den godkjennes på nytt av administrator.
              </p>
            </div>
          )}

          {/* Resource (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fasilitet
            </label>
            <p className="text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
              {booking.resourceName}
              {booking.resourcePartName && ` → ${booking.resourcePartName}`}
            </p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tittel *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="input"
              placeholder="F.eks. Lagtrening U15"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Beskrivelse
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input min-h-[80px]"
              placeholder="Valgfri beskrivelse..."
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Dato *
            </label>
            <input
              type="date"
              lang="no"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="input"
            />
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Clock className="w-4 h-4 inline mr-1" />
                Fra *
              </label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="input"
              >
                {timeOptions.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Clock className="w-4 h-4 inline mr-1" />
                Til *
              </label>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="input"
              >
                {timeOptions.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Lagrer...
                </>
              ) : (
                "Lagre endringer"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

