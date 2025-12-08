import { prisma } from "@/lib/prisma"
import Link from "next/link"
import Image from "next/image"
import { 
  Calendar, 
  LogIn,
  UserPlus,
  Building2,
  Info
} from "lucide-react"
import { unstable_cache } from "next/cache"
import { PublicCalendar } from "@/components/PublicCalendar"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Revalidate every 30 seconds for fresh booking data
export const revalidate = 30

// Cache organization data for 5 minutes (rarely changes)
const getOrganization = unstable_cache(
  async () => prisma.organization.findFirst(),
  ["organization"],
  { revalidate: 300 }
)

// Cache resources for 60 seconds
const getResources = unstable_cache(
  async () => prisma.resource.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      color: true,
      category: {
        select: { color: true }
      }
    },
    orderBy: { name: "asc" }
  }),
  ["public-resources"],
  { revalidate: 60 }
)

// Get all bookings for calendar (public view - only approved)
const getPublicBookings = unstable_cache(
  async () => {
    const now = new Date()
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const twoMonthsAhead = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

    return prisma.booking.findMany({
      where: {
        status: "approved",
        startTime: { gte: twoWeeksAgo, lte: twoMonthsAhead }
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        resourceId: true,
        resource: {
          select: { name: true }
        },
        resourcePart: {
          select: { name: true }
        }
      },
      orderBy: { startTime: "asc" }
    })
  },
  ["public-bookings"],
  { revalidate: 30 }
)

export default async function PublicHomePage() {
  // Try to get session, but don't fail if auth is not configured
  let session = null
  try {
    session = await getServerSession(authOptions)
  } catch {
    // Auth not configured or error - continue without session
  }
  
  const organization = await getOrganization()
  
  const [resources, bookings] = await Promise.all([
    getResources(),
    getPublicBookings()
  ])
  
  const primaryColor = organization?.primaryColor || "#2563eb"

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Organization branding */}
            <div className="flex items-center gap-3">
              {organization?.logo ? (
                <Image
                  src={organization.logo}
                  alt={organization.name || "Logo"}
                  width={40}
                  height={40}
                  className="rounded-lg"
                />
              ) : (
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Calendar className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <h1 className="font-bold text-gray-900">
                  {organization?.name || "Arena Booking"}
                </h1>
                <p className="text-xs text-gray-500">Booking av fasiliteter</p>
              </div>
            </div>

            {/* Auth buttons */}
            <div className="flex items-center gap-2">
              {session ? (
                <>
                  <Link 
                    href="/my-bookings"
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Mine bookinger
                  </Link>
                  {session.user?.role === "admin" && (
                    <Link 
                      href="/admin"
                      className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      Admin
                    </Link>
                  )}
                  <Link 
                    href="/resources"
                    className="btn btn-primary"
                  >
                    <Calendar className="w-4 h-4" />
                    Book nå
                  </Link>
                </>
              ) : (
                <>
                  <Link 
                    href="/login"
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    Logg inn
                  </Link>
                  <Link 
                    href="/register"
                    className="btn btn-primary"
                  >
                    <UserPlus className="w-4 h-4" />
                    Registrer deg
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero section with quick info */}
      <div 
        className="relative py-8"
        style={{ background: `linear-gradient(135deg, ${primaryColor}15, ${primaryColor}05)` }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-6 h-6" style={{ color: primaryColor }} />
                Bookingkalender
              </h2>
              <p className="text-gray-600 mt-1">
                Se ledige tider og planlagte aktiviteter for alle våre fasiliteter
              </p>
            </div>
            
            {/* Quick stats */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold" style={{ color: primaryColor }}>{resources.length}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Fasiliteter</p>
              </div>
              <div className="h-10 w-px bg-gray-200" />
              <Link 
                href="/resources"
                className="flex items-center gap-2 text-sm font-medium hover:underline"
                style={{ color: primaryColor }}
              >
                <Building2 className="w-4 h-4" />
                Se alle fasiliteter
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Calendar */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PublicCalendar 
          resources={resources.map(r => ({
            id: r.id,
            name: r.name,
            color: r.color || r.category?.color || '#3b82f6'
          }))}
          bookings={bookings.map(b => ({
            id: b.id,
            title: b.title,
            startTime: b.startTime.toISOString(),
            endTime: b.endTime.toISOString(),
            resourceId: b.resourceId,
            resourceName: b.resource.name,
            resourcePartName: b.resourcePart?.name
          }))}
          isLoggedIn={!!session}
        />

        {/* Info box for non-logged in users */}
        {!session && (
          <div className="mt-8 p-6 bg-blue-50 border border-blue-100 rounded-xl">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Info className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Vil du booke en fasilitet?</h3>
                <p className="text-gray-600 mt-1">
                  For å booke en av våre fasiliteter må du først registrere deg eller logge inn. 
                  Det er helt gratis for medlemmer av {organization?.name || "klubben"}.
                </p>
                <div className="flex items-center gap-3 mt-4">
                  <Link href="/register" className="btn btn-primary">
                    <UserPlus className="w-4 h-4" />
                    Registrer deg gratis
                  </Link>
                  <Link href="/login" className="text-sm text-blue-600 hover:underline">
                    Har du allerede bruker? Logg inn
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              {organization?.logo ? (
                <Image
                  src={organization.logo}
                  alt={organization.name || "Logo"}
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
              ) : (
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Calendar className="w-4 h-4 text-white" />
                </div>
              )}
              <span className="font-semibold text-gray-900">
                {organization?.name || "Arena Booking"}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} Arena Booking – Enkel booking for idrettslag
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
