"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { format } from "date-fns"
import { nb } from "date-fns/locale"
import { Calendar, MapPin, Clock, ChevronRight, Loader2, Plus } from "lucide-react"

interface Booking {
  id: string
  title: string
  startTime: string
  endTime: string
  status: string
  resource: {
    id: string
    name: string
    category?: {
      color: string | null
    } | null
  }
}

interface Resource {
  id: string
  name: string
  imageUrl?: string | null
  category?: {
    color: string | null
    name: string
  } | null
}

export function MobileHome() {
  const { data: session } = useSession()
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([])
  const [popularResources, setPopularResources] = useState<Resource[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch upcoming bookings if logged in
        if (session?.user) {
          const bookingsRes = await fetch("/api/my-bookings")
          if (bookingsRes.ok) {
            const bookings = await bookingsRes.json()
            // Get upcoming approved bookings
            const now = new Date()
            const upcoming = bookings
              .filter((b: Booking) => new Date(b.startTime) > now && b.status === "approved")
              .sort((a: Booking, b: Booking) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
              .slice(0, 3)
            setUpcomingBookings(upcoming)
          }
        }

        // Fetch resources
        const resourcesRes = await fetch("/api/resources")
        if (resourcesRes.ok) {
          const resources = await resourcesRes.json()
          setPopularResources(resources.slice(0, 4))
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [session])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-gray-50 min-h-full">
      {/* Welcome header */}
      <div className="bg-gradient-to-br from-teal-600 to-teal-700 text-white px-4 py-6">
        <h1 className="text-xl font-bold">
          {session?.user ? `Hei, ${session.user.name?.split(" ")[0] || "deg"}!` : "Velkommen!"}
        </h1>
        <p className="text-teal-100 text-sm mt-1">
          Hva vil du booke i dag?
        </p>
        
        {/* Quick book button */}
        <Link
          href="/resources"
          className="mt-4 flex items-center justify-center gap-2 w-full py-3 bg-white text-teal-700 font-semibold rounded-xl shadow-lg hover:shadow-xl transition-shadow"
        >
          <Plus className="w-5 h-5" />
          Book fasilitet
        </Link>
      </div>

      <div className="p-4 space-y-6">
        {/* Upcoming bookings */}
        {session?.user && upcomingBookings.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Kommende bookinger</h2>
              <Link href="/my-bookings" className="text-sm text-teal-600 font-medium">
                Se alle →
              </Link>
            </div>
            
            <div className="space-y-2">
              {upcomingBookings.map((booking) => {
                const startDate = new Date(booking.startTime)
                const color = booking.resource.category?.color || "#22c55e"

                return (
                  <Link
                    key={booking.id}
                    href="/my-bookings"
                    className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm"
                  >
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: color }}
                    >
                      {format(startDate, "d")}
                      <br />
                      {format(startDate, "MMM", { locale: nb })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">
                        {booking.title}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{format(startDate, "HH:mm")}</span>
                        <span>·</span>
                        <span className="truncate">{booking.resource.name}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Quick access to calendar */}
        {session?.user && (
          <Link
            href="/kalender"
            className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Kalender</h3>
              <p className="text-sm text-gray-500">Se alle bookinger</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
        )}

        {/* Popular/All resources */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Fasiliteter</h2>
            <Link href="/resources" className="text-sm text-teal-600 font-medium">
              Se alle →
            </Link>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {popularResources.map((resource) => (
              <Link
                key={resource.id}
                href={`/resources/${resource.id}`}
                className="bg-white rounded-xl overflow-hidden shadow-sm"
              >
                {resource.imageUrl ? (
                  <div className="relative h-24 bg-gray-200">
                    <Image
                      src={resource.imageUrl}
                      alt={resource.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="h-24 flex items-center justify-center"
                    style={{ backgroundColor: resource.category?.color || "#e5e7eb" }}
                  >
                    <MapPin className="w-8 h-8 text-white/70" />
                  </div>
                )}
                <div className="p-2">
                  <h3 className="font-medium text-gray-900 text-sm truncate">
                    {resource.name}
                  </h3>
                  {resource.category && (
                    <p className="text-xs text-gray-500 truncate">
                      {resource.category.name}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Login prompt for non-logged in users */}
        {!session?.user && (
          <div className="bg-white rounded-xl p-4 text-center shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-2">
              Logg inn for mer
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Logg inn for å booke fasiliteter og se dine bookinger
            </p>
            <Link
              href="/login"
              className="block w-full py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors"
            >
              Logg inn
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

