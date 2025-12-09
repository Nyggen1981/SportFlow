"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import Link from "next/link"
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Hourglass,
  Trash2,
  ChevronRight,
  Plus,
  Pencil
} from "lucide-react"
import { EditBookingModal } from "@/components/EditBookingModal"
import { format, isToday, isTomorrow, isThisWeek, parseISO } from "date-fns"
import { nb } from "date-fns/locale"

interface Booking {
  id: string
  title: string
  description: string | null
  startTime: string
  endTime: string
  status: string
  statusNote: string | null
  resource: {
    id: string
    name: string
    location: string | null
    color?: string
  }
  resourcePart: { name: string } | null
}

type Tab = "upcoming" | "history"

export default function MyBookingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("upcoming")
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/my-bookings")
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetch("/api/bookings")
        .then(res => res.json())
        .then(data => {
          setBookings(data)
          setIsLoading(false)
        })
    }
  }, [session])

  const handleCancel = async (bookingId: string) => {
    setIsProcessing(true)
    const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    })
    if (response.ok) {
      setBookings(bookings.map(b => b.id === bookingId ? { ...b, status: "cancelled" } : b))
    }
    setIsProcessing(false)
    setCancellingId(null)
  }

  // Categorize bookings
  const { upcoming, history } = useMemo(() => {
    const now = new Date()
    return {
      upcoming: bookings.filter(b => 
        new Date(b.startTime) >= now && 
        (b.status === "pending" || b.status === "approved")
      ).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
      history: bookings.filter(b => 
        new Date(b.startTime) < now || 
        b.status === "rejected" || 
        b.status === "cancelled"
      ).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    }
  }, [bookings])

  const activeBookings = activeTab === "upcoming" ? upcoming : history

  const formatDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr)
    if (isToday(date)) return "I dag"
    if (isTomorrow(date)) return "I morgen"
    if (isThisWeek(date, { weekStartsOn: 1 })) return format(date, "EEEE", { locale: nb })
    return format(date, "EEEE d. MMMM", { locale: nb })
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "pending": return { label: "Venter på godkjenning", color: "bg-amber-100 text-amber-700", icon: Hourglass }
      case "approved": return { label: "Godkjent", color: "bg-green-100 text-green-700", icon: CheckCircle2 }
      case "rejected": return { label: "Avslått", color: "bg-red-100 text-red-700", icon: XCircle }
      case "cancelled": return { label: "Kansellert", color: "bg-gray-100 text-gray-600", icon: XCircle }
      default: return { label: status, color: "bg-gray-100 text-gray-600", icon: AlertCircle }
    }
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Mine bookinger</h1>
              <p className="text-gray-500">Oversikt over dine reservasjoner</p>
            </div>
            <Link 
              href="/resources" 
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Ny booking
            </Link>
          </div>

          {bookings.length === 0 ? (
            <div className="card p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Ingen bookinger ennå</h2>
              <p className="text-gray-500 mb-6">Finn en fasilitet og lag din første booking</p>
              <Link href="/resources" className="btn btn-primary">
                Se fasiliteter
              </Link>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6">
                <button
                  onClick={() => setActiveTab("upcoming")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                    activeTab === "upcoming"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Kommende
                  {upcoming.length > 0 && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      activeTab === "upcoming" ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"
                    }`}>
                      {upcoming.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                    activeTab === "history"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Historikk
                  {history.length > 0 && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      activeTab === "history" ? "bg-gray-200 text-gray-700" : "bg-gray-200 text-gray-600"
                    }`}>
                      {history.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Bookings list */}
              {activeBookings.length === 0 ? (
                <div className="card p-8 text-center">
                  {activeTab === "upcoming" ? (
                    <>
                      <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">Ingen kommende bookinger</p>
                    </>
                  ) : (
                    <>
                      <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">Ingen tidligere bookinger</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {activeBookings.map((booking) => {
                    const statusInfo = getStatusInfo(booking.status)
                    const StatusIcon = statusInfo.icon
                    const canCancel = booking.status === "pending" || booking.status === "approved"
                    const isPast = new Date(booking.startTime) < new Date()

                    return (
                      <div 
                        key={booking.id} 
                        className={`bg-white rounded-xl border border-gray-200 overflow-hidden transition-all hover:shadow-md ${
                          isPast || booking.status === "cancelled" || booking.status === "rejected" ? "opacity-70" : ""
                        }`}
                      >
                        <div className="flex">
                          {/* Color bar */}
                          <div 
                            className="w-1.5 flex-shrink-0"
                            style={{ backgroundColor: booking.resource.color || "#3b82f6" }}
                          />
                          
                          <div className="flex-1 p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                {/* Title and status */}
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <h3 className="font-semibold text-gray-900">{booking.title}</h3>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                                    <StatusIcon className="w-3 h-3" />
                                    {statusInfo.label}
                                  </span>
                                </div>

                                {/* Resource */}
                                <p className="text-sm text-gray-600 mb-2">
                                  {booking.resource.name}
                                  {booking.resourcePart && <span className="text-gray-400"> → {booking.resourcePart.name}</span>}
                                </p>

                                {/* Date and time */}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    {formatDateLabel(booking.startTime)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    {format(parseISO(booking.startTime), "HH:mm")} - {format(parseISO(booking.endTime), "HH:mm")}
                                  </span>
                                  {booking.resource.location && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-4 h-4 text-gray-400" />
                                      {booking.resource.location}
                                    </span>
                                  )}
                                </div>

                                {/* Status note */}
                                {booking.statusNote && (
                                  <p className="mt-2 text-sm text-red-600 flex items-start gap-1">
                                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    {booking.statusNote}
                                  </p>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2">
                                {canCancel && !isPast && (
                                  <>
                                    <button
                                      onClick={() => setEditingBooking(booking)}
                                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                      title="Rediger"
                                    >
                                      <Pencil className="w-5 h-5" />
                                    </button>
                                    <button
                                      onClick={() => setCancellingId(booking.id)}
                                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Kanseller"
                                    >
                                      <Trash2 className="w-5 h-5" />
                                    </button>
                                  </>
                                )}
                                <Link
                                  href={`/resources/${booking.resource.id}/book`}
                                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Book igjen"
                                >
                                  <ChevronRight className="w-5 h-5" />
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />

      {/* Cancel modal */}
      {cancellingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl p-6 animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Kanseller booking?</h3>
            <p className="text-gray-600 text-center mb-6">
              Er du sikker på at du vil kansellere denne bookingen? Administrator vil bli varslet.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancellingId(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={() => handleCancel(cancellingId)}
                disabled={isProcessing}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Ja, kanseller
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Booking Modal */}
      {editingBooking && (
        <EditBookingModal
          booking={{
            id: editingBooking.id,
            title: editingBooking.title,
            description: editingBooking.description,
            startTime: editingBooking.startTime,
            endTime: editingBooking.endTime,
            status: editingBooking.status,
            resourceId: editingBooking.resource.id,
            resourceName: editingBooking.resource.name,
            resourcePartId: null,
            resourcePartName: editingBooking.resourcePart?.name || null,
          }}
          isAdmin={false}
          onClose={() => setEditingBooking(null)}
          onSaved={(updatedBooking) => {
            setBookings(bookings.map(b => 
              b.id === updatedBooking.id 
                ? { ...b, title: updatedBooking.title, status: updatedBooking.status, startTime: updatedBooking.startTime, endTime: updatedBooking.endTime } 
                : b
            ))
            setEditingBooking(null)
          }}
        />
      )}
    </div>
  )
}
