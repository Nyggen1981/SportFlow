"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import Link from "next/link"
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
  UserPlus,
  CreditCard,
  AlertCircle
} from "lucide-react"

interface Team {
  id: string
  name: string
  group?: string
  matchesPlayed: number
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
  round: number
  matchNumber: number
  scheduledTime?: string
  status: string
  homeScore?: number
  awayScore?: number
  homeTeam?: { id: string; name: string }
  awayTeam?: { id: string; name: string }
  winner?: { id: string; name: string }
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
  registrationType: "TEAM" | "PLAYER"
  registrationOpen: boolean
  registrationDeadline?: string
  registrationFee?: number
  maxRegistrations?: number
  minPlayersPerTeam?: number
  maxPlayersPerTeam?: number
  teams: Team[]
  matches: Match[]
  _count: {
    registrations: number
  }
}

export default function CompetitionViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: competitionId } = use(params)
  const router = useRouter()
  const { data: session } = useSession()
  const [competition, setCompetition] = useState<Competition | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "teams" | "matches" | "standings" | "register">("overview")

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
      case "ACTIVE":
        return <span className="px-3 py-1 text-sm font-medium bg-green-100 text-green-700 rounded-full">Pågår</span>
      case "SCHEDULED":
        return <span className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-700 rounded-full">Planlagt</span>
      case "DRAFT":
        return <span className="px-3 py-1 text-sm font-medium bg-gray-100 text-gray-600 rounded-full">Utkast</span>
      case "COMPLETED":
        return <span className="px-3 py-1 text-sm font-medium bg-purple-100 text-purple-700 rounded-full">Avsluttet</span>
      default:
        return null
    }
  }

  const getTypeBadge = (type: string) => {
    if (type === "LEAGUE") {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium bg-orange-100 text-orange-700 rounded-full">
          <Swords className="w-4 h-4" />
          Seriespill
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium bg-amber-100 text-amber-700 rounded-full">
        <Medal className="w-4 h-4" />
        Turnering
      </span>
    )
  }

  const isRegistrationOpen = () => {
    if (!competition) return false
    if (!competition.registrationOpen) return false
    
    const now = new Date()
    const deadline = competition.registrationDeadline ? new Date(competition.registrationDeadline) : null
    
    if (deadline && now > deadline) return false
    return competition.status === "SCHEDULED" || competition.status === "DRAFT"
  }

  const sortedTeams = competition?.teams 
    ? [...competition.teams].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
        return b.goalsFor - a.goalsFor
      })
    : []

  const sortedMatches = competition?.matches 
    ? [...competition.matches].sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round
        return a.matchNumber - b.matchNumber
      })
    : []

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

  if (!competition) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="card p-12 text-center">
              <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Konkurranse ikke funnet
              </h1>
              <Link href="/competitions" className="text-orange-600 hover:text-orange-700 font-medium">
                Tilbake til konkurranser
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const registrationOpen = isRegistrationOpen()
  const fee = competition.registrationFee

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back link */}
          <Link href="/competitions" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
            <ArrowLeft className="w-4 h-4" />
            Tilbake til konkurranser
          </Link>

          {/* Header */}
          <div className="card p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-2">
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

              {/* Registration CTA */}
              {registrationOpen && session?.user && (
                <button
                  onClick={() => setActiveTab("register")}
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium hover:from-orange-600 hover:to-amber-600 transition-all flex items-center gap-2 shadow-lg"
                >
                  <UserPlus className="w-5 h-5" />
                  Meld på
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 shadow-sm border border-gray-100 overflow-x-auto">
            {[
              { key: "overview", label: "Oversikt" },
              { key: "teams", label: "Lag" },
              { key: "matches", label: "Kamper" },
              { key: "standings", label: "Tabell" },
              ...(registrationOpen && session?.user ? [{ key: "register", label: "Påmelding" }] : [])
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Competition Info */}
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-orange-500" />
                  Konkurranseinfo
                </h2>
                <dl className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <dt className="text-gray-500">Type</dt>
                    <dd className="font-medium">{competition.type === "LEAGUE" ? "Seriespill" : "Turnering"}</dd>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <dt className="text-gray-500">Startdato</dt>
                    <dd className="font-medium">
                      {new Date(competition.startDate).toLocaleDateString("nb-NO")}
                    </dd>
                  </div>
                  {competition.endDate && (
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <dt className="text-gray-500">Sluttdato</dt>
                      <dd className="font-medium">
                        {new Date(competition.endDate).toLocaleDateString("nb-NO")}
                      </dd>
                    </div>
                  )}
                  {competition.venue && (
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <dt className="text-gray-500">Sted</dt>
                      <dd className="font-medium">{competition.venue}</dd>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <dt className="text-gray-500">Påmeldingstype</dt>
                    <dd className="font-medium">
                      {competition.registrationType === "TEAM" ? "Lagpåmelding" : "Individuell"}
                    </dd>
                  </div>
                  {fee && fee > 0 && (
                    <div className="flex justify-between py-2">
                      <dt className="text-gray-500">Avgift</dt>
                      <dd className="font-medium text-orange-600">
                        {fee} kr / {competition.registrationType === "TEAM" ? "lag" : "spiller"}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Quick Stats */}
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Swords className="w-5 h-5 text-orange-500" />
                  Status
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <div className="text-3xl font-bold text-gray-900">{competition.teams.length}</div>
                    <div className="text-sm text-gray-500">Lag påmeldt</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <div className="text-3xl font-bold text-gray-900">{competition.matches.length}</div>
                    <div className="text-sm text-gray-500">Kamper totalt</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <div className="text-3xl font-bold text-green-600">
                      {competition.matches.filter(m => m.status === "COMPLETED").length}
                    </div>
                    <div className="text-sm text-gray-500">Kamper spilt</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <div className="text-3xl font-bold text-blue-600">
                      {competition.matches.filter(m => m.status === "SCHEDULED").length}
                    </div>
                    <div className="text-sm text-gray-500">Gjenstående</div>
                  </div>
                </div>

                {/* Registration Info */}
                {registrationOpen && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-center gap-2 text-green-700 font-medium">
                      <UserPlus className="w-5 h-5" />
                      Påmelding er åpen!
                    </div>
                    {competition.registrationDeadline && (
                      <p className="text-sm text-green-600 mt-1">
                        Frist: {new Date(competition.registrationDeadline).toLocaleDateString("nb-NO")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "teams" && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Påmeldte lag</h2>
              {sortedTeams.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Ingen lag påmeldt ennå</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortedTeams.map((team, index) => (
                    <div key={team.id} className="p-4 bg-gray-50 rounded-xl flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{team.name}</p>
                        {team.group && (
                          <p className="text-xs text-gray-500">Gruppe {team.group}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "matches" && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Kamper</h2>
              {sortedMatches.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Swords className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Ingen kamper planlagt ennå</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedMatches.map((match) => (
                    <div key={match.id} className={`p-4 rounded-xl border ${
                      match.status === "COMPLETED" ? "bg-gray-50 border-gray-200" : "bg-white border-gray-100"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-medium text-gray-400 w-16">
                            Runde {match.round}
                          </span>
                          <span className="font-medium text-gray-900 w-32 text-right">
                            {match.homeTeam?.name || "TBD"}
                          </span>
                          <span className={`px-3 py-1 rounded font-bold ${
                            match.status === "COMPLETED" 
                              ? "bg-gray-900 text-white" 
                              : "bg-gray-100 text-gray-400"
                          }`}>
                            {match.status === "COMPLETED" 
                              ? `${match.homeScore} - ${match.awayScore}` 
                              : "vs"
                            }
                          </span>
                          <span className="font-medium text-gray-900 w-32">
                            {match.awayTeam?.name || "TBD"}
                          </span>
                        </div>
                        {match.scheduledTime && (
                          <span className="text-sm text-gray-500 flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {new Date(match.scheduledTime).toLocaleString("nb-NO", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
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
                <div className="text-center py-12 text-gray-500">
                  <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Tabellen er ikke tilgjengelig ennå</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-500 border-b">
                        <th className="pb-3 w-12">#</th>
                        <th className="pb-3">Lag</th>
                        <th className="pb-3 text-center w-12">K</th>
                        <th className="pb-3 text-center w-12">S</th>
                        <th className="pb-3 text-center w-12">U</th>
                        <th className="pb-3 text-center w-12">T</th>
                        <th className="pb-3 text-center w-20">+/-</th>
                        <th className="pb-3 text-center w-12 font-bold">P</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTeams.map((team, index) => (
                        <tr key={team.id} className={`border-b border-gray-50 ${index < 3 ? "bg-orange-50/50" : ""}`}>
                          <td className="py-3 font-medium">{index + 1}</td>
                          <td className="py-3 font-medium text-gray-900">{team.name}</td>
                          <td className="py-3 text-center text-gray-500">{team.matchesPlayed}</td>
                          <td className="py-3 text-center text-green-600">{team.wins}</td>
                          <td className="py-3 text-center text-gray-500">{team.draws}</td>
                          <td className="py-3 text-center text-red-500">{team.losses}</td>
                          <td className="py-3 text-center text-gray-500">
                            {team.goalsFor}-{team.goalsAgainst}
                          </td>
                          <td className="py-3 text-center font-bold text-gray-900">{team.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "register" && registrationOpen && session?.user && (
            <RegistrationForm 
              competition={competition}
              onSuccess={() => {
                fetchCompetition()
                setActiveTab("overview")
              }}
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

// Registration Form Component
function RegistrationForm({ 
  competition, 
  onSuccess 
}: { 
  competition: Competition
  onSuccess: () => void 
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  const [teamName, setTeamName] = useState("")
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [players, setPlayers] = useState<{ name: string }[]>([{ name: "" }])
  const [notes, setNotes] = useState("")

  const fee = competition.registrationFee

  const addPlayer = () => {
    if (competition.maxPlayersPerTeam && players.length >= competition.maxPlayersPerTeam) {
      return
    }
    setPlayers([...players, { name: "" }])
  }

  const removePlayer = (index: number) => {
    if (players.length > 1) {
      setPlayers(players.filter((_, i) => i !== index))
    }
  }

  const updatePlayer = (index: number, name: string) => {
    const newPlayers = [...players]
    newPlayers[index] = { name }
    setPlayers(newPlayers)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    // Validate
    if (competition.registrationType === "TEAM" && !teamName.trim()) {
      setError("Lagnavn er påkrevd")
      setIsSubmitting(false)
      return
    }

    if (!contactName.trim() || !contactEmail.trim()) {
      setError("Kontaktinformasjon er påkrevd")
      setIsSubmitting(false)
      return
    }

    const validPlayers = players.filter(p => p.name.trim())
    if (competition.minPlayersPerTeam && validPlayers.length < competition.minPlayersPerTeam) {
      setError(`Minimum ${competition.minPlayersPerTeam} spillere er påkrevd`)
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch(`/api/match-setup/competitions/${competition.id}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName: competition.registrationType === "TEAM" ? teamName : null,
          contactName,
          contactEmail,
          contactPhone,
          participants: validPlayers,
          notes
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunne ikke fullføre påmelding")
      }

      setSuccess(true)
      setTimeout(() => {
        onSuccess()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "En feil oppstod")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="card p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Påmelding mottatt!</h2>
        <p className="text-gray-500">
          Din påmelding er registrert og vil bli behandlet av arrangøren.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-orange-500" />
        Meld på {competition.registrationType === "TEAM" ? "lag" : "deg selv"}
      </h2>

      {/* Team Name (for team registration) */}
      {competition.registrationType === "TEAM" && (
        <div className="mb-6">
          <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-1">
            Lagnavn *
          </label>
          <input
            type="text"
            id="teamName"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Ditt lags navn"
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
      )}

      {/* Contact Info */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div>
          <label htmlFor="contactName" className="block text-sm font-medium text-gray-700 mb-1">
            Kontaktperson *
          </label>
          <input
            type="text"
            id="contactName"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Fullt navn"
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
        <div>
          <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-1">
            E-post *
          </label>
          <input
            type="email"
            id="contactEmail"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="epost@eksempel.no"
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700 mb-1">
          Telefon
        </label>
        <input
          type="tel"
          id="contactPhone"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder="+47 123 45 678"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
      </div>

      {/* Players */}
      {competition.registrationType === "TEAM" && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Spillere
              {competition.minPlayersPerTeam && (
                <span className="text-gray-400 ml-1">(min. {competition.minPlayersPerTeam})</span>
              )}
              {competition.maxPlayersPerTeam && (
                <span className="text-gray-400 ml-1">(maks. {competition.maxPlayersPerTeam})</span>
              )}
            </label>
            <button
              type="button"
              onClick={addPlayer}
              disabled={competition.maxPlayersPerTeam ? players.length >= competition.maxPlayersPerTeam : false}
              className="text-sm text-orange-600 hover:text-orange-700 font-medium disabled:opacity-50"
            >
              + Legg til spiller
            </button>
          </div>
          <div className="space-y-2">
            {players.map((player, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={player.name}
                  onChange={(e) => updatePlayer(index, e.target.value)}
                  placeholder={`Spiller ${index + 1}`}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                {players.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePlayer(index)}
                    className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="mb-6">
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
          Kommentarer (valgfritt)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Andre kommentarer til arrangøren..."
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
      </div>

      {/* Fee Info */}
      {fee && fee > 0 && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
          <div className="flex items-center gap-2 text-orange-700 font-medium">
            <CreditCard className="w-5 h-5" />
            Påmeldingsavgift: {fee} kr
          </div>
          <p className="text-sm text-orange-600 mt-1">
            Faktura sendes etter at påmeldingen er godkjent.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Sender påmelding...
          </>
        ) : (
          <>
            <CheckCircle className="w-5 h-5" />
            Send påmelding
          </>
        )}
      </button>
    </form>
  )
}
