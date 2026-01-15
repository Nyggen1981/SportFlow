"use client"

import { useState, useEffect, use, useCallback, useMemo } from "react"
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

interface FixedPricePackage {
  id: string
  name: string
  description?: string | null
  durationMinutes: number
  price: number
  isActive: boolean
  memberPrice?: number | null // For non-members: show member price if lower
}

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

// Format duration in minutes to human readable
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins} min`
  if (mins === 0) return `${hours} ${hours === 1 ? "time" : "timer"}`
  return `${hours} ${hours === 1 ? "time" : "timer"} ${mins} min`
}

// Sort parts hierarchically (parents first, then children, sorted by name at each level)
function sortPartsHierarchically(parts: ResourcePart[]): ResourcePart[] {
  const partMap = new Map<string, ResourcePart & { children: ResourcePart[] }>()
  const roots: (ResourcePart & { children: ResourcePart[] })[] = []

  // First pass: create map and initialize children array
  parts.forEach(part => {
    partMap.set(part.id, { ...part, children: [] })
  })

  // Second pass: build tree
  parts.forEach(part => {
    const node = partMap.get(part.id)!
    if (part.parentId && partMap.has(part.parentId)) {
      const parent = partMap.get(part.parentId)!
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })

  // Sort children at each level and flatten
  const result: ResourcePart[] = []
  function flattenAndSort(partsToFlatten: (ResourcePart & { children: ResourcePart[] })[], level: number = 0) {
    // Sort current level by name
    const sorted = [...partsToFlatten].sort((a, b) => a.name.localeCompare(b.name, 'no'))
    sorted.forEach(part => {
      // Add current part to result, without its children property for the flat list
      const { children: _, ...partWithoutChildren } = part
      result.push(partWithoutChildren)
      if (part.children && part.children.length > 0) {
        flattenAndSort(part.children as (ResourcePart & { children: ResourcePart[] })[], level + 1)
      }
    })
  }
  flattenAndSort(roots)
  return result
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
  const [startDate, setStartDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endDate, setEndDate] = useState("")
  const [endTime, setEndTime] = useState("")
  const [selectedParts, setSelectedParts] = useState<string[]>([])
  
  // Keep date for backward compatibility with recurring bookings
  const date = startDate
  
  // Generate time options with 15-minute intervals
  const timeOptions = useMemo(() => {
    return Array.from({ length: 24 * 4 }, (_, i) => {
      const hour = Math.floor(i / 4)
      const minute = (i % 4) * 15
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      return { value: time, label: time }
    })
  }, [])

  // All parts are always available - no hierarchy locking needed
  // Only one part can be selected at a time (handled in handlePartToggle)

  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  
  // Set phone from session when available
  useEffect(() => {
    if (session?.user?.phone) {
      setContactPhone(session.user.phone)
    }
  }, [session])
  
  // Recurring booking state
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringType, setRecurringType] = useState<"weekly" | "biweekly" | "monthly">("weekly")
  const [recurringEndDate, setRecurringEndDate] = useState("")
  
  // Pricing state (kun hvis pricing er aktivert)
  const [pricingEnabled, setPricingEnabled] = useState(false)
  const [calculatedPrice, setCalculatedPrice] = useState<{ price: number; isFree: boolean; reason?: string } | null>(null)
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState<"INVOICE" | "VIPPS" | "CARD" | null>("INVOICE")
  
  // Fixed price packages state
  const [availablePackages, setAvailablePackages] = useState<FixedPricePackage[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [usePackage, setUsePackage] = useState(false)
  
  // Pricing access state - tracks if user has hourly/daily pricing access
  const [hasHourlyAccess, setHasHourlyAccess] = useState(false)
  const [isPricingLoading, setIsPricingLoading] = useState(false)
  const [isNonMember, setIsNonMember] = useState(false)
  const [memberPricePerHour, setMemberPricePerHour] = useState<number | null>(null)
  const [currentPricePerHour, setCurrentPricePerHour] = useState<number | null>(null)

  // Handle part selection with hierarchy rules
  // When pricing is enabled, only allow one part at a time
  // Simple part toggle - only one part can be selected at a time
  const handlePartToggle = useCallback((partId: string) => {
    if (!resource) return
    
    setSelectedParts(prev => {
      if (prev.includes(partId)) {
        // Deselecting - remove it
        return []
      } else {
        // Selecting - replace with just this part (only one allowed)
        return [partId]
      }
    })
  }, [resource])

  const fetchResource = useCallback(async () => {
    try {
      const res = await fetch(`/api/resources/${id}`)
      const data = await res.json()
      setResource(data)
    } catch {
      setError("Kunne ikke laste ressursen")
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchResource()
    // Sjekk om pricing er aktivert
    fetch("/api/pricing/status")
      .then(res => res.json())
      .then(data => setPricingEnabled(data.enabled || false))
      .catch(() => setPricingEnabled(false))
  }, [fetchResource])
  
  // Last både fastprispakker og sjekk tilgang i samme effect for å unngå "hopping"
  useEffect(() => {
    if (!pricingEnabled || !resource) {
      setHasHourlyAccess(true) // No pricing = all access
      setAvailablePackages([])
      setIsPricingLoading(false)
      return
    }

    const loadPricingData = async () => {
      setIsPricingLoading(true)
      
      try {
        const partId = selectedParts.length > 0 ? selectedParts[0] : null
        
        // Hent både pakker og tilgang parallelt
        const [packagesRes, accessRes] = await Promise.all([
          fetch(partId 
            ? `/api/fixed-price-packages?resourcePartId=${partId}`
            : `/api/fixed-price-packages?resourceId=${id}`
          ),
          fetch(partId 
            ? `/api/pricing/access?resourceId=${id}&resourcePartId=${partId}`
            : `/api/pricing/access?resourceId=${id}`
          )
        ])
        
        // Behandle pakker
        let activePackages: FixedPricePackage[] = []
        if (packagesRes.ok) {
          const data = await packagesRes.json()
          activePackages = (Array.isArray(data) ? data : [])
            .filter((p: FixedPricePackage) => p.isActive)
            .map((p: any) => ({ ...p, price: Number(p.price) }))
        }
        
        // Behandle tilgang
        let hourlyAccess = false
        let nonMember = false
        let memberHourlyPrice: number | null = null
        let userHourlyPrice: number | null = null
        if (accessRes.ok) {
          const accessData = await accessRes.json()
          hourlyAccess = accessData.hasHourlyAccess || false
          nonMember = accessData.isNonMember || false
          memberHourlyPrice = accessData.memberPricePerHour || null
          userHourlyPrice = accessData.rule?.pricePerHour || null
        }
        
        // Oppdater alle state samtidig for å unngå "hopping"
        setAvailablePackages(activePackages)
        setHasHourlyAccess(hourlyAccess)
        setIsNonMember(nonMember)
        setMemberPricePerHour(memberHourlyPrice)
        setCurrentPricePerHour(userHourlyPrice)
        
        // Hvis brukeren ikke har timepris-tilgang og det er pakker, velg automatisk første pakke
        if (!hourlyAccess && activePackages.length > 0 && !selectedPackageId) {
          setUsePackage(true)
          setSelectedPackageId(activePackages[0].id)
        }
        
        // Hvis ingen pakker tilgjengelig, reset valg
        if (activePackages.length === 0) {
          setSelectedPackageId(null)
          setUsePackage(false)
        }
        
      } catch (error) {
        console.error("Error loading pricing data:", error)
        setAvailablePackages([])
        setHasHourlyAccess(false)
      } finally {
        setIsPricingLoading(false)
      }
    }

    loadPricingData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingEnabled, resource, selectedParts, id]) // Ikke inkluder selectedPackageId - vil utløse unødvendig reload

  // When a package is selected, auto-calculate end time and date
  useEffect(() => {
    if (!usePackage || !selectedPackageId || !startDate || !startTime) return

    const selectedPackage = availablePackages.find(p => p.id === selectedPackageId)
    if (!selectedPackage) return

    // Calculate end time based on package duration
    const startDateTime = new Date(`${startDate}T${startTime}`)
    const endDateTime = new Date(startDateTime.getTime() + selectedPackage.durationMinutes * 60 * 1000)
    
    // Format end date
    const endDateStr = endDateTime.toISOString().split("T")[0]
    setEndDate(endDateStr)
    
    // Format end time as HH:MM
    const hours = endDateTime.getHours().toString().padStart(2, '0')
    const minutes = endDateTime.getMinutes().toString().padStart(2, '0')
    setEndTime(`${hours}:${minutes}`)
    
    // Set price directly from package
    setCalculatedPrice({
      price: selectedPackage.price,
      isFree: selectedPackage.price === 0,
      reason: `${selectedPackage.name} (${formatDuration(selectedPackage.durationMinutes)})`
    })
  }, [usePackage, selectedPackageId, startDate, startTime, availablePackages])

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

  // Beregn pris når dato/tid/deler endres (kun hvis pricing er aktivert)
  // IKKE beregn hvis en fastprispakke er valgt - da brukes pakkeprisen
  useEffect(() => {
    // Hvis fastprispakke er valgt, ikke beregn - pakkeprisen settes i egen useEffect
    // Sjekk både usePackage flag OG om selectedPackageId finnes i availablePackages
    const hasSelectedPackage = selectedPackageId && availablePackages.some(p => p.id === selectedPackageId)
    if (usePackage || hasSelectedPackage) {
      return
    }
    
    if (!pricingEnabled || !session?.user?.id || !startDate || !startTime || !endDate || !endTime || !resource) {
      setCalculatedPrice(null)
      return
    }
    
    const calculatePrice = async () => {
      try {
        const startDateTime = new Date(`${startDate}T${startTime}`)
        const endDateTime = new Date(`${endDate}T${endTime}`)
        
        // Valider at datoene er gyldige
        if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
          setCalculatedPrice(null)
          return
        }
        
        // Valider at sluttidspunkt er etter starttidspunkt
        if (endDateTime <= startDateTime) {
          setCalculatedPrice(null)
          return
        }
        
        // Beregn pris for første del (eller hele fasiliteten hvis ingen deler valgt)
        const partId = selectedParts.length > 0 ? selectedParts[0] : null
        const response = await fetch("/api/pricing/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resourceId: id,
            resourcePartId: partId,
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString()
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          setCalculatedPrice(data)
        } else {
          setCalculatedPrice(null)
        }
      } catch (error) {
        console.error("Error calculating price:", error)
        setCalculatedPrice(null)
      }
    }
    
    calculatePrice()
  }, [pricingEnabled, startDate, startTime, endDate, endTime, selectedParts, id, resource, session?.user?.id, usePackage, selectedPackageId, availablePackages])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    // Validate part selection if whole booking is not allowed
    if (resource && !resource.allowWholeBooking && resource.parts.length > 0 && selectedParts.length === 0) {
      setError("Du må velge minst en del for denne fasiliteten")
      setIsSubmitting(false)
      return
    }

    // Validate that end date/time is after start date/time
    if (!startDate || !startTime || !endDate || !endTime) {
      setError("Du må fylle ut både start- og sluttidspunkt")
      setIsSubmitting(false)
      return
    }

    try {
      const startDateTime = new Date(`${startDate}T${startTime}`)
      const endDateTime = new Date(`${endDate}T${endTime}`)
      
      // Validate dates
      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        setError("Ugyldig dato eller tid")
        setIsSubmitting(false)
        return
      }
      
      // Validate that end is after start
      if (endDateTime <= startDateTime) {
        setError("Sluttidspunkt må være etter starttidspunkt")
        setIsSubmitting(false)
        return
      }

      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: id,
          resourcePartIds: selectedParts.length > 0 ? selectedParts : undefined,
          title,
          description,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          contactName,
          contactEmail,
          contactPhone,
          isRecurring,
          recurringType: isRecurring ? recurringType : undefined,
          recurringEndDate: isRecurring ? recurringEndDate : undefined,
          // Legg til betalingsmetode KUN hvis pricing er aktivert, det er valgt, og bookingen IKKE er gratis
          ...(pricingEnabled && preferredPaymentMethod && calculatedPrice && !calculatedPrice.isFree && calculatedPrice.price > 0 ? {
            preferredPaymentMethod
          } : {}),
          // Legg til fastprispakke hvis valgt
          ...(usePackage && selectedPackageId ? {
            fixedPricePackageId: selectedPackageId
          } : {})
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || "Kunne ikke opprette booking")
      }

      const bookingCount = data.count || (selectedParts.length > 0 ? selectedParts.length : 1)
      setBookingCount(bookingCount)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt")
    } finally {
      setIsSubmitting(false)
    }
  }, [resource, selectedParts, id, startDate, startTime, endDate, endTime, title, description, contactName, contactEmail, contactPhone, isRecurring, recurringType, recurringEndDate, pricingEnabled, calculatedPrice, preferredPaymentMethod, usePackage, selectedPackageId])

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
                  Velg del(er) av {resource.name} {!resource.allowWholeBooking && <span className="text-red-500">*</span>}
                </label>
                
                {/* Map view if available */}
                {resource.mapImage && resource.parts.some(p => p.mapCoordinates) ? (
                  <div className="space-y-3">
                    <div className="rounded-xl overflow-hidden border border-gray-200">
                      <MapViewer
                        mapImage={resource.mapImage}
                        parts={resource.parts}
                        selectedPartIds={selectedParts}
                        lockedPartIds={[]}
                        onPartClick={handlePartToggle}
                      />
                    </div>
                    
                    {/* Selected parts display */}
                    <div className={`p-4 rounded-xl border-2 transition-all ${
                      selectedParts.length > 0
                        ? "border-blue-500 bg-blue-50" 
                        : !resource.allowWholeBooking 
                          ? "border-red-300 bg-red-50"
                          : "border-gray-200 bg-gray-50"
                    }`}>
                      <p className="text-sm text-gray-500 mb-1">Valgt del:</p>
                      <p className="font-semibold text-gray-900">
                        {selectedParts.length > 0 
                          ? selectedParts.map(id => resource.parts.find(p => p.id === id)?.name).filter(Boolean).join(", ")
                          : resource.allowWholeBooking 
                            ? `Hele ${resource.name}`
                            : "Velg del"
                        }
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Kun én del kan velges per booking
                      </p>
                    </div>
                    
                    <p className="text-xs text-gray-500">
                      Klikk på en del i kartet for å velge den.
                    </p>
                  </div>
                ) : (
                  /* Fallback radio list if no map - only one part can be selected */
                  <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {(() => {
                      const sortedParts = sortPartsHierarchically(resource.parts)
                      return sortedParts.map(part => {
                        const isChild = part.parentId !== null
                        const parent = resource.parts.find(p => p.id === part.parentId)
                        
                        return (
                          <label
                            key={part.id}
                            className={`flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer ${isChild ? 'ml-6' : ''}`}
                          >
                            <input
                              type="radio"
                              name="selectedPart"
                              checked={selectedParts.includes(part.id)}
                              onChange={() => handlePartToggle(part.id)}
                              className="w-5 h-5 border-gray-300 text-blue-600 focus:ring-blue-500 rounded-full"
                            />
                            <span className="text-sm text-gray-900">
                              {isChild && parent ? `${part.name} (${parent.name})` : part.name}
                            </span>
                          </label>
                        )
                      })
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Fixed Price Packages selection (if available) OR hourly pricing access */}
            {/* Only show when a part is selected OR whole facility booking is allowed */}
            {pricingEnabled && (selectedParts.length > 0 || resource?.allowWholeBooking) && (
              <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">Velg type booking</h3>
                </div>
                
                {isPricingLoading ? (
                  <div className="p-4 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                    <span className="ml-2 text-sm text-gray-600">Laster priser...</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Option: Manual time selection - only show if user has hourly access */}
                    {hasHourlyAccess && (
                      <label className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                        !usePackage ? 'border-blue-500 bg-white' : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}>
                        <input
                          type="radio"
                          name="bookingType"
                          checked={!usePackage}
                          onChange={() => {
                            setUsePackage(false)
                            setSelectedPackageId(null)
                            setEndDate("")
                            setEndTime("")
                            setCalculatedPrice(null)
                          }}
                          className="mt-1 w-4 h-4 text-blue-600"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">Timeleie</div>
                          <div className="text-sm text-gray-500">
                            Velg varighet selv - pris beregnes per time
                          </div>
                          {/* Member savings info for non-members */}
                          {isNonMember && memberPricePerHour && currentPricePerHour && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                              <span>💡</span>
                              <span>Som medlem: {memberPricePerHour} kr/time (spar {currentPricePerHour - memberPricePerHour} kr/time)</span>
                            </div>
                          )}
                        </div>
                      </label>
                    )}
                    
                    {/* Package options */}
                    {availablePackages.map(pkg => (
                      <label key={pkg.id} className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                        usePackage && selectedPackageId === pkg.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}>
                        <input
                          type="radio"
                          name="bookingType"
                          checked={usePackage && selectedPackageId === pkg.id}
                          onChange={() => {
                            setUsePackage(true)
                            setSelectedPackageId(pkg.id)
                          }}
                          className="mt-1 w-4 h-4 text-purple-600"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">{pkg.name}</span>
                            <span className="font-bold text-purple-700">{pkg.price.toFixed(0)} kr</span>
                          </div>
                          <div className="text-sm text-gray-500">
                            Varighet: {formatDuration(pkg.durationMinutes)}
                            {pkg.description && ` - ${pkg.description}`}
                          </div>
                          {/* Member savings info for non-members */}
                          {pkg.memberPrice && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                              <span>💡</span>
                              <span>Som medlem: {pkg.memberPrice.toFixed(0)} kr (spar {(pkg.price - pkg.memberPrice).toFixed(0)} kr)</span>
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                    
                    {/* Message when user has no options */}
                    {!hasHourlyAccess && availablePackages.length === 0 && (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          Du har ikke tilgang til å booke denne fasiliteten med din nåværende rolle.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Date and time */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Fra</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Dato *
                    </label>
                    <input
                      type="date"
                      lang="no"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value)
                        // Auto-set end date to same date if not set or if end date is before start date
                        if (!endDate || (endDate && new Date(e.target.value) > new Date(endDate))) {
                          setEndDate(e.target.value)
                        }
                      }}
                      className="input cursor-pointer w-full"
                      min={new Date().toISOString().split("T")[0]}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Klokkeslett *
                    </label>
                    <select
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      onMouseDown={(e) => {
                        // Scroll to bottom when clicking to open dropdown
                        const select = e.target as HTMLSelectElement
                        setTimeout(() => {
                          if (select.options.length > 0) {
                            select.selectedIndex = select.options.length - 1
                            // Reset to actual value after a brief moment
                            setTimeout(() => {
                              const selectedIndex = Array.from(select.options).findIndex(opt => opt.value === startTime)
                              if (selectedIndex > 0) {
                                select.selectedIndex = selectedIndex
                              }
                            }, 50)
                          }
                        }, 0)
                      }}
                      className="input cursor-pointer w-full"
                      required
                    >
                      <option value="">Velg tid</option>
                      {timeOptions.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Til</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Dato *
                    </label>
                    {usePackage && selectedPackageId ? (
                      // When using a package, end date is calculated automatically
                      <div className="input bg-gray-100 flex items-center justify-between">
                        <span className={endDate ? "text-gray-900" : "text-gray-400"}>
                          {endDate ? new Date(endDate).toLocaleDateString("nb-NO") : "Velg startdato"}
                        </span>
                        <span className="text-xs text-gray-500">(automatisk)</span>
                      </div>
                    ) : (
                      <input
                        type="date"
                        lang="no"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="input cursor-pointer w-full"
                        min={startDate || new Date().toISOString().split("T")[0]}
                        required
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Klokkeslett *
                    </label>
                    {usePackage && selectedPackageId ? (
                      // When using a package, end time is calculated automatically
                      <div className="input bg-gray-100 flex items-center justify-between">
                        <span className={endTime ? "text-gray-900" : "text-gray-400"}>
                          {endTime || "Velg starttid"}
                        </span>
                        <span className="text-xs text-gray-500">(automatisk)</span>
                      </div>
                    ) : (
                      <select
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        onMouseDown={(e) => {
                          // Scroll to bottom when clicking to open dropdown
                          const select = e.target as HTMLSelectElement
                          setTimeout(() => {
                            if (select.options.length > 0) {
                              select.selectedIndex = select.options.length - 1
                              // Reset to actual value after a brief moment
                              setTimeout(() => {
                                const selectedIndex = Array.from(select.options).findIndex(opt => opt.value === endTime)
                                if (selectedIndex > 0) {
                                  select.selectedIndex = selectedIndex
                                }
                              }, 50)
                            }
                          }, 0)
                        }}
                        className="input cursor-pointer w-full"
                        required
                      >
                        <option value="">Velg tid</option>
                        {timeOptions.map(({ value, label }) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Vis varighetsinfo kun for timeleie, ikke for fastprispakker */}
            {!usePackage && (
              <p className="text-sm text-gray-500">
                {resource.minBookingMinutes !== null && resource.maxBookingMinutes !== null &&
                 resource.minBookingMinutes !== 0 && resource.maxBookingMinutes !== 9999 ? (
                  <>Varighet må være mellom {resource.minBookingMinutes} og {resource.maxBookingMinutes} minutter</>
                ) : (
                  <>Ubegrenset varighet</>
                )}
              </p>
            )}

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
                      lang="no"
                      value={recurringEndDate}
                      onChange={(e) => setRecurringEndDate(e.target.value)}
                      className="input cursor-pointer max-w-[200px]"
                      min={startDate || new Date().toISOString().split("T")[0]}
                      required={isRecurring}
                    />
                  </div>
                  {startDate && recurringEndDate && (
                    <p className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                      Dette vil opprette flere bookinger fra {new Date(startDate).toLocaleDateString("nb-NO")} til {new Date(recurringEndDate).toLocaleDateString("nb-NO")}
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

            {/* Price and Payment Method (kun hvis pricing er aktivert) */}
            {pricingEnabled && (
              <div className="pt-6 border-t border-gray-200">
                <h3 className="font-medium text-gray-900 mb-4">Betaling</h3>
                
                {/* Vis pris hvis den er beregnet */}
                {calculatedPrice ? (
                  calculatedPrice.isFree || calculatedPrice.price === 0 ? (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-green-700">Gratis booking</span>
                        {calculatedPrice.reason && (
                          <span className="text-xs text-green-600">({calculatedPrice.reason})</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Estimert pris:</span>
                          <span className="text-2xl font-bold text-gray-900">
                            {Number(calculatedPrice.price).toFixed(2)} kr
                          </span>
                        </div>
                        {calculatedPrice.reason && (
                          <p className="text-xs text-gray-600 italic mt-2">{calculatedPrice.reason}</p>
                        )}
                      </div>
                      
                      {/* Betalingsmetode-valg */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Foretrukken betalingsmetode
                        </label>
                        <div className="space-y-2">
                          <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="INVOICE"
                              checked={preferredPaymentMethod === "INVOICE"}
                              onChange={() => setPreferredPaymentMethod("INVOICE")}
                              className="mt-1 w-4 h-4 text-blue-600"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">Faktura</div>
                              <div className="text-sm text-gray-500">
                                Faktura sendes til deg etter godkjenning
                              </div>
                            </div>
                          </label>
                          
                          <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="VIPPS"
                              checked={preferredPaymentMethod === "VIPPS"}
                              onChange={() => setPreferredPaymentMethod("VIPPS")}
                              className="mt-1 w-4 h-4 text-blue-600"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">Vipps</div>
                              <div className="text-sm text-gray-500">
                                Vipps-betalingsforespørsel sendes etter godkjenning
                              </div>
                            </div>
                          </label>
                          
                          <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-not-allowed opacity-50">
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="CARD"
                              checked={preferredPaymentMethod === "CARD"}
                              onChange={() => setPreferredPaymentMethod("CARD")}
                              disabled
                              className="mt-1 w-4 h-4 text-gray-400 cursor-not-allowed"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-500">Kortbetaling</div>
                              <div className="text-sm text-gray-400">
                                Betalingslink sendes etter godkjenning (kommer snart)
                              </div>
                            </div>
                          </label>
                        </div>
                      </div>
                    </>
                  )
                ) : (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl mb-4">
                    <p className="text-sm text-gray-600">
                      Fyll ut dato og tid for å se estimert pris
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Submit */}
            <div className="space-y-3 pt-4">
              <div className="flex flex-col sm:flex-row gap-3">
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
              {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 animate-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}
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

