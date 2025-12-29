import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { 
  MapPin, 
  Clock, 
  Calendar,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Users,
  X
} from "lucide-react"
import { ResourceCalendar } from "@/components/ResourceCalendar"
import { MapViewer } from "@/components/MapViewer"
import { PartsList } from "@/components/PartsList"
import { getPricingConfig, isPricingEnabled, PricingModel, findPricingRuleForUser, hasPricingRules } from "@/lib/pricing"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getUserRoleInfo } from "@/lib/roles"

// Revalidate every hour (3600 seconds) to reduce ISR writes
export const revalidate = 3600

interface Props {
  params: Promise<{ id: string }>
}

// Fetch resource data directly without unstable_cache to avoid caching issues
async function getResource(id: string) {
  try {
    const pricingEnabled = await isPricingEnabled()
    const now = new Date()
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const twoMonthsAhead = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

    const resource = await prisma.resource.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        parts: {
          where: { isActive: true },
          include: {
            children: {
              where: { isActive: true },
              select: { id: true, name: true }
            }
          },
          orderBy: { name: "asc" }
        },
        bookings: {
          where: {
            status: { in: ["approved", "pending"] },
            startTime: { gte: twoWeeksAgo, lte: twoMonthsAhead }
          },
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            status: true,
            isRecurring: true,
            parentBookingId: true,
            userId: true,
            resourcePartId: true,
            resourcePart: {
              select: {
                id: true,
                name: true,
                parentId: true
              }
            },
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: { startTime: "asc" }
        }
      }
    })

    if (!resource) return null

    // Hvis pricing er aktivert, filtrer ut deler uten prisregler
    if (pricingEnabled && resource.parts.length > 0) {
      const partsWithPricing = []
      for (const part of resource.parts) {
        const hasRules = await hasPricingRules(id, part.id)
        if (hasRules) {
          partsWithPricing.push(part)
        }
      }
      resource.parts = partsWithPricing
    }

    return resource
  } catch (error) {
    console.error("Error fetching resource:", error)
    return null
  }
}

// Sort parts hierarchically (parents first, then children, sorted by name at each level)
function sortPartsHierarchically(parts: Array<{ id: string; name: string; description: string | null; capacity: number | null; image: string | null; parentId: string | null; children?: Array<{ id: string; name: string }> }>) {
  type PartType = typeof parts[0]
  const partMap = new Map<string, PartType & { children: PartType[] }>()
  const roots: (PartType & { children: PartType[] })[] = []

  // First pass: create map
  parts.forEach(part => {
    partMap.set(part.id, { ...part, children: [] })
  })

  // Second pass: build tree using parentId
  parts.forEach(part => {
    const node = partMap.get(part.id)!
    if (part.parentId && partMap.has(part.parentId)) {
      const parent = partMap.get(part.parentId)!
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })

  // Flatten tree maintaining hierarchy order
  const result: PartType[] = []
  function flatten(partsToFlatten: (PartType & { children: PartType[] })[], level: number = 0) {
    // Sort each level by name
    const sorted = [...partsToFlatten].sort((a, b) => a.name.localeCompare(b.name, 'no'))
    sorted.forEach(part => {
      // Remove children property when adding to result
      const { children: _, ...partWithoutChildren } = part
      result.push(partWithoutChildren as PartType)
      if (part.children && part.children.length > 0) {
        flatten(part.children as (PartType & { children: PartType[] })[], level + 1)
      }
    })
  }
  flatten(roots)
  return result
}

export default async function ResourcePage({ params }: Props) {
  const { id } = await params
  const resource = await getResource(id)

  if (!resource) {
    notFound()
  }

  // Sort parts hierarchically
  // Map parts to ensure image field is included (TypeScript may not recognize it if Prisma client is outdated)
  const partsWithImage = resource.parts.map(p => ({
    ...p,
    image: (p as any).image || null
  }))
  const sortedParts = sortPartsHierarchically(partsWithImage)

  const openingHours = resource.openingHours 
    ? JSON.parse(resource.openingHours) 
    : null

  const dayNames: Record<string, string> = {
    monday: "Mandag",
    tuesday: "Tirsdag",
    wednesday: "Onsdag",
    thursday: "Torsdag",
    friday: "Fredag",
    saturday: "Lørdag",
    sunday: "Søndag"
  }

  // Hent session for å finne relevant prislogikk
  const session = await getServerSession(authOptions)
  
  // Hent prislogikk-konfigurasjon (kun hvis aktivert)
  const pricingEnabled = await isPricingEnabled()
  const pricingConfig = pricingEnabled ? await getPricingConfig(id, null) : null
  
  // Debug logging for å se hva som skjer
  console.log("[Resource Page] Pricing status:", {
    pricingEnabled,
    visPrislogikk: resource.visPrislogikk,
    visPrisInfo: resource.visPrisInfo,
    hasPricingConfig: !!pricingConfig,
    rulesCount: pricingConfig?.rules?.length || 0
  })
  
  // Finn relevant prisregel for den innloggede brukeren (kun hvis allowWholeBooking er true)
  let relevantRule: { rule: any; reason?: string } | null = null
  let customRoles: Array<{ id: string; name: string }> = []
  let partsPricing: Array<{ partId: string; partName: string; parentId: string | null; rule: any; reason?: string; fixedPackages?: Array<{ id: string; name: string; durationMinutes: number; price: number }> }> = []
  let resourceFixedPackages: Array<{ id: string; name: string; durationMinutes: number; price: number }> = []
  
  if (pricingEnabled && session?.user?.id) {
    try {
      // Hent custom roles for å vise navn i pris-regler
      customRoles = await prisma.customRole.findMany({
        where: { organizationId: resource.organizationId },
        select: { id: true, name: true }
      })
      
      // Hent fastprispakker for hele fasiliteten
      if (resource.allowWholeBooking) {
        const packages = await prisma.fixedPricePackage.findMany({
          where: { resourceId: id, resourcePartId: null, isActive: true },
          select: { id: true, name: true, durationMinutes: true, price: true },
          orderBy: { sortOrder: "asc" }
        })
        resourceFixedPackages = packages.map(p => ({ ...p, price: Number(p.price) }))
      }
      
      // Hvis allowWholeBooking er true, hent fasilitetsprisen
      if (resource.allowWholeBooking && pricingConfig?.rules) {
        // Bruk findPricingRuleForUser fra pricing.ts for konsistent logikk
        relevantRule = await findPricingRuleForUser(session.user.id, pricingConfig.rules)
      }
      
      // Hent relevante regler for hoveddeler og underdeler (alltid hvis det finnes deler)
      if (resource.parts.length > 0 && session?.user?.id) {
        for (const part of resource.parts) {
          const partPricingConfig = await getPricingConfig(id, part.id)
          
          // Hent fastprispakker for delen
          const fixedPackages = await prisma.fixedPricePackage.findMany({
            where: { resourcePartId: part.id, isActive: true },
            select: { id: true, name: true, durationMinutes: true, price: true },
            orderBy: { sortOrder: "asc" }
          })
          
          if (partPricingConfig?.rules) {
            const partRule = await findPricingRuleForUser(session.user.id, partPricingConfig.rules)
            if (partRule?.rule) {
              partsPricing.push({
                partId: part.id,
                partName: part.name,
                parentId: part.parentId || null,
                rule: partRule.rule,
                reason: partRule.reason,
                fixedPackages: fixedPackages.map(p => ({ ...p, price: Number(p.price) }))
              })
            }
          } else if (fixedPackages.length > 0) {
            // Hvis ingen prisregler men har fastprispakker, vis dem likevel
            partsPricing.push({
              partId: part.id,
              partName: part.name,
              parentId: part.parentId || null,
              rule: null,
              fixedPackages: fixedPackages.map(p => ({ ...p, price: Number(p.price) }))
            })
          }
        }
      }
    } catch (error) {
      console.error("Error loading pricing rules:", error)
    }
  }
  
  // Sort partsPricing hierarchically (parents first, then children)
  const sortedPartsPricing = [...partsPricing].sort((a, b) => {
    // Parents come first (no parentId)
    if (!a.parentId && b.parentId) return -1
    if (a.parentId && !b.parentId) return 1
    // If both are parents or both are children, sort by name
    return a.partName.localeCompare(b.partName, 'no')
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Hero */}
      <div className="relative h-64 md:h-80">
        {resource.image ? (
          <Image
            src={resource.image}
            alt={resource.name}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div 
            className="absolute inset-0"
            style={{ 
              background: `linear-gradient(135deg, ${resource.category?.color || '#3b82f6'}ee, ${resource.category?.color || '#3b82f6'}88)`
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/20" />
        <div className="absolute inset-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-8">
          <Link 
            href="/resources" 
            className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Tilbake til fasiliteter
          </Link>
          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm mb-3">
              {resource.category?.name || "Fasilitet"}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-white">{resource.name}</h1>
            {resource.location && (
              <p className="text-white/80 flex items-center gap-2 mt-2">
                <MapPin className="w-5 h-5" />
                {resource.location}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            {resource.description && (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Om fasiliteten</h2>
                <p className="text-gray-600">{resource.description}</p>
              </div>
            )}

            {/* Map Overview */}
            {resource.mapImage && resource.parts.length > 0 && (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  Oversiktskart
                </h2>
                <MapViewer
                  mapImage={resource.mapImage}
                  parts={resource.parts.map(p => ({
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    capacity: p.capacity,
                    mapCoordinates: p.mapCoordinates
                  }))}
                  resourceColor={resource.color || resource.category?.color}
                />
              </div>
            )}

            {/* Calendar */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Kalender
              </h2>
              <ResourceCalendar 
                resourceId={resource.id}
                resourceName={resource.name}
                bookings={resource.bookings.map(b => ({
                  id: b.id,
                  title: b.title,
                  startTime: (b.startTime instanceof Date ? b.startTime : new Date(b.startTime)).toISOString(),
                  endTime: (b.endTime instanceof Date ? b.endTime : new Date(b.endTime)).toISOString(),
                  status: b.status,
                  resourcePartId: b.resourcePartId,
                  resourcePartName: b.resourcePart?.name,
                  resourcePartParentId: b.resourcePart?.parentId,
                  userId: b.userId,
                  userName: b.user?.name,
                  userEmail: b.user?.email,
                  isRecurring: b.isRecurring || false,
                  parentBookingId: b.parentBookingId
                }))}
                parts={resource.parts.map(p => ({ 
                  id: p.id, 
                  name: p.name,
                  parentId: p.parentId,
                  children: p.children
                }))}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Book button */}
            <Link
              href={`/resources/${resource.id}/book`}
              className="btn btn-primary w-full py-4 text-lg"
            >
              <Calendar className="w-5 h-5" />
              Book nå
            </Link>

            {/* Quick info - Vises kun hvis minst én innstilling er aktiv */}
            {((resource.minBookingMinutes !== 0 && resource.minBookingMinutes !== null) || 
              (resource.maxBookingMinutes !== 9999 && resource.maxBookingMinutes !== null) ||
              (resource.minBookingHours && Number(resource.minBookingHours) > 0) ||
              resource.advanceBookingDays ||
              resource.requiresApproval) && (
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Booking-info</h3>
                <div className="space-y-4">
                  {/* Minimum antall timer - vises kun hvis satt */}
                  {resource.minBookingHours && Number(resource.minBookingHours) > 0 && (
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Minimum varighet</p>
                        <p className="text-sm text-gray-500">
                          {Number(resource.minBookingHours)} timer
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Varighet - vises kun hvis begrenset */}
                  {((resource.minBookingMinutes !== 0 && resource.minBookingMinutes !== null) || 
                    (resource.maxBookingMinutes !== 9999 && resource.maxBookingMinutes !== null)) && (
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Varighet</p>
                        <p className="text-sm text-gray-500">
                          {`${resource.minBookingMinutes || 0} - ${resource.maxBookingMinutes || 9999} minutter`}
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Forhåndsbestilling - vises kun hvis begrenset */}
                  {resource.advanceBookingDays && (
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Forhåndsbestilling</p>
                        <p className="text-sm text-gray-500">
                          Inntil {resource.advanceBookingDays} dager frem
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Godkjenning - vises kun hvis kreves */}
                  {resource.requiresApproval && (
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Godkjenning</p>
                        <p className="text-sm text-gray-500">
                          Krever godkjenning fra admin
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Price info - Kun for standardlisens (ikke "pris & betaling" modul) */}
            {!pricingEnabled && resource.visPrisInfo && resource.prisInfo && (
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Prisinfo
                </h3>
                <div className="text-sm text-gray-600 whitespace-pre-line">
                  {resource.prisInfo}
                </div>
              </div>
            )}

            {/* Pricing Logic (kun hvis "pris & betaling" modul er aktivert og visPrislogikk er true) */}
            {pricingEnabled && resource.visPrislogikk && (
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Prisinfo
                </h3>
                <div className="space-y-3">
                  {/* Vis fasilitetspris kun hvis allowWholeBooking er true */}
                  {resource.allowWholeBooking && relevantRule && relevantRule.rule ? (
                    (() => {
                      const rule = relevantRule.rule
                      const isMember = session?.user?.isMember ?? false
                      const isDefaultRule = rule.forRoles.length === 0
                      
                      console.log("[Facility Page] Displaying pricing rule:", {
                        model: rule.model,
                        isMember,
                        isDefaultRule,
                        memberPricePerHour: rule.memberPricePerHour,
                        nonMemberPricePerHour: rule.nonMemberPricePerHour,
                        memberPricePerDay: rule.memberPricePerDay,
                        nonMemberPricePerDay: rule.nonMemberPricePerDay,
                        memberFixedPrice: rule.memberFixedPrice,
                        nonMemberFixedPrice: rule.nonMemberFixedPrice,
                        forRoles: rule.forRoles
                      })
                      
                      const getPricingDescription = (model: PricingModel) => {
                        switch (model) {
                          case "FREE":
                            if (isDefaultRule) {
                              return "Gratis"
                            }
                            return "Gratis"
                          case "HOURLY":
                            const hourlyPrice = isMember 
                              ? (rule.memberPricePerHour ?? rule.nonMemberPricePerHour)
                              : (rule.nonMemberPricePerHour ?? rule.memberPricePerHour)
                            
                            if (hourlyPrice === null || hourlyPrice === undefined || hourlyPrice === 0) {
                              return "Per time"
                            }
                            
                            if (isMember && rule.memberPricePerHour !== null && rule.memberPricePerHour !== undefined) {
                              return `${Math.round(Number(rule.memberPricePerHour))} kr/time`
                            } else if (!isMember && rule.nonMemberPricePerHour !== null && rule.nonMemberPricePerHour !== undefined) {
                              return `${Math.round(Number(rule.nonMemberPricePerHour))} kr/time`
                            } else {
                              return `${Math.round(Number(hourlyPrice))} kr/time`
                            }
                        case "DAILY":
                          const dailyPrice = isMember
                            ? (rule.memberPricePerDay ?? rule.nonMemberPricePerDay)
                            : (rule.nonMemberPricePerDay ?? rule.memberPricePerDay)
                          
                          if (dailyPrice === null || dailyPrice === undefined || dailyPrice === 0) {
                            return "Per døgn"
                          }
                          
                          if (isMember && rule.memberPricePerDay !== null && rule.memberPricePerDay !== undefined) {
                            return `${Math.round(Number(rule.memberPricePerDay))} kr/døgn`
                          } else if (!isMember && rule.nonMemberPricePerDay !== null && rule.nonMemberPricePerDay !== undefined) {
                            return `${Math.round(Number(rule.nonMemberPricePerDay))} kr/døgn`
                          } else {
                            return `${Math.round(Number(dailyPrice))} kr/døgn`
                          }
                        case "FIXED_DURATION":
                          const fixedPriceForDuration = isMember
                            ? (rule.memberFixedPrice ?? rule.nonMemberFixedPrice)
                            : (rule.nonMemberFixedPrice ?? rule.memberFixedPrice)
                          
                          if (fixedPriceForDuration === null || fixedPriceForDuration === undefined || fixedPriceForDuration === 0) {
                            return "Fast pris"
                          }
                          
                          const h = Math.floor((rule.fixedPriceDuration || 0) / 60)
                          const m = (rule.fixedPriceDuration || 0) % 60
                          const durationStr = h > 0 && m > 0 ? `${h}t ${m}m` : h > 0 ? `${h}t` : `${m}m`
                          
                          return `${Math.round(Number(fixedPriceForDuration))} kr/${durationStr}`
                        default:
                          return "Ukjent"
                      }
                    }

                      return (
                        <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">Hele {resource.name}</span>
                            <span className="text-sm font-semibold text-blue-600">{getPricingDescription(rule.model)}</span>
                          </div>
                          {/* Vis fastprispakker som egen seksjon under timepris */}
                          {resourceFixedPackages.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <p className="text-xs font-medium text-gray-500 mb-2">Fastprispakker:</p>
                              <div className="grid gap-1.5">
                                {resourceFixedPackages.map(pkg => {
                                  const h = Math.floor(pkg.durationMinutes / 60)
                                  const m = pkg.durationMinutes % 60
                                  const duration = h > 0 && m > 0 ? `${h}t ${m}m` : h > 0 ? `${h} ${h === 1 ? 'time' : 'timer'}` : `${m} min`
                                  return (
                                    <div key={pkg.id} className="flex items-center justify-between text-sm bg-purple-50 px-3 py-1.5 rounded-md">
                                      <span className="text-purple-800">{pkg.name}</span>
                                      <span className="text-purple-900 font-medium">{Math.round(pkg.price)} kr <span className="text-purple-600 font-normal">/ {duration}</span></span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()
                  ) : resource.allowWholeBooking && resourceFixedPackages.length > 0 ? (
                    // Vis kun fastprispakker hvis ingen timepris
                    <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">Hele {resource.name}</span>
                      </div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Fastprispakker:</p>
                      <div className="grid gap-1.5">
                        {resourceFixedPackages.map(pkg => {
                          const h = Math.floor(pkg.durationMinutes / 60)
                          const m = pkg.durationMinutes % 60
                          const duration = h > 0 && m > 0 ? `${h}t ${m}m` : h > 0 ? `${h} ${h === 1 ? 'time' : 'timer'}` : `${m} min`
                          return (
                            <div key={pkg.id} className="flex items-center justify-between text-sm bg-purple-50 px-3 py-1.5 rounded-md">
                              <span className="text-purple-800">{pkg.name}</span>
                              <span className="text-purple-900 font-medium">{Math.round(pkg.price)} kr <span className="text-purple-600 font-normal">/ {duration}</span></span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                  
                  {resource.allowWholeBooking && !relevantRule && resourceFixedPackages.length === 0 ? (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-600">
                        Ingen prisregel funnet for din rolle.
                      </p>
                    </div>
                  ) : null}
                  
                  {/* Vis priser for hoveddeler og underdeler */}
                  {sortedPartsPricing.length > 0 && (
                    <div className="space-y-2">
                      {sortedPartsPricing.map(({ partId, partName, parentId, rule, fixedPackages }) => {
                        const isMember = session?.user?.isMember ?? false
                        
                        const getPricingDescription = (model: PricingModel) => {
                          switch (model) {
                            case "FREE":
                              return "Gratis"
                            case "HOURLY":
                              const hourlyPrice = isMember 
                                ? (rule.memberPricePerHour ?? rule.nonMemberPricePerHour)
                                : (rule.nonMemberPricePerHour ?? rule.memberPricePerHour)
                              
                              if (hourlyPrice === null || hourlyPrice === undefined || hourlyPrice === 0) {
                                return "Per time"
                              }
                              
                              if (isMember && rule.memberPricePerHour !== null && rule.memberPricePerHour !== undefined) {
                                return `${Math.round(Number(rule.memberPricePerHour))} kr/time`
                              } else if (!isMember && rule.nonMemberPricePerHour !== null && rule.nonMemberPricePerHour !== undefined) {
                                return `${Math.round(Number(rule.nonMemberPricePerHour))} kr/time`
                              } else {
                                return `${Math.round(Number(hourlyPrice))} kr/time`
                              }
                            case "DAILY":
                              const dailyPrice = isMember
                                ? (rule.memberPricePerDay ?? rule.nonMemberPricePerDay)
                                : (rule.nonMemberPricePerDay ?? rule.memberPricePerDay)
                              
                              if (dailyPrice === null || dailyPrice === undefined || dailyPrice === 0) {
                                return "Per døgn"
                              }
                              
                              if (isMember && rule.memberPricePerDay !== null && rule.memberPricePerDay !== undefined) {
                                return `${Math.round(Number(rule.memberPricePerDay))} kr/døgn`
                              } else if (!isMember && rule.nonMemberPricePerDay !== null && rule.nonMemberPricePerDay !== undefined) {
                                return `${Math.round(Number(rule.nonMemberPricePerDay))} kr/døgn`
                              } else {
                                return `${Math.round(Number(dailyPrice))} kr/døgn`
                              }
                            case "FIXED_DURATION":
                              const fixedPriceForDuration = isMember
                                ? (rule.memberFixedPrice ?? rule.nonMemberFixedPrice)
                                : (rule.nonMemberFixedPrice ?? rule.memberFixedPrice)
                              
                              if (fixedPriceForDuration === null || fixedPriceForDuration === undefined || fixedPriceForDuration === 0) {
                                return "Fast pris"
                              }
                              
                              const h = Math.floor((rule.fixedPriceDuration || 0) / 60)
                              const m = (rule.fixedPriceDuration || 0) % 60
                              const durationStr = h > 0 && m > 0 ? `${h}t ${m}m` : h > 0 ? `${h}t` : `${m}m`
                              
                              return `${Math.round(Number(fixedPriceForDuration))} kr/${durationStr}`
                            default:
                              return "Ukjent"
                          }
                        }
                        
                        const isChildPart = !!parentId
                        
                        const formatDuration = (minutes: number) => {
                          const h = Math.floor(minutes / 60)
                          const m = minutes % 60
                          if (h > 0 && m > 0) return `${h}t ${m}m`
                          if (h > 0) return `${h} ${h === 1 ? 'time' : 'timer'}`
                          return `${m} min`
                        }
                        
                        return (
                          <div key={partId} className={`p-3 rounded-lg border shadow-sm ${isChildPart ? 'ml-4 bg-gray-50 border-gray-200' : 'bg-white border-gray-200'}`}>
                            <div className="flex items-center justify-between">
                              <span className={`text-sm font-medium ${isChildPart ? 'text-gray-700' : 'text-gray-900'}`}>{partName}</span>
                              {rule && (
                                <span className="text-sm font-semibold text-blue-600">{getPricingDescription(rule.model)}</span>
                              )}
                            </div>
                            
                            {/* Vis fastprispakker som egen seksjon */}
                            {fixedPackages && fixedPackages.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                <p className="text-xs font-medium text-gray-500 mb-2">Fastprispakker:</p>
                                <div className="grid gap-1.5">
                                  {fixedPackages.map(pkg => (
                                    <div key={pkg.id} className="flex items-center justify-between text-sm bg-purple-50 px-3 py-1.5 rounded-md">
                                      <span className="text-purple-800">{pkg.name}</span>
                                      <span className="text-purple-900 font-medium">{Math.round(pkg.price)} kr <span className="text-purple-600 font-normal">/ {formatDuration(pkg.durationMinutes)}</span></span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                          </div>
                        )
                      })}
                    </div>
                  )}
                  
                  {partsPricing.length === 0 && resource.parts.length > 0 && pricingEnabled && !resource.allowWholeBooking && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-600">
                        Ingen prisregler funnet for delene.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Parts - Mer informasjon */}
            {resource.parts.length > 0 && (resource as any).visDelinfoKort !== false && (
              <PartsList 
                parts={partsWithImage}
                sortedParts={sortedParts}
              />
            )}

            {/* Opening hours */}
            {openingHours && (
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Åpningstider</h3>
                <div className="space-y-2">
                  {Object.entries(openingHours).map(([day, hours]) => {
                    const h = hours as { open: string; close: string }
                    return (
                      <div key={day} className="flex justify-between text-sm">
                        <span className="text-gray-600">{dayNames[day]}</span>
                        <span className="text-gray-900 font-medium">
                          {h.open} - {h.close}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

