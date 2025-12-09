import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { PublicCalendar } from "@/components/PublicCalendar"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { unstable_cache } from "next/cache"

// Revalidate every 30 seconds for fresh booking data
export const revalidate = 30

// Cache resources for 60 seconds
const getResources = unstable_cache(
  async () => {
    try {
      return await prisma.resource.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          color: true,
          categoryId: true,
          category: {
            select: { id: true, name: true, color: true }
          }
        },
        orderBy: [
          { category: { name: "asc" } },
          { name: "asc" }
        ]
      })
    } catch {
      return []
    }
  },
  ["public-resources"],
  { revalidate: 60 }
)

// Cache categories for 5 minutes
const getCategories = unstable_cache(
  async () => {
    try {
      return await prisma.resourceCategory.findMany({
        orderBy: { name: "asc" }
      })
    } catch {
      return []
    }
  },
  ["public-categories"],
  { revalidate: 300 }
)

// Cache bookings for 30 seconds (time-sensitive)
const getPublicBookings = unstable_cache(
  async () => {
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
          resource: { select: { name: true } },
          resourcePart: { select: { name: true } }
        },
        orderBy: { startTime: "asc" }
      })
    } catch {
      return []
    }
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
  
  const [resources, bookings, categories] = await Promise.all([
    getResources(),
    getPublicBookings(),
    getCategories()
  ])
  
  const hasData = resources.length > 0
  
  // If no resources and user is not logged in, redirect to registration
  // (new customers should register their club first)
  if (!hasData && !session) {
    redirect("/register")
  }
  
  // Only redirect logged-in users to resources page if there are resources
  // If no resources but logged in, keep them on public calendar (they can set up facilities)
  if (session && hasData) {
    redirect("/resources")
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      {/* Main Calendar */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {hasData ? (
          <PublicCalendar 
            categories={categories.map(c => ({
              id: c.id,
              name: c.name,
              color: c.color
            }))}
            resources={resources.map(r => ({
              id: r.id,
              name: r.name,
              color: r.color || r.category?.color || '#3b82f6',
              categoryId: r.categoryId,
              categoryName: r.category?.name
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

      <Footer />
    </div>
  )
}
