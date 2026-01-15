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
import { PricingInfoCard } from "@/components/PricingInfoCard"
import { getPricingConfig, isPricingEnabled, findPricingRuleForUser, hasPricingRulesForParts } from "@/lib/pricing"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getUserRoleInfo } from "@/lib/roles"

// Kort cache for at endringer vises raskt
export const revalidate = 60 // 1 minutt

interface Props {
  params: Promise<{ id: string }>
}

// Fetch resource data directly without unstable_cache to avoid caching issues
async function getResource(id: string) {
  try {
    const pricingEnabled = await isPricingEnabled()

    // Bookings hentes nå client-side via ResourceCalendar for raskere initial load
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
        }
      }
    })

    if (!resource) return null

    // Hvis pricing er aktivert, filtrer ut deler uten prisregler
    // OPTIMALISERT: Bruker batch-spørring i stedet for N+1 spørringer
    if (pricingEnabled && resource.parts.length > 0) {
      const partIds = resource.parts.map(p => p.id)
      const partsWithPricingSet = await hasPricingRulesForParts(id, partIds)
      resource.parts = resource.parts.filter(p => partsWithPricingSet.has(p.id))
    }

    // Bookings og konkurranser hentes nå client-side via ResourceCalendar
    return { ...resource, pricingEnabled }
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
  
  // Parallelliser session og resource-henting for bedre ytelse
  const [session, resource] = await Promise.all([
    getServerSession(authOptions),
    getResource(id)
  ])

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

  // Hent prislogikk-konfigurasjon (kun hvis aktivert)
  // Gjenbruker pricingEnabled fra getResource() for å unngå ekstra lisenssjekk
  const pricingEnabled = resource.pricingEnabled
  const pricingConfig = pricingEnabled ? await getPricingConfig(id, null) : null
  
  
  // Finn relevant prisregel for den innloggede brukeren (kun hvis allowWholeBooking er true)
  let relevantRule: { rule: any; reason?: string } | null = null
  let customRoles: Array<{ id: string; name: string }> = []
  let partsPricing: Array<{ partId: string; partName: string; parentId: string | null; rule: any; reason?: string; fixedPackages?: Array<{ id: string; name: string; durationMinutes: number; price: number; memberPrice?: number | null }>; memberRule?: any }> = []
  let resourceFixedPackages: Array<{ id: string; name: string; durationMinutes: number; price: number; memberPrice?: number | null }> = []
  let isNonMember = false // Flagg for å vise medlemsbesparelser
  let memberRule: any = null // Medlemsprisregel for sammenligning (hele fasilitet)
  
  if (pricingEnabled && session?.user?.id) {
    try {
      // Brukerrolleinformasjon for filtrering av fastprispakker
      const userSystemRole = (session.user as any).systemRole || session.user.role || "user"
      const userRoleId = (session.user as any).customRoleId
      const isMember = (session.user as any).isMember
      
      // Sett isNonMember for å vise besparelser
      isNonMember = !isMember && userSystemRole !== "admin"
      
      // Hjelpefunksjon for å filtrere pakker basert på brukerens rolle
      // VIKTIG: Admin skal KUN se pakker der "admin" er eksplisitt valgt - ingen fallback
      const filterPackagesByRole = <T extends { forRoles: string | null }>(packages: T[]): T[] => {
        return packages.filter(pkg => {
          if (!pkg.forRoles) {
            // Ingen rollebegrensning - vis til alle UNNTATT admin (admin må være eksplisitt)
            return userSystemRole !== "admin"
          }
          try {
            const allowedRoles: string[] = JSON.parse(pkg.forRoles)
            if (allowedRoles.length === 0) {
              // Tom liste = vis til alle UNNTATT admin
              return userSystemRole !== "admin"
            }
            
            // Admin sjekkes først og får IKKE fallback til andre roller
            if (userSystemRole === "admin") {
              return allowedRoles.includes("admin")
            }
            
            // PRIORITET FOR VANLIGE BRUKERE:
            // 1. Custom role (f.eks. Lagleder, Trener) - sjekkes FØRST
            // 2. Verifisert medlem (isMember: true)
            // 3. Ikke-medlem ("user") - KUN hvis ingen custom role
            
            // 1. Sjekk custom role først - brukere med custom role skal IKKE falle tilbake til "user"
            if (userRoleId && allowedRoles.includes(userRoleId)) return true
            
            // 2. Sjekk om bruker er verifisert medlem
            if (isMember && allowedRoles.includes("member")) return true
            
            // 3. Sjekk "user" (ikke-medlem) KUN hvis bruker ikke har custom role
            if (!userRoleId && !isMember && allowedRoles.includes("user")) return true
            
            return false
          } catch {
            return userSystemRole !== "admin"
          }
        })
      }
      
      // Hjelpefunksjon for å finne medlemspakker (kun for ikke-medlemmer)
      const filterMemberPackages = <T extends { forRoles: string | null }>(packages: T[]): T[] => {
        return packages.filter(pkg => {
          if (!pkg.forRoles) return false
          try {
            const allowedRoles: string[] = JSON.parse(pkg.forRoles)
            return allowedRoles.includes("member")
          } catch {
            return false
          }
        })
      }
      
      // Hjelpefunksjon for å finne medlemspris for en pakke (basert på navn)
      const findMemberPriceForPackage = <T extends { name: string; price: any; forRoles: string | null }>(
        pkg: T,
        allPackages: T[]
      ): number | null => {
        const memberPackages = filterMemberPackages(allPackages)
        const matchingPackage = memberPackages.find(mp => mp.name === pkg.name)
        return matchingPackage ? Number(matchingPackage.price) : null
      }
      
      // Hjelpefunksjon for å finne medlemsprisregel
      const findMemberRule = (rules: any[]): any | null => {
        if (!Array.isArray(rules)) return null
        return rules.find(r => r.forRoles?.includes("member")) || null
      }
      
      const partIds = resource.parts.map(p => p.id)
      
      // PARALLELLISER alle database-spørringer for bedre ytelse
      const [
        customRolesResult,
        wholeResourcePackages,
        allPartPackages,
        allPartsWithPricing,
        wholeResourceRule
      ] = await Promise.all([
        // Custom roles
        prisma.customRole.findMany({
          where: { organizationId: resource.organizationId },
          select: { id: true, name: true }
        }),
        // Hele-fasilitet pakker (kun hvis allowWholeBooking)
        resource.allowWholeBooking
          ? prisma.fixedPricePackage.findMany({
              where: { resourceId: id, resourcePartId: null, isActive: true },
              select: { id: true, name: true, description: true, durationMinutes: true, price: true, forRoles: true },
              orderBy: { sortOrder: "asc" }
            })
          : Promise.resolve([]),
        // Del-pakker (kun hvis det finnes deler)
        partIds.length > 0
          ? prisma.fixedPricePackage.findMany({
              where: { resourcePartId: { in: partIds }, isActive: true },
              select: { id: true, name: true, description: true, durationMinutes: true, price: true, forRoles: true, resourcePartId: true },
              orderBy: { sortOrder: "asc" }
            })
          : Promise.resolve([]),
        // Del-prisregler (kun hvis det finnes deler)
        partIds.length > 0
          ? prisma.resourcePart.findMany({
              where: { id: { in: partIds } },
              select: { id: true, pricingRules: true }
            })
          : Promise.resolve([]),
        // Hele-fasilitet prisregel
        resource.allowWholeBooking && pricingConfig?.rules
          ? findPricingRuleForUser(session.user.id, pricingConfig.rules)
          : Promise.resolve(null)
      ])
      
      customRoles = customRolesResult
      relevantRule = wholeResourceRule
      
      // Finn medlemsprisregel for hele fasilitet (kun for ikke-medlemmer)
      if (isNonMember && pricingConfig?.rules) {
        memberRule = findMemberRule(pricingConfig.rules)
      }
      
      // Filtrer hele-fasilitet pakker
      if (wholeResourcePackages.length > 0) {
        resourceFixedPackages = filterPackagesByRole(wholeResourcePackages)
          .map((pkg) => ({
            id: pkg.id,
            name: pkg.name,
            description: pkg.description,
            durationMinutes: pkg.durationMinutes,
            price: Number(pkg.price),
            memberPrice: isNonMember ? findMemberPriceForPackage(pkg, wholeResourcePackages) : null
          }))
      }
      
      // Prosesser del-pakker
      if (resource.parts.length > 0) {
        // Grupper pakker etter del-ID
        const packagesByPartId = new Map<string, typeof allPartPackages>()
        for (const pkg of allPartPackages) {
          if (!pkg.resourcePartId) continue
          const existing = packagesByPartId.get(pkg.resourcePartId) || []
          existing.push(pkg)
          packagesByPartId.set(pkg.resourcePartId, existing)
        }
        
        // Prosesser hver del med parallelle prisregel-oppslag
        const partRulePromises = resource.parts.map(async (part) => {
          const partPackages = packagesByPartId.get(part.id) || []
          
          // Filtrer pakker basert på brukerens rolle og legg til medlemspris for sammenligning
          const fixedPackages = filterPackagesByRole(partPackages)
            .map((pkg) => ({
              id: pkg.id,
              name: pkg.name,
              description: pkg.description,
              durationMinutes: pkg.durationMinutes,
              price: Number(pkg.price),
              memberPrice: isNonMember ? findMemberPriceForPackage(pkg, partPackages) : null
            }))
          
          // Finn prisregel fra forhåndslastet data
          const partPricingData = allPartsWithPricing.find(p => p.id === part.id)
          let partRule: { rule: any; reason?: string } | null = null
          let partMemberRule: any = null
          
          if (partPricingData?.pricingRules) {
            try {
              const rules = JSON.parse(partPricingData.pricingRules as string)
              if (Array.isArray(rules) && rules.length > 0) {
                partRule = await findPricingRuleForUser(session.user.id, rules)
                // Finn medlemsprisregel for sammenligning (kun for ikke-medlemmer)
                if (isNonMember) {
                  partMemberRule = findMemberRule(rules)
                }
              }
            } catch {
              // Ignorer parse-feil
            }
          }
          
          // Returner data hvis brukeren har tilgang
          if (partRule?.rule || fixedPackages.length > 0) {
            return {
              partId: part.id,
              partName: part.name,
              parentId: part.parentId || null,
              rule: partRule?.rule || null,
              reason: partRule?.reason,
              fixedPackages: fixedPackages,
              memberRule: partMemberRule
            }
          }
          return null
        })
        
        // Vent på alle prisregel-oppslag parallelt
        const partResults = await Promise.all(partRulePromises)
        partsPricing = partResults.filter((p): p is NonNullable<typeof p> => p !== null)
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
            {(() => {
              // Sjekk om brukeren kan booke denne fasiliteten
              // Hvis pricing ikke er aktivert, kan alle booke
              // Hvis pricing er aktivert, må brukeren ha en prisregel eller fastprispakke
              const canBookWholeResource = resource.allowWholeBooking && (relevantRule?.rule || resourceFixedPackages.length > 0)
              const canBookParts = partsPricing.length > 0
              const canBook = !pricingEnabled || canBookWholeResource || canBookParts
              
              if (canBook) {
                return (
                  <Link
                    href={`/resources/${resource.id}/book`}
                    className="btn btn-primary w-full py-4 text-lg"
                  >
                    <Calendar className="w-5 h-5" />
                    Book nå
                  </Link>
                )
              } else {
                return (
                  <div className="space-y-2">
                    <button
                      disabled
                      className="btn btn-primary w-full py-4 text-lg opacity-50 cursor-not-allowed"
                    >
                      <Calendar className="w-5 h-5" />
                      Book nå
                    </button>
                    <p className="text-sm text-center text-amber-600 bg-amber-50 p-3 rounded-lg">
                      Din brukerrolle har ikke tilgang til å booke denne fasiliteten. Kontakt administrator for mer informasjon.
                    </p>
                  </div>
                )
              }
            })()}

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

            {/* Price info - Kun for standardlisens (ikke betalingsmodul) */}
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

            {/* Pricing Logic (kun hvis betalingsmodulen er aktivert og visPrislogikk er true) */}
            {pricingEnabled && resource.visPrislogikk && (
              <PricingInfoCard
                resourceName={resource.name}
                allowWholeBooking={resource.allowWholeBooking}
                relevantRule={relevantRule?.rule || null}
                resourceFixedPackages={resourceFixedPackages}
                partsPricing={sortedPartsPricing.map(p => ({
                  partId: p.partId,
                  partName: p.partName,
                  parentId: p.parentId,
                  rule: p.rule || null,
                  fixedPackages: p.fixedPackages,
                  memberRule: p.memberRule || null
                }))}
                customRoles={customRoles}
                isNonMember={isNonMember}
                memberRule={memberRule}
              />
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

