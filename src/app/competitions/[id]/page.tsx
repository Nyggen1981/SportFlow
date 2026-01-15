"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import Link from "next/link"
import { TournamentBracket } from "@/components/TournamentBracket"
import { 
  Trophy,
  Loader2,
  Calendar,
  Users,
  ArrowLeft,
  Swords,
  Medal,
  MapPin,
  Clock,
  CheckCircle,
  Info
} from "lucide-react"

interface Team {
  id: string
  name: string
  shortName?: string
  color?: string
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

interface Match {
  id: string
  matchNumber: number
  round?: number
  roundName?: string
  scheduledTime: string
  venue?: string
  court?: string
  status: string
  homeTeam?: Team
  awayTeam?: Team
  homeTeamPlaceholder?: string
  awayTeamPlaceholder?: string
  homeScore?: number
  awayScore?: number
  winner?: Team
}

interface Competition {
  id: string
  name: string
  description?: string
  type: "LEAGUE" | "TOURNAMENT"
  status: string
  startDate: string
  endDate?: string
  venue?: string
  matchDuration: number
  breakDuration: number
  pointsForWin: number
  pointsForDraw: number
  pointsForLoss: number
  hasOvertime: boolean
  overtimeMinutes?: number
  hasPenalties: boolean
  thirdPlaceMatch: boolean
  teams: Team[]
  matches: Match[]
}

export default function CompetitionViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: competitionId } = use(params)
  const router = useRouter()
  const [competition, setCompetition] = useState<Competition | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "teams" | "matches" | "standings" | "bracket">("overview")

  // Ingen innlogging kreves - offentlig side

  useEffect(() => {
    if (competitionId) {
      fetchCompetition()
    }
  }, [competitionId])

  const fetchCompetition = async () => {
    try {
      const response = await fetch(`/api/match-setup/competitions/${competitionId}/public`)
      if (response.ok) {
        const data = await response.json()
        setCompetition(data)
      } else {
        router.push("/competitions")
      }
    } catch (error) {
      console.error("Error fetching competition:", error)
      router.push("/competitions")
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <span className="px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-600 rounded-full">Kommende</span>
      case "SCHEDULED":
        return <span className="px-3 py-1.5 text-sm font-medium bg-blue-100 text-blue-600 rounded-full">Planlagt</span>
      case "ACTIVE":
        return <span className="px-3 py-1.5 text-sm font-medium bg-green-100 text-green-600 rounded-full flex items-center gap-1"><Clock className="w-4 h-4" /> Pågår</span>
      case "COMPLETED":
        return <span className="px-3 py-1.5 text-sm font-medium bg-purple-100 text-purple-600 rounded-full flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Fullført</span>
      default:
        return null
    }
  }

  const getTypeBadge = (type: string) => {
    return type === "LEAGUE" 
      ? <span className="px-3 py-1.5 text-sm font-medium bg-amber-100 text-amber-700 rounded-full flex items-center gap-1"><Swords className="w-4 h-4" /> Serie</span>
      : <span className="px-3 py-1.5 text-sm font-medium bg-orange-100 text-orange-700 rounded-full flex items-center gap-1"><Medal className="w-4 h-4" /> Cup</span>
  }

  // Sorter lag etter poeng, målforskjell og scorede mål
  const sortedTeams = competition?.teams 
    ? [...competition.teams].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
        return b.goalsFor - a.goalsFor
      })
    : []

  // Sorter kamper etter tid
  const sortedMatches = competition?.matches
    ? [...competition.matches].sort((a, b) => 
        new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
      )
    : []

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
        </main>
        <Footer />
      </div>
    )
  }

  if (!competition) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Konkurranse ikke funnet</h1>
            <Link href="/competitions" className="text-orange-600 hover:text-orange-700">
              Tilbake til konkurranser
            </Link>
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
          {/* Back link */}
          <Link
            href="/competitions"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Tilbake til konkurranser
          </Link>

          {/* Header */}
          <div className="card p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {competition.name}
                  </h1>
                  <div className="flex items-center gap-2">
                    {getTypeBadge(competition.type)}
                    {getStatusBadge(competition.status)}
                  </div>
                </div>
                
                {competition.description && (
                  <p className="text-gray-500 mb-3">{competition.description}</p>
                )}
                
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    {competition.teams.length} lag
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Swords className="w-4 h-4" />
                    {competition.matches.length} kamper
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {new Date(competition.startDate).toLocaleDateString("nb-NO", {
                      day: "numeric",
                      month: "long",
                      year: "numeric"
                    })}
                  </span>
                  {competition.venue && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      {competition.venue}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 shadow-sm border border-gray-100">
            {["overview", "teams", "matches", "standings", ...(competition.type === "TOURNAMENT" ? ["bracket"] : [])].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as typeof activeTab)}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {tab === "overview" && "Oversikt"}
                {tab === "teams" && "Lag"}
                {tab === "matches" && "Kamper"}
                {tab === "standings" && "Tabell"}
                {tab === "bracket" && "Kamptre"}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Info */}
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5 text-orange-500" />
                  Informasjon
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type</span>
                    <span className="font-medium">{competition.type === "LEAGUE" ? "Seriespill" : "Turnering"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Kampvarighet</span>
                    <span className="font-medium">{competition.matchDuration} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Pause mellom kamper</span>
                    <span className="font-medium">{competition.breakDuration} min</span>
                  </div>
                  {competition.type === "LEAGUE" && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Poeng for seier</span>
                        <span className="font-medium">{competition.pointsForWin}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Poeng for uavgjort</span>
                        <span className="font-medium">{competition.pointsForDraw}</span>
                      </div>
                    </>
                  )}
                  {competition.hasOvertime && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ekstraomgang</span>
                      <span className="font-medium">{competition.overtimeMinutes} min</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-orange-500" />
                  Status
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-3xl font-bold text-gray-900">{competition.teams.length}</p>
                    <p className="text-sm text-gray-500">Lag</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-3xl font-bold text-gray-900">{competition.matches.length}</p>
                    <p className="text-sm text-gray-500">Kamper</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-3xl font-bold text-green-600">
                      {competition.matches.filter(m => m.status === "COMPLETED").length}
                    </p>
                    <p className="text-sm text-gray-500">Spilt</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-3xl font-bold text-blue-600">
                      {competition.matches.filter(m => m.status === "SCHEDULED").length}
                    </p>
                    <p className="text-sm text-gray-500">Gjenstående</p>
                  </div>
                </div>
              </div>

              {/* Top of table */}
              {sortedTeams.length > 0 && (
                <div className="card p-6 md:col-span-2">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    {competition.type === "LEAGUE" ? "Tabelltopp" : "Deltakere"}
                  </h2>
                  <div className="space-y-2">
                    {sortedTeams.slice(0, 5).map((team, index) => (
                      <div key={team.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-sm font-bold ${
                          index === 0 ? "bg-amber-400 text-white" :
                          index === 1 ? "bg-gray-300 text-gray-700" :
                          index === 2 ? "bg-amber-600 text-white" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {index + 1}
                        </span>
                        <span className="font-medium flex-1">{team.name}</span>
                        {competition.type === "LEAGUE" && (
                          <span className="text-sm text-gray-500">{team.points} poeng</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "teams" && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Deltakende lag</h2>
              {competition.teams.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Ingen lag påmeldt ennå</p>
              ) : (
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {competition.teams.map((team) => (
                    <div key={team.id} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: team.color || "#6b7280" }}
                      >
                        {team.shortName?.substring(0, 2) || team.name.substring(0, 2)}
                      </div>
                      <span className="font-medium">{team.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "matches" && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Kamper</h2>
              {competition.status !== "ACTIVE" && competition.status !== "COMPLETED" ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Kampene er ikke klare ennå</p>
                </div>
              ) : sortedMatches.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Ingen kamper</p>
              ) : (
                <div className="space-y-3">
                  {sortedMatches.map((match) => (
                    <div 
                      key={match.id} 
                      className={`p-4 rounded-xl border ${
                        match.status === "COMPLETED" ? "bg-gray-50 border-gray-200" : "bg-white border-gray-100"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">Kamp {match.matchNumber}</span>
                        {match.roundName && (
                          <span className="text-xs font-medium text-orange-600">{match.roundName}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className={`font-medium ${match.winner?.id === match.homeTeam?.id ? "text-green-600" : ""}`}>
                            {match.homeTeam?.name || match.homeTeamPlaceholder || "TBD"}
                          </p>
                        </div>
                        <div className="px-4 text-center">
                          {match.status === "COMPLETED" ? (
                            <span className="text-lg font-bold">
                              {match.homeScore} - {match.awayScore}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">vs</span>
                          )}
                        </div>
                        <div className="flex-1 text-right">
                          <p className={`font-medium ${match.winner?.id === match.awayTeam?.id ? "text-green-600" : ""}`}>
                            {match.awayTeam?.name || match.awayTeamPlaceholder || "TBD"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(match.scheduledTime).toLocaleString("nb-NO", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                        {match.court && (
                          <span>{match.court}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "standings" && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Tabell</h2>
              {sortedTeams.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Ingen lag</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-500 border-b">
                        <th className="pb-3 w-8">#</th>
                        <th className="pb-3">Lag</th>
                        <th className="pb-3 text-center">K</th>
                        <th className="pb-3 text-center">S</th>
                        <th className="pb-3 text-center">U</th>
                        <th className="pb-3 text-center">T</th>
                        <th className="pb-3 text-center">+</th>
                        <th className="pb-3 text-center">-</th>
                        <th className="pb-3 text-center">+/-</th>
                        <th className="pb-3 text-center font-semibold">P</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTeams.map((team, index) => (
                        <tr key={team.id} className="border-b last:border-0">
                          <td className="py-3">
                            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                              index === 0 ? "bg-amber-400 text-white" :
                              index === 1 ? "bg-gray-300 text-gray-700" :
                              index === 2 ? "bg-amber-600 text-white" :
                              "bg-gray-100 text-gray-600"
                            }`}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              {team.color && (
                                <div 
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: team.color }}
                                />
                              )}
                              <span className="font-medium">{team.name}</span>
                            </div>
                          </td>
                          <td className="py-3 text-center text-gray-600">{team.played}</td>
                          <td className="py-3 text-center text-green-600">{team.wins}</td>
                          <td className="py-3 text-center text-gray-600">{team.draws}</td>
                          <td className="py-3 text-center text-red-600">{team.losses}</td>
                          <td className="py-3 text-center text-gray-600">{team.goalsFor}</td>
                          <td className="py-3 text-center text-gray-600">{team.goalsAgainst}</td>
                          <td className="py-3 text-center">
                            <span className={team.goalDifference > 0 ? "text-green-600" : team.goalDifference < 0 ? "text-red-600" : "text-gray-600"}>
                              {team.goalDifference > 0 ? "+" : ""}{team.goalDifference}
                            </span>
                          </td>
                          <td className="py-3 text-center font-bold text-orange-600">{team.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "bracket" && competition.type === "TOURNAMENT" && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Kamptre</h2>
              {competition.status !== "ACTIVE" && competition.status !== "COMPLETED" ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Kamptreet er ikke klart ennå</p>
                </div>
              ) : (
                <TournamentBracket 
                  matches={competition.matches}
                  competitionStatus={competition.status}
                  onResultRegistered={() => {}} // Read-only, no callback needed
                  readOnly={true}
                />
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}

