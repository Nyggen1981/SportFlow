import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { PublicCalendar } from "@/components/PublicCalendar"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Revalidate every 30 seconds for fresh booking data
export const revalidate = 30


async function getResources() {
  try {
    return await prisma.resource.findMany({
      where: { 
        isActive: true
      },
      select: {
        id: true,
        name: true,
        color: true,
        categoryId: true,
        category: {
          select: { 
            id: true,
            name: true,
            color: true 
          }
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
}

async function getCategories() {
  try {
    return await prisma.resourceCategory.findMany({
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
  
  // Redirect logged-in users to the resources page
  if (session) {
    redirect("/resources")
  }
  
  const [resources, bookings, categories] = await Promise.all([
    getResources(),
    getPublicBookings(),
    getCategories()
  ])
  
  const hasData = resources.length > 0

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
            isLoggedIn={false}
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
