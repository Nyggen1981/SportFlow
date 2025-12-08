import { prisma } from "@/lib/prisma"
import Link from "next/link"
import Image from "next/image"
import { 
  Calendar, 
  LogIn,
  UserPlus,
  Building2,
  AlertCircle,
  ExternalLink
} from "lucide-react"
import { PublicCalendar } from "@/components/PublicCalendar"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Revalidate every 30 seconds for fresh booking data
export const revalidate = 30

async function getOrganization() {
  try {
    return await prisma.organization.findFirst()
  } catch {
    return null
  }
}

async function getResources() {
  try {
    return await prisma.resource.findMany({
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
    })
  } catch {
    return []
  }
}

async function getPublicBookings() {
  try {
    const now = new Date()
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const twoMonthsAhead = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

    return await prisma.booking.findMany({
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
  } catch {
    return []
  }
}

export default async function PublicHomePage() {
  // Try to get session, but don't fail if auth is not configured
  let session = null
  try {
    session = await getServerSession(authOptions)
  } catch {
    // Auth not configured or error - continue without session
  }
  
  const [organization, resources, bookings] = await Promise.all([
    getOrganization(),
    getResources(),
    getPublicBookings()
  ])
  
  const primaryColor = organization?.primaryColor || "#2563eb"
  const hasData = resources.length > 0

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
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
                <p className="text-xs text-gray-500">Kalender</p>
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

      {/* Main Calendar */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {hasData ? (
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
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Ingen fasiliteter tilgjengelig</h3>
            <p className="text-gray-600">
              Det er ingen fasiliteter konfigurert ennå. Kontakt administrator for å sette opp bookingsystemet.
            </p>
          </div>
        )}
      </main>

      {/* Footer - Arena Booking Product Promotion */}
      <footer className="bg-gradient-to-r from-slate-900 to-slate-800 text-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            {/* Arena Booking Brand */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Calendar className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-xl">Arena Booking</h3>
                <p className="text-slate-400 text-sm">Profesjonell booking for idrettslag</p>
              </div>
            </div>

            {/* Features */}
            <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                Enkel kalendervisning
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                Godkjenningsflyt
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                Tilpasset design
              </span>
            </div>

            {/* CTA */}
            <div className="text-center md:text-right">
              <p className="text-slate-400 text-sm mb-2">Trenger din klubb et bookingsystem?</p>
              <a 
                href="mailto:kontakt@arenabooking.no"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-medium transition-colors"
              >
                Ta kontakt
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-8 pt-6 border-t border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} Arena Booking. Alle rettigheter reservert.</p>
            <p>Laget med ❤️ for norsk idrett</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
