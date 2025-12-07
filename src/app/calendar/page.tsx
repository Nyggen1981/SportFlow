import { Navbar } from "@/components/Navbar"
import { prisma } from "@/lib/prisma"
import { CalendarView } from "@/components/CalendarView"

// Disable caching to always show fresh data
export const dynamic = 'force-dynamic'

async function getResources() {
  return prisma.resource.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      category: {
        select: { color: true }
      }
    }
  })
}

async function getBookings() {
  const now = new Date()
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const twoMonthsAhead = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

  return prisma.booking.findMany({
    where: {
      status: { in: ["approved", "pending"] },
      startTime: { gte: twoWeeksAgo, lte: twoMonthsAhead }
    },
    include: {
      resource: true,
      resourcePart: true
    },
    orderBy: { startTime: "asc" }
  })
}

export default async function CalendarPage() {
  const [resources, bookings] = await Promise.all([
    getResources(),
    getBookings()
  ])

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Kalender</h1>
        <p className="text-gray-500 mb-6">Oversikt over alle bookinger på tvers av fasiliteter</p>

        <CalendarView 
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
            status: b.status,
            resourceId: b.resourceId,
            resourceName: b.resource.name,
            resourcePartName: b.resourcePart?.name
          }))}
        />
      </div>
    </div>
  )
}

