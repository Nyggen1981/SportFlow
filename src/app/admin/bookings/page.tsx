"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import Link from "next/link"
import { 
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Calendar,
  User,
  Mail,
  Phone
} from "lucide-react"
import { format } from "date-fns"
import { nb } from "date-fns/locale"

interface Booking {
  id: string
  title: string
  description: string | null
  startTime: string
  endTime: string
  status: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  resource: {
    name: string
  }
  resourcePart: {
    name: string
  } | null
  user: {
    name: string | null
    email: string
  }
}

export default function AdminBookingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<"pending" | "all">("pending")
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user?.role !== "admin") {
      router.push("/")
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user?.role === "admin") {
      fetchBookings()
    }
  }, [session, filter])

  const fetchBookings = async () => {
    setIsLoading(true)
    const response = await fetch(`/api/admin/bookings?status=${filter}`)
    const data = await response.json()
    setBookings(data)
    setIsLoading(false)
  }

  const handleAction = async (bookingId: string, action: "approve" | "reject") => {
    setProcessingId(bookingId)
    
    const response = await fetch(`/api/admin/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    })

    if (response.ok) {
      setBookings(bookings.filter(b => b.id !== bookingId))
    }
    
    setProcessingId(null)
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Tilbake til dashboard
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Behandle bookinger</h1>
            <p className="text-gray-500">Godkjenn eller avslå bookingforespørsler</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("pending")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "pending" 
                  ? "bg-amber-100 text-amber-700" 
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Clock className="w-4 h-4 inline mr-1" />
              Ventende
            </button>
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "all" 
                  ? "bg-blue-100 text-blue-700" 
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              Alle
            </button>
          </div>
        </div>

        {bookings.length === 0 ? (
          <div className="card p-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {filter === "pending" ? "Ingen ventende bookinger" : "Ingen bookinger"}
            </h2>
            <p className="text-gray-500">
              {filter === "pending" 
                ? "Alle bookinger er behandlet 🎉" 
                : "Det er ingen bookinger i systemet"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div key={booking.id} className="card p-6 animate-fadeIn">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">{booking.title}</h3>
                      <span className={`status-badge ${
                        booking.status === "pending" ? "status-pending" :
                        booking.status === "approved" ? "status-approved" :
                        booking.status === "rejected" ? "status-rejected" :
                        "status-cancelled"
                      }`}>
                        {booking.status === "pending" ? "Venter" :
                         booking.status === "approved" ? "Godkjent" :
                         booking.status === "rejected" ? "Avslått" : "Kansellert"}
                      </span>
                    </div>

                    <p className="text-gray-600 mb-4">
                      {booking.resource.name}
                      {booking.resourcePart && ` → ${booking.resourcePart.name}`}
                    </p>

                    {booking.description && (
                      <p className="text-sm text-gray-500 mb-4">{booking.description}</p>
                    )}

                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {format(new Date(booking.startTime), "EEEE d. MMMM yyyy", { locale: nb })}
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {format(new Date(booking.startTime), "HH:mm")} - {format(new Date(booking.endTime), "HH:mm")}
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <User className="w-4 h-4 text-gray-400" />
                        {booking.user.name || booking.contactName || "Ukjent"}
                      </div>
                      {(booking.contactEmail || booking.user.email) && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail className="w-4 h-4 text-gray-400" />
                          {booking.contactEmail || booking.user.email}
                        </div>
                      )}
                      {booking.contactPhone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-4 h-4 text-gray-400" />
                          {booking.contactPhone}
                        </div>
                      )}
                    </div>
                  </div>

                  {booking.status === "pending" && (
                    <div className="flex gap-3 lg:flex-col">
                      <button
                        onClick={() => handleAction(booking.id, "approve")}
                        disabled={processingId === booking.id}
                        className="btn btn-success flex-1 lg:flex-none disabled:opacity-50"
                      >
                        {processingId === booking.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        Godkjenn
                      </button>
                      <button
                        onClick={() => handleAction(booking.id, "reject")}
                        disabled={processingId === booking.id}
                        className="btn btn-danger flex-1 lg:flex-none disabled:opacity-50"
                      >
                        {processingId === booking.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        Avslå
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

