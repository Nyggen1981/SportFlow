"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import Link from "next/link"
import { 
  Trophy, 
  Loader2, 
  Calendar, 
  Users, 
  ArrowLeft, 
  CheckCircle, 
  Clock, 
  XCircle,
  MapPin,
  CreditCard
} from "lucide-react"

interface Registration {
  id: string
  teamName?: string
  contactName: string
  contactEmail: string
  contactPhone?: string
  participants?: { name: string }[]
  paymentStatus: string
  paymentAmount?: number
  status: string
  notes?: string
  createdAt: string
  updatedAt: string
  competition: {
    id: string
    name: string
    type: "LEAGUE" | "TOURNAMENT"
    status: string
    startDate: string
    venue?: string
  }
}

export default function MyRegistrationsPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/auth/signin?callbackUrl=/my-registrations")
    }
  }, [sessionStatus, router])

  useEffect(() => {
    if (session?.user) {
      fetchRegistrations()
    }
  }, [session])

  const fetchRegistrations = async () => {
    try {
      const response = await fetch("/api/my-registrations")
      if (response.ok) {
        const data = await response.json()
        setRegistrations(data)
      }
    } catch (error) {
      console.error("Error fetching registrations:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
            <Clock className="w-3 h-3" />
            Venter på godkjenning
          </span>
        )
      case "CONFIRMED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
            <CheckCircle className="w-3 h-3" />
            Godkjent
          </span>
        )
      case "WAITLIST":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
            <Clock className="w-3 h-3" />
            Venteliste
          </span>
        )
      case "CANCELLED":
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
            <XCircle className="w-3 h-3" />
            {status === "REJECTED" ? "Avslått" : "Kansellert"}
          </span>
        )
      default:
        return null
    }
  }

  const getPaymentBadge = (paymentStatus: string, amountInOre?: number) => {
    if (!amountInOre || amountInOre === 0) return null
    const amount = amountInOre / 100 // Convert from øre to kr
    
    switch (paymentStatus) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
            <CreditCard className="w-3 h-3" />
            Venter på betaling ({amount} kr)
          </span>
        )
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
            <CreditCard className="w-3 h-3" />
            Betalt ({amount} kr)
          </span>
        )
      default:
        return null
    }
  }

  if (sessionStatus === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link href="/competitions" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
              <ArrowLeft className="w-4 h-4" />
              Tilbake til konkurranser
            </Link>
            
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              Mine påmeldinger
            </h1>
            <p className="text-gray-500 mt-1">
              Oversikt over dine påmeldinger til konkurranser
            </p>
          </div>

          {/* Registrations List */}
          {registrations.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-orange-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Ingen påmeldinger
              </h2>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                Du har ikke meldt deg på noen konkurranser ennå.
              </p>
              <Link 
                href="/competitions"
                className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
              >
                <Trophy className="w-5 h-5" />
                Se konkurranser
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {registrations.map((registration) => (
                <div key={registration.id} className="card p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Link 
                          href={`/competitions/${registration.competition.id}`}
                          className="text-lg font-semibold text-gray-900 hover:text-orange-600 transition-colors"
                        >
                          {registration.competition.name}
                        </Link>
                        {getStatusBadge(registration.status)}
                        {getPaymentBadge(registration.paymentStatus, registration.paymentAmount ? Number(registration.paymentAmount) : undefined)}
                      </div>
                      
                      {registration.teamName && (
                        <p className="text-gray-700 mb-2">
                          <span className="font-medium">Lag:</span> {registration.teamName}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          {new Date(registration.competition.startDate).toLocaleDateString("nb-NO", {
                            day: "numeric",
                            month: "long",
                            year: "numeric"
                          })}
                        </span>
                        {registration.competition.venue && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-4 h-4" />
                            {registration.competition.venue}
                          </span>
                        )}
                        {registration.participants && registration.participants.length > 0 && (
                          <span className="flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            {registration.participants.length} spillere
                          </span>
                        )}
                      </div>
                      
                      <p className="text-xs text-gray-400 mt-2">
                        Registrert: {new Date(registration.createdAt).toLocaleString("nb-NO")}
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Link
                        href={`/competitions/${registration.competition.id}`}
                        className="px-4 py-2 text-orange-600 hover:bg-orange-50 rounded-lg font-medium transition-colors"
                      >
                        Se konkurranse
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
