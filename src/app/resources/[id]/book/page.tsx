"use client"

import { useState, useEffect, use } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  User, 
  Mail, 
  Phone,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Repeat,
  MapPin
} from "lucide-react"
import { MapViewer } from "@/components/MapViewer"

interface ResourcePart {
  id: string
  name: string
  description?: string | null
  capacity?: number | null
  mapCoordinates?: string | null
  parentId?: string | null
}

interface Resource {
  id: string
  name: string
  minBookingMinutes: number | null
  maxBookingMinutes: number | null
  requiresApproval: boolean
  allowWholeBooking: boolean
  mapImage?: string | null
  parts: ResourcePart[]
  category: { color: string } | null
}

interface Props {
  params: Promise<{ id: string }>
}

export default function BookResourcePage({ params }: Props) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [resource, setResource] = useState<Resource | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [bookingCount, setBookingCount] = useState(1)
  const [error, setError] = useState("")

  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [selectedPart, setSelectedPart] = useState("")
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  
  // Recurring booking state
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringType, setRecurringType] = useState<"weekly" | "biweekly" | "monthly">("weekly")
  const [recurringEndDate, setRecurringEndDate] = useState("")

  useEffect(() => {
    fetch(`/api/resources/${id}`)
      .then(res => res.json())
      .then(data => {
        setResource(data)
        setIsLoading(false)
      })
      .catch(() => {
        setError("Kunne ikke laste ressursen")
        setIsLoading(false)
      })
  }, [id])

  useEffect(() => {
    if (session?.user) {
      setContactName(session.user.name || "")
      setContactEmail(session.user.email || "")
    }
  }, [session])

  // Redirect if not logged in
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/login?callbackUrl=/resources/${id}/book`)
    }
  }, [status, router, id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    // Validate part selection if whole booking is not allowed
    if (resource && !resource.allowWholeBooking && resource.parts.length > 0 && !selectedPart) {
      setError("Du må velge et område for denne fasiliteten")
      setIsSubmitting(false)
      return
    }

    try {
      const startDateTime = new Date(`${date}T${startTime}`)
      const endDateTime = new Date(`${date}T${endTime}`)

      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: id,
          resourcePartId: selectedPart || undefined,
          title,
          description,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          contactName,
          contactEmail,
          contactPhone,
          isRecurring,
          recurringType: isRecurring ? recurringType : undefined,
          recurringEndDate: isRecurring ? recurringEndDate : undefined
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || "Kunne ikke opprette booking")
      }

      setBookingCount(data.count || 1)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!resource) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Ressursen ble ikke funnet</p>
          <Link href="/resources" className="btn btn-primary mt-4">
            Tilbake til fasiliteter
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center animate-fadeIn">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {bookingCount > 1 ? `${bookingCount} bookinger sendt!` : "Booking sendt!"}
          </h1>
          <p className="text-gray-600 mb-6">
            {resource.requiresApproval 
              ? bookingCount > 1
                ? "Dine bookinger venter nå på godkjenning. Du vil få beskjed når de er behandlet."
                : "Din booking venter nå på godkjenning. Du vil få beskjed når den er behandlet."
              : bookingCount > 1
                ? "Dine bookinger er nå bekreftet."
                : "Din booking er nå bekreftet."
            }
          </p>
          <div className="flex flex-col gap-3">
            <Link href="/my-bookings" className="btn btn-primary">
              Se mine bookinger
            </Link>
            <Link href={`/resources/${id}`} className="btn btn-secondary">
              Tilbake til {resource.name}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div 
        className="h-32"
        style={{ 
          background: `linear-gradient(135deg, ${resource.category?.color || '#3b82f6'}ee, ${resource.category?.color || '#3b82f6'}88)`
        }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center">
          <Link 
            href={`/resources/${id}`}
            className="flex items-center gap-2 text-white/80 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Tilbake til {resource.name}</span>
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 pb-16">
        <div className="card p-6 md:p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Book {resource.name}</h1>
          <p className="text-gray-500 mb-8">Fyll ut skjemaet for å sende en bookingforespørsel</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tittel på booking *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input"
                placeholder="F.eks. A-lag trening"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Beskrivelse
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input min-h-[100px]"
                placeholder="Eventuell tilleggsinformasjon..."
              />
            </div>

            {/* Part selection with map */}
            {resource.parts.length > 0 && (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">
                  Velg del av {resource.name} {!resource.allowWholeBooking && <span className="text-red-500">*</span>}
                </label>
                
                {/* Map view if available */}
                {resource.mapImage && resource.parts.some(p => p.mapCoordinates) ? (
                  <div className="space-y-3">
                    <div className="rounded-xl overflow-hidden border border-gray-200">
                      <MapViewer
                        mapImage={resource.mapImage}
                        parts={resource.parts}
                        selectedPartId={selectedPart}
                        onPartClick={(partId) => {
                          // If clicking same part, deselect only if whole booking is allowed
                          if (partId === selectedPart) {
                            if (resource.allowWholeBooking) {
                              setSelectedPart("")
                            }
                          } else {
                            setSelectedPart(partId)
                          }
                        }}
                      />
                    </div>
                    
                    {/* Selected part display */}
                    <div className={`p-4 rounded-xl border-2 transition-all ${
                      selectedPart 
                        ? "border-blue-500 bg-blue-50" 
                        : !resource.allowWholeBooking 
                          ? "border-red-300 bg-red-50"
                          : "border-gray-200 bg-gray-50"
                    }`}>
                      <p className="text-sm text-gray-500 mb-1">Valgt område:</p>
                      <p className="font-semibold text-gray-900">
                        {selectedPart 
                          ? resource.parts.find(p => p.id === selectedPart)?.name 
                          : resource.allowWholeBooking 
                            ? `Hele ${resource.name}`
                            : "Velg et område"
                        }
                      </p>
                    </div>
                    
                    <p className="text-xs text-gray-500">
                      {resource.allowWholeBooking 
                        ? "Klikk på et område i kartet for å velge det. Klikk igjen for å velge hele fasiliteten."
                        : "Klikk på et område i kartet for å velge det."
                      }
                    </p>
                  </div>
                ) : (
                  /* Fallback dropdown if no map */
                  <select
                    value={selectedPart}
                    onChange={(e) => setSelectedPart(e.target.value)}
                    className="input"
                    required={!resource.allowWholeBooking}
                  >
                    {resource.allowWholeBooking && <option value="">Hele fasiliteten</option>}
                    {!resource.allowWholeBooking && !selectedPart && <option value="">Velg et område...</option>}
                    {resource.parts.map(part => (
                      <option key={part.id} value={part.id}>{part.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Date and time */}
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Dato *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input"
                  min={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Fra kl. *
                </label>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Velg tid</option>
                  {Array.from({ length: 24 * 4 }, (_, i) => {
                    const hour = Math.floor(i / 4)
                    const minute = (i % 4) * 15
                    const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
                    return <option key={time} value={time}>{time}</option>
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Til kl. *
                </label>
                <select
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Velg tid</option>
                  {Array.from({ length: 24 * 4 }, (_, i) => {
                    const hour = Math.floor(i / 4)
                    const minute = (i % 4) * 15
                    const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
                    return <option key={time} value={time}>{time}</option>
                  })}
                </select>
              </div>
            </div>

            <p className="text-sm text-gray-500">
              {resource.minBookingMinutes !== null && resource.maxBookingMinutes !== null &&
               resource.minBookingMinutes !== 0 && resource.maxBookingMinutes !== 9999 ? (
                <>Varighet må være mellom {resource.minBookingMinutes} og {resource.maxBookingMinutes} minutter</>
              ) : (
                <>Ubegrenset varighet</>
              )}
            </p>

            {/* Recurring booking */}
            <div className="p-4 bg-gray-50 rounded-xl space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isRecurring"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isRecurring" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Repeat className="w-4 h-4" />
                  Gjentakende arrangement
                </label>
              </div>

              {isRecurring && (
                <div className="ml-8 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gjentas
                    </label>
                    <select
                      value={recurringType}
                      onChange={(e) => setRecurringType(e.target.value as "weekly" | "biweekly" | "monthly")}
                      className="input max-w-[200px]"
                    >
                      <option value="weekly">Hver uke</option>
                      <option value="biweekly">Annenhver uke</option>
                      <option value="monthly">Hver måned</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gjentas til og med
                    </label>
                    <input
                      type="date"
                      value={recurringEndDate}
                      onChange={(e) => setRecurringEndDate(e.target.value)}
                      className="input max-w-[200px]"
                      min={date || new Date().toISOString().split("T")[0]}
                      required={isRecurring}
                    />
                  </div>
                  {date && recurringEndDate && (
                    <p className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                      Dette vil opprette flere bookinger fra {new Date(date).toLocaleDateString("nb-NO")} til {new Date(recurringEndDate).toLocaleDateString("nb-NO")}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Contact info */}
            <div className="pt-6 border-t border-gray-200">
              <h3 className="font-medium text-gray-900 mb-4">Kontaktinformasjon</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="w-4 h-4 inline mr-1" />
                    Navn
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="w-4 h-4 inline mr-1" />
                    E-post
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="input"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="input"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary flex-1 py-3 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sender...
                  </>
                ) : (
                  <>
                    <Calendar className="w-5 h-5" />
                    Send bookingforespørsel
                  </>
                )}
              </button>
              <Link
                href={`/resources/${id}`}
                className="btn btn-secondary py-3"
              >
                Avbryt
              </Link>
            </div>

            {resource.requiresApproval && (
              <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                Denne fasiliteten krever godkjenning fra admin før bookingen blir endelig.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

