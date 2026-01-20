"use client"

import { useEffect, useState } from "react"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import Link from "next/link"
import { 
  Trophy,
  Loader2,
  Calendar,
  Users,
  ArrowRight,
  Swords,
  Medal,
  MapPin,
  UserPlus
} from "lucide-react"

interface Competition {
  id: string
  name: string
  description?: string
  type: "LEAGUE" | "TOURNAMENT"
  status: string
  startDate: string
  venue?: string
  registrationType: "TEAM" | "PLAYER"
  registrationOpenDate?: string
  registrationCloseDate?: string
  teamFee?: number
  playerFee?: number
  _count: {
    teams: number
    matches: number
    registrations: number
  }
}

export default function CompetitionsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [moduleEnabled, setModuleEnabled] = useState(false)

  useEffect(() => {
    checkModuleAndFetch()
  }, [])

  const checkModuleAndFetch = async () => {
    try {
      const moduleRes = await fetch("/api/match-setup/status")
      if (moduleRes.ok) {
        const moduleData = await moduleRes.json()
        setModuleEnabled(moduleData.enabled)
        
        if (moduleData.enabled) {
          await fetchCompetitions()
        }
      }
    } catch (error) {
      console.error("Error checking module:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCompetitions = async () => {
    try {
      const response = await fetch("/api/match-setup/competitions/public")
      if (response.ok) {
        const data = await response.json()
        setCompetitions(data)
      }
    } catch (error) {
      console.error("Error fetching competitions:", error)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Pågår</span>
      case "SCHEDULED":
        return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">Planlagt</span>
      case "DRAFT":
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">Utkast</span>
      case "COMPLETED":
        return <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">Avsluttet</span>
      default:
        return null
    }
  }

  const getTypeBadge = (type: string) => {
    if (type === "LEAGUE") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
          <Swords className="w-3 h-3" />
          Serie
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
        <Medal className="w-3 h-3" />
        Turnering
      </span>
    )
  }

  const isRegistrationOpen = (comp: Competition) => {
    const now = new Date()
    const openDate = comp.registrationOpenDate ? new Date(comp.registrationOpenDate) : null
    const closeDate = comp.registrationCloseDate ? new Date(comp.registrationCloseDate) : null
    
    if (openDate && now < openDate) return false
    if (closeDate && now > closeDate) return false
    return comp.status === "SCHEDULED" || comp.status === "DRAFT"
  }

  if (isLoading) {
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

  if (!moduleEnabled) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="card p-12 text-center">
              <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Konkurranser ikke tilgjengelig
              </h1>
              <p className="text-gray-500">
                Konkurransemodulen er ikke aktivert for denne organisasjonen.
              </p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              Konkurranser
            </h1>
            <p className="text-gray-500 mt-1">
              Se pågående og kommende turneringer og serier
            </p>
          </div>

          {/* Competition List */}
          {competitions.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-orange-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Ingen konkurranser
              </h2>
              <p className="text-gray-500 max-w-md mx-auto">
                Det er ingen aktive eller kommende konkurranser for øyeblikket.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {competitions.map((competition) => {
                const registrationOpen = isRegistrationOpen(competition)
                const fee = competition.registrationType === "TEAM" 
                  ? competition.teamFee 
                  : competition.playerFee

                return (
                  <Link
                    key={competition.id}
                    href={`/competitions/${competition.id}`}
                    className="card p-6 hover:shadow-lg transition-all group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">
                            {competition.name}
                          </h3>
                          <div className="flex items-center gap-2">
                            {getTypeBadge(competition.type)}
                            {getStatusBadge(competition.status)}
                            {registrationOpen && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full animate-pulse">
                                <UserPlus className="w-3 h-3" />
                                Åpen påmelding
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {competition.description && (
                          <p className="text-gray-500 text-sm mb-3 line-clamp-1">
                            {competition.description}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            {competition._count.teams} lag
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Swords className="w-4 h-4" />
                            {competition._count.matches} kamper
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            {new Date(competition.startDate).toLocaleDateString("nb-NO", {
                              day: "numeric",
                              month: "short",
                              year: "numeric"
                            })}
                          </span>
                          {competition.venue && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-4 h-4" />
                              {competition.venue}
                            </span>
                          )}
                          {fee && fee > 0 && (
                            <span className="text-orange-600 font-medium">
                              {fee} kr / {competition.registrationType === "TEAM" ? "lag" : "spiller"}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
