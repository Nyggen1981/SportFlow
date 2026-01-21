"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { X, Loader2, Calendar, Clock, AlertCircle, Building2 } from "lucide-react"
import { format } from "date-fns"

interface Resource {
  id: string
  name: string
  parts: Array<{ id: string; name: string }>
}

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
  const [startDate, setStartDate] = useState(format(new Date(booking.startTime), "yyyy-MM-dd"))
  const [endDate, setEndDate] = useState(format(new Date(booking.endTime), "yyyy-MM-dd"))
  const [startTime, setStartTime] = useState(roundTo15Min(format(new Date(booking.startTime), "HH:mm")))
  const [endTime, setEndTime] = useState(roundTo15Min(format(new Date(booking.endTime), "HH:mm")))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  
  // Resource change
  const [resources, setResources] = useState<Resource[]>([])
  const [isLoadingResources, setIsLoadingResources] = useState(false)
  const [selectedResourceId, setSelectedResourceId] = useState(booking.resourceId)
  const [selectedPartId, setSelectedPartId] = useState<string | null>(booking.resourcePartId || null)
  const [showResourceSelector, setShowResourceSelector] = useState(false)

  // Fetch resources when user opens the resource selector
  useEffect(() => {
    if (showResourceSelector && resources.length === 0) {
      setIsLoadingResources(true)
      fetch("/api/resources")
        .then(res => res.json())
        .then(data => {
          setResources(data || [])
        })
        .catch(err => console.error("Failed to fetch resources:", err))
        .finally(() => setIsLoadingResources(false))
    }
  }, [showResourceSelector, resources.length])

  // Get selected resource and its parts
  const selectedResource = useMemo(() => 
    resources.find(r => r.id === selectedResourceId),
    [resources, selectedResourceId]
  )

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
      // Combine dates and times
      const newStartTime = new Date(`${startDate}T${startTime}:00`)
      const newEndTime = new Date(`${endDate}T${endTime}:00`)

      if (newStartTime >= newEndTime) {
        setError("Sluttid må være etter starttid")
        setIsSubmitting(false)
        return
      }

      const updateData: any = {
        title,
        description: description || null,
        startTime: newStartTime.toISOString(),
        endTime: newEndTime.toISOString()
      }

      // Include resource change if resource or part was changed
      if (selectedResourceId !== booking.resourceId) {
        updateData.resourceId = selectedResourceId
        updateData.resourcePartId = selectedPartId
      } else if (selectedPartId !== booking.resourcePartId) {
        updateData.resourcePartId = selectedPartId
      }

      const response = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData)
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
  }, [title, description, startDate, endDate, startTime, endTime, booking.id, booking.resourceId, booking.resourcePartId, isAdmin, selectedResourceId, selectedPartId, onSaved])

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

          {/* Resource */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Building2 className="w-4 h-4 inline mr-1" />
              Fasilitet
            </label>
            <div className="space-y-2">
              {!showResourceSelector ? (
                <div className="flex items-center gap-2">
                  <p className="text-gray-600 bg-gray-50 px-3 py-2 rounded-lg flex-1">
                    {selectedResourceId === booking.resourceId 
                      ? (
                        <>
                          {booking.resourceName}
                          {booking.resourcePartName && ` → ${booking.resourcePartName}`}
                        </>
                      )
                      : (
                        <>
                          {selectedResource?.name || booking.resourceName}
                          {selectedPartId && selectedResource?.parts.find(p => p.id === selectedPartId)?.name && 
                            ` → ${selectedResource?.parts.find(p => p.id === selectedPartId)?.name}`
                          }
                        </>
                      )
                    }
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowResourceSelector(true)}
                    className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Endre
                  </button>
                </div>
              ) : (
                <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  {isLoadingResources ? (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Laster fasiliteter...
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Velg fasilitet</p>
                        <select
                          value={selectedResourceId}
                          onChange={(e) => {
                            setSelectedResourceId(e.target.value)
                            setSelectedPartId(null) // Reset part when resource changes
                          }}
                          className="input w-full"
                        >
                          {resources.map(resource => (
                            <option key={resource.id} value={resource.id}>
                              {resource.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {selectedResource && selectedResource.parts.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Velg del av fasilitet (valgfritt)</p>
                          <select
                            value={selectedPartId || ""}
                            onChange={(e) => setSelectedPartId(e.target.value || null)}
                            className="input w-full"
                          >
                            <option value="">Hele fasiliteten</option>
                            {selectedResource.parts.map(part => (
                              <option key={part.id} value={part.id}>
                                {part.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setShowResourceSelector(false)
                          }}
                          className="text-sm text-gray-600 hover:text-gray-800"
                        >
                          Ferdig
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
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

          {/* Dates and Times */}
          <div className="grid grid-cols-2 gap-4">
            {/* Start Date & Time */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                <Calendar className="w-4 h-4 inline mr-1" />
                Fra
              </label>
              <input
                type="date"
                lang="no"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  // Auto-set end date to same day (most bookings are single-day)
                  if (new Date(e.target.value) > new Date(endDate)) {
                    setEndDate(e.target.value)
                  }
                }}
                required
                className="input cursor-pointer w-full text-sm"
              />
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="input cursor-pointer w-full text-sm"
              >
                <option value="">Tid</option>
                {timeOptions.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            
            {/* End Date & Time */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                <Calendar className="w-4 h-4 inline mr-1" />
                Til
              </label>
              <input
                type="date"
                lang="no"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="input cursor-pointer w-full text-sm"
              />
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="input cursor-pointer w-full text-sm"
              >
                <option value="">Tid</option>
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

