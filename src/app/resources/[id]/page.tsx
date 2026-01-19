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
import { PricingInfoCardLoader } from "@/components/PricingInfoCardLoader"

// Kort cache for at endringer vises raskt
export const revalidate = 60 // 1 minutt

interface Props {
  params: Promise<{ id: string }>
}

// Fetch resource data - alt tunge (pricing, bookings) hentes client-side for instant load
async function getResource(id: string) {
  try {
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
              select: { 
                id: true, 
                name: true,
                parentId: true,
                // Nivå 3 (grandchildren)
                children: {
                  where: { isActive: true },
                  select: { id: true, name: true, parentId: true }
                }
              }
            }
          },
          orderBy: { name: "asc" }
        }
      }
    })

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
  
  // Hent resource data - pricing og bookings hentes client-side for raskere load
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

  // Pricing-sjekk og data hentes nå client-side via PricingInfoCardLoader

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      <Navbar />

      {/* Hero - compact on mobile, with top padding for navbar */}
      <div className="relative h-36 sm:h-64 md:h-80 pt-2 sm:pt-0">
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
        <div className="absolute inset-0 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex flex-col justify-between pt-3 pb-3 sm:justify-end sm:pt-0 sm:pb-8">
          <Link 
            href="/resources" 
            className="inline-flex items-center gap-1.5 sm:gap-2 text-white/80 hover:text-white text-xs sm:text-sm w-fit"
          >
            <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="sm:hidden">Tilbake</span>
            <span className="hidden sm:inline">Tilbake til fasiliteter</span>
          </Link>
          <div>
            <span className="inline-block px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs sm:text-sm mb-1.5 sm:mb-3">
              {resource.category?.name || "Fasilitet"}
            </span>
            <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-white">{resource.name}</h1>
            {resource.location && (
              <p className="text-white/80 flex items-center gap-1 sm:gap-2 mt-1 sm:mt-2 text-xs sm:text-base">
                <MapPin className="w-3 h-3 sm:w-5 sm:h-5" />
                {resource.location}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-8 pb-24 sm:pb-8">
        <div className="grid lg:grid-cols-3 gap-3 sm:gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-3 sm:space-y-8 order-2 lg:order-1">
            {/* Description - hidden on mobile */}
            {resource.description && (
              <div className="card p-3 sm:p-6 hidden sm:block">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Om fasiliteten</h2>
                <p className="text-gray-600">{resource.description}</p>
              </div>
            )}

            {/* Map Overview */}
            {resource.mapImage && resource.parts.length > 0 && (
              <div className="card p-3 sm:p-6">
                <h2 className="text-sm sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                  <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  Kart
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
            <div className="card p-3 sm:p-6">
              <h2 className="text-sm sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                Kalender
              </h2>
              <ResourceCalendar 
                resourceId={resource.id}
                resourceName={resource.name}
                resourceColor={resource.color || resource.category?.color || "#3b82f6"}
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
          <div className="space-y-3 sm:space-y-6 order-1 lg:order-2">
            {/* Book button - only visible on desktop, mobile uses sticky button */}
            <div className="hidden sm:block">
              <Link
                href={`/resources/${resource.id}/book`}
                className="btn btn-primary w-full py-4 text-lg flex"
              >
                <Calendar className="w-5 h-5" />
                Book nå
              </Link>
            </div>

            {/* Quick info - Vises kun hvis minst én innstilling er aktiv */}
            {((resource.minBookingMinutes !== 0 && resource.minBookingMinutes !== null) || 
              (resource.maxBookingMinutes !== 9999 && resource.maxBookingMinutes !== null) ||
              (resource.minBookingHours && Number(resource.minBookingHours) > 0) ||
              resource.advanceBookingDays ||
              resource.requiresApproval) && (
              <div className="card p-3 sm:p-6">
                <h3 className="font-semibold text-gray-900 mb-2 sm:mb-4 text-sm sm:text-base">Booking-info</h3>
                <div className="space-y-2 sm:space-y-4">
                  {/* Minimum antall timer - vises kun hvis satt */}
                  {resource.minBookingHours && Number(resource.minBookingHours) > 0 && (
                    <div className="flex items-start gap-2 sm:gap-3">
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-xs sm:text-sm font-medium text-gray-900">Min. varighet</p>
                        <p className="text-xs sm:text-sm text-gray-500">
                          {Number(resource.minBookingHours)} timer
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Varighet - vises kun hvis begrenset */}
                  {((resource.minBookingMinutes !== 0 && resource.minBookingMinutes !== null) || 
                    (resource.maxBookingMinutes !== 9999 && resource.maxBookingMinutes !== null)) && (
                    <div className="flex items-start gap-2 sm:gap-3">
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-xs sm:text-sm font-medium text-gray-900">Varighet</p>
                        <p className="text-xs sm:text-sm text-gray-500">
                          {`${resource.minBookingMinutes || 0}-${resource.maxBookingMinutes || 9999} min`}
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Forhåndsbestilling - vises kun hvis begrenset */}
                  {resource.advanceBookingDays && (
                    <div className="flex items-start gap-2 sm:gap-3">
                      <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-xs sm:text-sm font-medium text-gray-900">Forhåndsbestilling</p>
                        <p className="text-xs sm:text-sm text-gray-500">
                          Inntil {resource.advanceBookingDays} dager frem
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Godkjenning - vises kun hvis kreves */}
                  {resource.requiresApproval && (
                    <div className="flex items-start gap-2 sm:gap-3">
                      <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 mt-0.5" />
                      <div>
                        <p className="text-xs sm:text-sm font-medium text-gray-900">Godkjenning kreves</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pricing - hentes client-side for instant page load */}
            {/* Viser enten moderne prislogikk ELLER legacy prisinfo basert på om betalingsmodul er aktivert */}
            {(resource.visPrislogikk || (resource.visPrisInfo && resource.prisInfo)) && (
              <PricingInfoCardLoader
                resourceId={resource.id}
                resourceName={resource.name}
                legacyPrisInfo={resource.visPrisInfo ? resource.prisInfo : null}
              />
            )}

            {/* Parts - Mer informasjon */}
            {resource.parts.length > 0 && (resource as any).visDelinfoKort !== false && (
              <PartsList 
                parts={partsWithImage}
                sortedParts={sortedParts}
              />
            )}

            {/* Opening hours - hidden on mobile */}
            {openingHours && (
              <div className="card p-3 sm:p-6 hidden sm:block">
                <h3 className="font-semibold text-gray-900 mb-2 sm:mb-4 text-sm sm:text-base">Åpningstider</h3>
                <div className="space-y-1 sm:space-y-2">
                  {Object.entries(openingHours).map(([day, hours]) => {
                    const h = hours as { open: string; close: string }
                    return (
                      <div key={day} className="flex justify-between text-xs sm:text-sm">
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

      {/* Sticky mobile book button - floating pill on right side */}
      <Link
        href={`/resources/${resource.id}/book`}
        className="fixed bottom-20 right-4 sm:hidden z-30 flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full shadow-lg transition-all active:scale-95"
        style={{ 
          boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
        }}
      >
        <Calendar className="w-4 h-4" />
        Book nå
      </Link>
    </div>
  )
}

