import { Navbar } from "@/components/Navbar"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import Image from "next/image"
import { 
  Calendar, 
  Clock, 
  MapPin, 
  ArrowRight, 
  CheckCircle2,
  Users,
  Building2
} from "lucide-react"

async function getOrganization() {
  return prisma.organization.findFirst()
}

async function getResources() {
  return prisma.resource.findMany({
    where: { isActive: true },
    include: {
      category: true,
      parts: true,
      _count: {
        select: { bookings: { where: { status: "approved" } } }
      }
    },
    orderBy: { name: "asc" }
  })
}

async function getUpcomingBookings() {
  return prisma.booking.findMany({
    where: {
      status: "approved",
      startTime: { gte: new Date() }
    },
    include: {
      resource: true,
      resourcePart: true
    },
    orderBy: { startTime: "asc" },
    take: 5
  })
}

export default async function HomePage() {
  const [organization, resources, upcomingBookings] = await Promise.all([
    getOrganization(),
    getResources(),
    getUpcomingBookings()
  ])
  
  const primaryColor = organization?.primaryColor || "#2563eb"
  const secondaryColor = organization?.secondaryColor || "#1e40af"

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div 
          className="absolute inset-0" 
          style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
        />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="text-center">
            {/* Club Logo & Name */}
            <div className="flex flex-col items-center mb-8">
              {organization?.logo && (
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-white/10 backdrop-blur-sm p-3 mb-4 shadow-xl">
                  <Image
                    src={organization.logo}
                    alt={organization.name || "Klubblogo"}
                    width={128}
                    height={128}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-2">
                {organization?.name || "Velkommen"}
              </h1>
              <p className="text-white/70 text-sm uppercase tracking-widest">
                Booking av fasiliteter
              </p>
            </div>

            {/* Subtitle */}
            <p className="text-xl text-white/90 max-w-2xl mx-auto mb-10">
              Se ledige tider, book treningsøkter og hold oversikt over alle klubbens fasiliteter på ett sted.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/resources" 
                className="btn bg-white hover:bg-white/90 px-8 py-4 text-lg font-semibold shadow-lg"
                style={{ color: primaryColor }}
              >
                Se fasiliteter
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/calendar" className="btn btn-secondary border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg">
                <Calendar className="w-5 h-5" />
                Åpne kalender
              </Link>
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="#f8fafc"/>
          </svg>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Building2, label: "Fasiliteter", value: resources.length },
            { icon: Calendar, label: "Bookinger i dag", value: upcomingBookings.filter(b => {
              const today = new Date()
              return b.startTime.toDateString() === today.toDateString()
            }).length },
            { icon: Users, label: "Aktive brukere", value: "50+" },
            { icon: CheckCircle2, label: "Bookinger totalt", value: resources.reduce((sum, r) => sum + r._count.bookings, 0) }
          ].map((stat, i) => (
            <div key={i} className="card p-6 text-center">
              <stat.icon className="w-8 h-8 mx-auto mb-3 text-blue-600" />
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Resources Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Våre fasiliteter</h2>
            <p className="text-gray-500 mt-1">Velg en fasilitet for å se ledige tider og booke</p>
          </div>
          <Link href="/resources" className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            Se alle
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
          {resources.slice(0, 6).map((resource) => (
            <Link 
              key={resource.id} 
              href={`/resources/${resource.id}`}
              className="card card-interactive overflow-hidden group"
            >
              <div 
                className="h-32 relative"
                style={{ 
                  background: `linear-gradient(135deg, ${resource.category?.color || '#3b82f6'}dd, ${resource.category?.color || '#3b82f6'}99)`
                }}
              >
                <div className="absolute inset-0 bg-black/10" />
                <div className="absolute bottom-4 left-4">
                  <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm font-medium">
                    {resource.category?.name || "Fasilitet"}
                  </span>
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {resource.name}
                </h3>
                {resource.location && (
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                    <MapPin className="w-4 h-4" />
                    {resource.location}
                  </p>
                )}
                <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                  {resource.description}
                </p>
                {resource.parts.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {resource.parts.slice(0, 3).map((part) => (
                      <span key={part.id} className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                        {part.name}
                      </span>
                    ))}
                    {resource.parts.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                        +{resource.parts.length - 3} til
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Upcoming Bookings */}
      {upcomingBookings.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Kommende bookinger
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {upcomingBookings.map((booking) => (
                <div key={booking.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{booking.title}</p>
                      <p className="text-sm text-gray-500">
                        {booking.resource.name}
                        {booking.resourcePart && ` → ${booking.resourcePart.name}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      {booking.startTime.toLocaleDateString("nb-NO", { 
                        weekday: "short", 
                        day: "numeric", 
                        month: "short" 
                      })}
                    </p>
                    <p className="text-sm text-gray-500">
                      {booking.startTime.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}
                      {" - "}
                      {booking.endTime.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-gray-900">Arena Booking</span>
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
