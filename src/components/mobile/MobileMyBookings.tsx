"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { nb } from "date-fns/locale"
import { Calendar, Clock, MapPin, Loader2, CheckCircle, XCircle, AlertCircle, Trash2 } from "lucide-react"

interface Booking {
  id: string
  title: string
  description?: string | null
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
  resourcePart?: {
    name: string
  } | null
}

type TabType = "upcoming" | "pending" | "past"

export function MobileMyBookings() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>("upcoming")
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await fetch("/api/my-bookings")
        if (res.ok) {
          const data = await res.json()
          setBookings(data)
        }
      } catch (error) {
        console.error("Error fetching bookings:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchBookings()
  }, [])

  const now = new Date()

  const filteredBookings = bookings.filter((b) => {
    const endTime = new Date(b.endTime)
    const isUpcoming = endTime > now && b.status === "approved"
    const isPending = b.status === "pending"
    const isPast = endTime <= now || b.status === "cancelled" || b.status === "rejected"

    switch (activeTab) {
      case "upcoming":
        return isUpcoming
      case "pending":
        return isPending
      case "past":
        return isPast
      default:
        return true
    }
  }).sort((a, b) => {
    // Sort by date - upcoming first, past reversed
    if (activeTab === "past") {
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    }
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  })

  const handleCancel = async (bookingId: string) => {
    if (!confirm("Er du sikker på at du vil kansellere denne bookingen?")) return
    
    setCancellingId(bookingId)
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setBookings((prev) => prev.filter((b) => b.id !== bookingId))
      }
    } catch (error) {
      console.error("Error cancelling booking:", error)
    } finally {
      setCancellingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="flex items-center gap-1 text-green-700 bg-green-100 px-2 py-0.5 rounded-full text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            Godkjent
          </span>
        )
      case "pending":
        return (
          <span className="flex items-center gap-1 text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full text-xs font-medium">
            <AlertCircle className="w-3 h-3" />
            Venter
          </span>
        )
      case "rejected":
        return (
          <span className="flex items-center gap-1 text-red-700 bg-red-100 px-2 py-0.5 rounded-full text-xs font-medium">
            <XCircle className="w-3 h-3" />
            Avvist
          </span>
        )
      case "cancelled":
        return (
          <span className="flex items-center gap-1 text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full text-xs font-medium">
            <XCircle className="w-3 h-3" />
            Kansellert
          </span>
        )
      default:
        return null
    }
  }

  const tabs: { key: TabType; label: string; count: number }[] = [
    {
      key: "upcoming",
      label: "Kommende",
      count: bookings.filter((b) => new Date(b.endTime) > now && b.status === "approved").length,
    },
    {
      key: "pending",
      label: "Venter",
      count: bookings.filter((b) => b.status === "pending").length,
    },
    {
      key: "past",
      label: "Tidligere",
      count: bookings.filter((b) => new Date(b.endTime) <= now || b.status === "cancelled" || b.status === "rejected").length,
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.key
                ? "text-teal-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.key
                    ? "bg-teal-100 text-teal-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {tab.count}
              </span>
            )}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600" />
            )}
          </button>
        ))}
      </div>

      {/* Bookings list */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {filteredBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <p className="text-sm">Ingen bookinger</p>
            {activeTab === "upcoming" && (
              <Link
                href="/resources"
                className="mt-2 text-sm text-teal-600 font-medium"
              >
                Book nå →
              </Link>
            )}
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {filteredBookings.map((booking) => {
              const startDate = new Date(booking.startTime)
              const endDate = new Date(booking.endTime)
              const color = booking.resource.category?.color || "#22c55e"
              const canCancel = booking.status === "pending" || 
                (booking.status === "approved" && startDate > now)

              return (
                <div
                  key={booking.id}
                  className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100"
                >
                  {/* Color bar */}
                  <div className="h-1" style={{ backgroundColor: color }} />
                  
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {booking.title}
                      </h3>
                      {getStatusBadge(booking.status)}
                    </div>

                    <div className="space-y-1.5 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>{format(startDate, "EEEE d. MMMM", { locale: nb })}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span>
                          {format(startDate, "HH:mm")} - {format(endDate, "HH:mm")}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span>
                          {booking.resource.name}
                          {booking.resourcePart && ` · ${booking.resourcePart.name}`}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    {canCancel && (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                        <button
                          onClick={() => handleCancel(booking.id)}
                          disabled={cancellingId === booking.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {cancellingId === booking.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          Kanseller
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

