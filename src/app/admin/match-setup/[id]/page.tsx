"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import { TournamentBracket } from "@/components/TournamentBracket"
import Link from "next/link"
import { 
  ArrowLeft,
  Trophy,
  Users,
  Swords,
  Calendar,
  Play,
  CheckCircle,
  X,
  Plus,
  Loader2,
  Medal,
  Settings,
  Trash2,
  RefreshCw,
  MapPin,
  Clock,
  RotateCcw
} from "lucide-react"

interface Team {
  id: string
  name: string
  shortName?: string
  color?: string
  seed?: number
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  players?: string[]
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  group?: { id: string; name: string }
}

interface Match {
  id: string
  matchNumber: number
  round: number
  roundName?: string
  scheduledTime: string
  venue?: string
  court?: string
  status: string
  homeScore?: number
  awayScore?: number
  homeTeam?: { id: string; name: string; shortName?: string; color?: string }
  awayTeam?: { id: string; name: string; shortName?: string; color?: string }
  homeTeamPlaceholder?: string
  awayTeamPlaceholder?: string
  isDraw: boolean
  winner?: { id: string; name: string }
  group?: { id: string; name: string }
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
  resourceId?: string | null
  pointsForWin: number
  pointsForDraw: number
  pointsForLoss: number
  matchDuration: number
  breakDuration: number
  matchesPerDay?: number | null
  hasOvertime: boolean
  overtimeMinutes?: number | null
  hasPenalties: boolean
  thirdPlaceMatch: boolean
  teams: Team[]
  matches: Match[]
  groups: Array<{ id: string; name: string; teams: Team[] }>
}

export default function CompetitionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const competitionId = params.id as string

  const [competition, setCompetition] = useState<Competition | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"overview" | "teams" | "matches" | "bracket" | "standings">("overview")
  const [isFullAdmin, setIsFullAdmin] = useState(true) // Antar admin til vi vet mer
  
  // Team management
  const [showAddTeamModal, setShowAddTeamModal] = useState(false)
  const [newTeamName, setNewTeamName] = useState("")
  const [newTeamShortName, setNewTeamShortName] = useState("")
  const [addingTeam, setAddingTeam] = useState(false)
  
  // Team editing
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [editedTeamData, setEditedTeamData] = useState({
    name: "",
    shortName: "",
    color: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    players: [] as string[],
    newPlayer: ""
  })
  const [savingTeam, setSavingTeam] = useState(false)
  
  // Match management
  const [generatingMatches, setGeneratingMatches] = useState(false)
  const [editingMatch, setEditingMatch] = useState<Match | null>(null)
  const [matchScores, setMatchScores] = useState({ home: 0, away: 0 })
  const [savingScore, setSavingScore] = useState(false)
  const [resetting, setResetting] = useState(false)
  
  // Settings management
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [resources, setResources] = useState<{ id: string; name: string; location?: string }[]>([])
  const [editedSettings, setEditedSettings] = useState({
    name: "",
    description: "",
    venue: "",
    resourceId: null as string | null,
    startDate: "",
    endDate: "",
    dailyStartTime: "09:00",
    dailyEndTime: "18:00",
    matchDuration: 60,
    breakDuration: 15,
    matchesPerDay: null as number | null,
    pointsForWin: 3,
    pointsForDraw: 1,
    pointsForLoss: 0,
    hasOvertime: false,
    overtimeMinutes: 10,
    hasPenalties: false,
    thirdPlaceMatch: false
  })
  const [savingSettings, setSavingSettings] = useState(false)

  const fetchCompetition = useCallback(async () => {
    try {
      const res = await fetch(`/api/match-setup/competitions/${competitionId}`)
      if (!res.ok) throw new Error("Kunne ikke hente konkurranse")
      const data = await res.json()
      setCompetition(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "En feil oppstod")
    } finally {
      setLoading(false)
    }
  }, [competitionId])

  useEffect(() => {
    fetchCompetition()
  }, [fetchCompetition])

  // Hent tilgjengelige fasiliteter
  useEffect(() => {
    const fetchResources = async () => {
      try {
        const res = await fetch("/api/resources")
        if (res.ok) {
          const data = await res.json()
          setResources(data)
        }
      } catch (error) {
        console.error("Error fetching resources:", error)
      }
    }
    fetchResources()
  }, [])

  // Sjekk om brukeren er full admin eller bare har kampoppsett-tilgang
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const res = await fetch("/api/match-setup/access")
        if (res.ok) {
          const data = await res.json()
          setIsFullAdmin(data.isAdmin === true)
        }
      } catch {
        // Antar admin ved feil
      }
    }
    checkAccess()
  }, [])

  // Bestem tilbake-lenke basert på tilgang
  const backLink = isFullAdmin ? "/admin/match-setup" : "/match-admin"

  const addTeam = async () => {
    if (!newTeamName.trim()) return
    setAddingTeam(true)
    
    try {
      const res = await fetch(`/api/match-setup/competitions/${competitionId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTeamName.trim(),
          shortName: newTeamShortName.trim() || undefined
        })
      })
      
      if (!res.ok) throw new Error("Kunne ikke legge til lag")
      
      setNewTeamName("")
      setNewTeamShortName("")
      setShowAddTeamModal(false)
      fetchCompetition()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Feil ved lagring")
    } finally {
      setAddingTeam(false)
    }
  }

  const generateMatches = async () => {
    if (!competition || competition.teams.length < 2) {
      alert("Du må legge til minst 2 lag før du kan generere kamper")
      return
    }
    
    if (competition.matches.length > 0) {
      if (!confirm("Dette vil slette alle eksisterende kamper og opprette nye. Er du sikker?")) {
        return
      }
    }
    
    setGeneratingMatches(true)
    
    try {
      const res = await fetch(`/api/match-setup/competitions/${competitionId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regenerate: competition.matches.length > 0
        })
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Kunne ikke generere kamper")
      }
      
      fetchCompetition()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Feil ved generering")
    } finally {
      setGeneratingMatches(false)
    }
  }

  const saveMatchScore = async () => {
    if (!editingMatch) return
    setSavingScore(true)
    
    try {
      const res = await fetch(`/api/match-setup/competitions/${competitionId}/matches`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: editingMatch.id,
          homeScore: matchScores.home,
          awayScore: matchScores.away,
          status: "COMPLETED"
        })
      })
      
      if (!res.ok) throw new Error("Kunne ikke lagre resultat")
      
      setEditingMatch(null)
      fetchCompetition()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Feil ved lagring")
    } finally {
      setSavingScore(false)
    }
  }

  const openTeamEditor = (team: Team) => {
    setEditingTeam(team)
    setEditedTeamData({
      name: team.name,
      shortName: team.shortName || "",
      color: team.color || "#3b82f6",
      contactName: team.contactName || "",
      contactEmail: team.contactEmail || "",
      contactPhone: team.contactPhone || "",
      players: team.players || [],
      newPlayer: ""
    })
  }

  const addPlayer = () => {
    if (editedTeamData.newPlayer.trim()) {
      setEditedTeamData(prev => ({
        ...prev,
        players: [...prev.players, prev.newPlayer.trim()],
        newPlayer: ""
      }))
    }
  }

  const removePlayer = (index: number) => {
    setEditedTeamData(prev => ({
      ...prev,
      players: prev.players.filter((_, i) => i !== index)
    }))
  }

  const saveTeam = async () => {
    if (!editingTeam) return
    setSavingTeam(true)
    
    try {
      const res = await fetch(`/api/match-setup/competitions/${competitionId}/teams/${editingTeam.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editedTeamData.name,
          shortName: editedTeamData.shortName || null,
          color: editedTeamData.color || null,
          contactName: editedTeamData.contactName || null,
          contactEmail: editedTeamData.contactEmail || null,
          contactPhone: editedTeamData.contactPhone || null,
          players: editedTeamData.players
        })
      })
      
      if (!res.ok) throw new Error("Kunne ikke lagre lag")
      
      setEditingTeam(null)
      fetchCompetition()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Feil ved lagring")
    } finally {
      setSavingTeam(false)
    }
  }

  const startCompetition = async () => {
    if (!competition || competition.teams.length < 2) {
      alert("Du må legge til minst 2 lag før du kan starte konkurransen")
      return
    }
    
    const confirmMessage = "Er du sikker på at du vil starte konkurransen?\n\nKampoppsettet vil bli generert automatisk.\n\nNår konkurransen er startet kan du ikke:\n• Legge til eller fjerne lag\n• Endre kampoppsettet\n\nFor å gjøre endringer må du nullstille konkurransen."
    
    if (!confirm(confirmMessage)) {
      return
    }
    
    setGeneratingMatches(true)
    
    try {
      // Generer/regenerer kamper - slett gamle og lag nye
      const genRes = await fetch(`/api/match-setup/competitions/${competitionId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate: true })
      })
      
      if (!genRes.ok) {
        const data = await genRes.json()
        throw new Error(data.error || "Kunne ikke generere kamper")
      }
      
      // Start konkurransen
      const res = await fetch(`/api/match-setup/competitions/${competitionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" })
      })
      
      if (!res.ok) throw new Error("Kunne ikke starte konkurransen")
      fetchCompetition()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Feil ved start")
    } finally {
      setGeneratingMatches(false)
    }
  }

  const deleteCompetition = async () => {
    if (!confirm("Er du sikker på at du vil slette denne konkurransen? Dette kan ikke angres.")) {
      return
    }
    
    try {
      const res = await fetch(`/api/match-setup/competitions/${competitionId}`, {
        method: "DELETE"
      })
      
      if (!res.ok) throw new Error("Kunne ikke slette konkurransen")
      router.push("/admin/match-setup")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Feil ved sletting")
    }
  }

  const openSettingsModal = () => {
    if (!competition) return
    setEditedSettings({
      name: competition.name,
      description: competition.description || "",
      venue: competition.venue || "",
      resourceId: competition.resourceId || null,
      startDate: competition.startDate ? new Date(competition.startDate).toISOString().split('T')[0] : "",
      endDate: competition.endDate ? new Date(competition.endDate).toISOString().split('T')[0] : "",
      dailyStartTime: (competition as any).dailyStartTime || "09:00",
      dailyEndTime: (competition as any).dailyEndTime || "18:00",
      matchDuration: competition.matchDuration,
      breakDuration: competition.breakDuration,
      matchesPerDay: competition.matchesPerDay ?? null,
      pointsForWin: competition.pointsForWin,
      pointsForDraw: competition.pointsForDraw,
      pointsForLoss: competition.pointsForLoss,
      hasOvertime: competition.hasOvertime,
      overtimeMinutes: competition.overtimeMinutes || 10,
      hasPenalties: competition.hasPenalties,
      thirdPlaceMatch: competition.thirdPlaceMatch
    })
    setShowSettingsModal(true)
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    
    try {
      const res = await fetch(`/api/match-setup/competitions/${competitionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editedSettings.name,
          description: editedSettings.description,
          venue: editedSettings.venue,
          resourceId: editedSettings.resourceId,
          startDate: editedSettings.startDate || undefined,
          endDate: editedSettings.endDate || undefined,
          dailyStartTime: editedSettings.dailyStartTime,
          dailyEndTime: editedSettings.dailyEndTime,
          matchDuration: editedSettings.matchDuration,
          breakDuration: editedSettings.breakDuration,
          matchesPerDay: editedSettings.matchesPerDay,
          pointsForWin: editedSettings.pointsForWin,
          pointsForDraw: editedSettings.pointsForDraw,
          pointsForLoss: editedSettings.pointsForLoss,
          hasOvertime: editedSettings.hasOvertime,
          overtimeMinutes: editedSettings.overtimeMinutes,
          hasPenalties: editedSettings.hasPenalties,
          thirdPlaceMatch: editedSettings.thirdPlaceMatch
        })
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Kunne ikke lagre innstillinger")
      }
      
      setShowSettingsModal(false)
      fetchCompetition()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Feil ved lagring")
    } finally {
      setSavingSettings(false)
    }
  }

  const resetCompetition = async () => {
    if (!confirm("Er du sikker på at du vil nullstille konkurransen?\n\nDette vil:\n• Fjerne alle kampresultater\n• Nullstille all lagstatistikk\n• Sette alle kamper tilbake til \"Planlagt\"\n\nKampoppsettet beholdes.")) {
      return
    }
    
    setResetting(true)
    
    try {
      const res = await fetch(`/api/match-setup/competitions/${competitionId}/reset`, {
        method: "POST"
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Kunne ikke nullstille konkurransen")
      }
      
      fetchCompetition()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Feil ved nullstilling")
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-500">Laster konkurranse...</p>
        </div>
      </div>
    )
  }

  if (error || !competition) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error || "Konkurranse ikke funnet"}</p>
            <Link href={backLink} className="text-blue-600 hover:underline">
              Tilbake til oversikt
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const completedMatches = competition.matches.filter(m => m.status === "COMPLETED").length
  const scheduledMatches = competition.matches.filter(m => m.status === "SCHEDULED").length

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-6">
            <Link 
              href={backLink}
              className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Tilbake til oversikt
            </Link>
            
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">{competition.name}</h1>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                    competition.type === "LEAGUE" 
                      ? "bg-amber-100 text-amber-700" 
                      : "bg-orange-100 text-orange-700"
                  }`}>
                    {competition.type === "LEAGUE" ? "Serie" : "Cup"}
                  </span>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                    competition.status === "ACTIVE" ? "bg-green-100 text-green-700" :
                    competition.status === "COMPLETED" ? "bg-purple-100 text-purple-700" :
                    competition.status === "SCHEDULED" ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {competition.status === "ACTIVE" ? "Pågår" :
                     competition.status === "COMPLETED" ? "Fullført" :
                     competition.status === "SCHEDULED" ? "Planlagt" :
                     "Utkast"}
                  </span>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(competition.startDate).toLocaleDateString("nb-NO")}
                  </span>
                  {competition.venue && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {competition.venue}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Start-knapp - vises for DRAFT og SCHEDULED (før konkurransen har startet) */}
                {(competition.status === "DRAFT" || competition.status === "SCHEDULED") && competition.teams.length >= 2 && (
                  <button
                    onClick={startCompetition}
                    disabled={generatingMatches}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
                  >
                    {generatingMatches ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Start konkurransen
                  </button>
                )}
                {/* Nullstill-knapp - vises kun for ACTIVE og COMPLETED (etter at konkurransen har startet) */}
                {(competition.status === "ACTIVE" || competition.status === "COMPLETED") && (
                  <button
                    onClick={resetCompetition}
                    disabled={resetting}
                    className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2"
                    title="Nullstill alle resultater og start på nytt"
                  >
                    {resetting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    Nullstill
                  </button>
                )}
                <button
                  onClick={deleteCompetition}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Slett konkurranse"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{competition.teams.length}</p>
                  <p className="text-sm text-gray-500">Lag</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Swords className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{competition.matches.length}</p>
                  <p className="text-sm text-gray-500">Kamper</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{completedMatches}</p>
                  <p className="text-sm text-gray-500">Spilt</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{scheduledMatches}</p>
                  <p className="text-sm text-gray-500">Gjenstår</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b">
            {(["overview", "teams", "matches", "bracket", "standings"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === tab
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab === "overview" && "Oversikt"}
                {tab === "teams" && `Lag (${competition.teams.length})`}
                {tab === "matches" && `Kamper (${competition.matches.length})`}
                {tab === "bracket" && "Kamptre"}
                {tab === "standings" && "Tabell"}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Description */}
              {competition.description && (
                <div className="card p-6 lg:col-span-2">
                  <h3 className="font-semibold text-gray-900 mb-2">Beskrivelse</h3>
                  <p className="text-gray-600">{competition.description}</p>
                </div>
              )}
              
              {/* Settings */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-gray-400" />
                    Innstillinger
                  </h3>
                  {(competition.status === "DRAFT" || competition.status === "SCHEDULED") && (
                    <button
                      onClick={openSettingsModal}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Rediger
                    </button>
                  )}
                </div>
                <dl className="space-y-3 text-sm">
                  {/* Kampinnstillinger */}
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Kampvarighet</dt>
                    <dd className="font-medium">{competition.matchDuration} min</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Pause</dt>
                    <dd className="font-medium">{competition.breakDuration} min</dd>
                  </div>
                  {competition.matchesPerDay && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Maks kamper/dag</dt>
                      <dd className="font-medium">{competition.matchesPerDay}</dd>
                    </div>
                  )}
                  
                  {/* Poengsystem for seriespill */}
                  {competition.type === "LEAGUE" && (
                    <>
                      <div className="border-t pt-3 mt-3">
                        <dt className="text-xs text-gray-400 uppercase tracking-wider mb-2">Poengsystem</dt>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Seier / Uavgjort / Tap</dt>
                        <dd className="font-medium">
                          {competition.pointsForWin} / {competition.pointsForDraw} / {competition.pointsForLoss}
                        </dd>
                      </div>
                    </>
                  )}
                  
                  {/* Ekstraomganger */}
                  <div className="border-t pt-3 mt-3">
                    <dt className="text-xs text-gray-400 uppercase tracking-wider mb-2">Ekstraomganger</dt>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Overtid</dt>
                    <dd className={`font-medium ${competition.hasOvertime ? 'text-green-600' : 'text-gray-400'}`}>
                      {competition.hasOvertime ? `Ja (${competition.overtimeMinutes} min)` : 'Nei'}
                    </dd>
                  </div>
                  {competition.type === "TOURNAMENT" && (
                    <>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Straffespark</dt>
                        <dd className={`font-medium ${competition.hasPenalties ? 'text-green-600' : 'text-gray-400'}`}>
                          {competition.hasPenalties ? 'Ja' : 'Nei'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Bronsefinale</dt>
                        <dd className={`font-medium ${competition.thirdPlaceMatch ? 'text-green-600' : 'text-gray-400'}`}>
                          {competition.thirdPlaceMatch ? 'Ja' : 'Nei'}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              </div>

              {/* Recent/Upcoming Matches */}
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Swords className="w-5 h-5 text-gray-400" />
                  {competition.status === "ACTIVE" ? "Neste kamper" : "Første kamper"}
                </h3>
                {competition.matches.length === 0 ? (
                  <p className="text-gray-500 text-sm">Ingen kamper generert ennå</p>
                ) : (
                  <div className="space-y-3">
                    {competition.matches
                      .filter(m => m.status === "SCHEDULED")
                      .slice(0, 5)
                      .map(match => (
                        <div key={match.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {match.homeTeam?.name || match.homeTeamPlaceholder} 
                              <span className="text-gray-400 mx-2">vs</span>
                              {match.awayTeam?.name || match.awayTeamPlaceholder}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(match.scheduledTime).toLocaleDateString("nb-NO", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "teams" && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Deltagende lag</h3>
                {competition.status === "DRAFT" && (
                  <button
                    onClick={() => setShowAddTeamModal(true)}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Legg til lag
                  </button>
                )}
                {(competition.status === "ACTIVE" || competition.status === "COMPLETED") && (
                  <span className="text-sm text-gray-500 italic">
                    Konkurransen er startet - lag kan ikke endres
                  </span>
                )}
              </div>
              
              {competition.teams.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-4">Ingen lag lagt til ennå</p>
                  {competition.status === "DRAFT" && (
                    <button
                      onClick={() => setShowAddTeamModal(true)}
                      className="text-orange-600 hover:underline font-medium"
                    >
                      Legg til første lag
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid gap-3">
                  {competition.teams.map((team, index) => (
                    <div 
                      key={team.id} 
                      onClick={() => openTeamEditor(team)}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors group"
                    >
                      <span className="text-gray-400 font-medium w-6">{index + 1}.</span>
                      <div 
                        className="w-4 h-4 rounded-full flex-shrink-0 border border-gray-300" 
                        style={{ backgroundColor: team.color || "#e5e7eb" }}
                      />
                      <div className="flex-1">
                        <span className="font-medium group-hover:text-orange-600 transition-colors">{team.name}</span>
                        {team.shortName && (
                          <span className="text-sm text-gray-400 ml-2">({team.shortName})</span>
                        )}
                        {team.players && team.players.length > 0 && (
                          <span className="text-xs text-gray-400 ml-2">
                            • {team.players.length} spiller{team.players.length !== 1 ? "e" : ""}
                          </span>
                        )}
                      </div>
                      {team.contactName && (
                        <span className="text-sm text-gray-500">{team.contactName}</span>
                      )}
                      <span className="text-gray-400 group-hover:text-orange-500 transition-colors">
                        <Settings className="w-4 h-4" />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "matches" && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Alle kamper</h3>
                {(competition.status === "ACTIVE" || competition.status === "COMPLETED") && competition.matches.length > 0 && (
                  <span className="text-sm text-gray-500 italic">
                    Konkurransen er startet - kampoppsett kan ikke endres
                  </span>
                )}
              </div>
              
              {(competition.status !== "ACTIVE" && competition.status !== "COMPLETED") ? (
                <div className="text-center py-12">
                  <Swords className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-2">Konkurransen er ikke startet</p>
                  <p className="text-sm text-gray-400">
                    {competition.teams.length < 2 
                      ? "Legg til minst 2 lag først, deretter start konkurransen"
                      : "Start konkurransen for å se kampoppsettet"}
                  </p>
                </div>
              ) : competition.matches.length === 0 ? (
                <div className="text-center py-12">
                  <Swords className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-2">Ingen kamper generert</p>
                  <p className="text-sm text-gray-400">
                    Noe gikk galt - prøv å nullstille og starte på nytt
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {competition.matches.map(match => (
                    <div 
                      key={match.id} 
                      className={`p-4 rounded-lg border ${
                        match.status === "COMPLETED" 
                          ? "bg-gray-50 border-gray-200" 
                          : "bg-white border-gray-200 hover:border-orange-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-400">#{match.matchNumber}</span>
                            {match.roundName && (
                              <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">
                                {match.roundName}
                              </span>
                            )}
                            {match.status === "COMPLETED" && (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="flex-1 text-right">
                              <span className={`font-medium ${match.winner?.id === match.homeTeam?.id ? "text-green-600" : ""}`}>
                                {match.homeTeam?.name || match.homeTeamPlaceholder}
                              </span>
                            </div>
                            
                            <div className="w-20 text-center">
                              {match.status === "COMPLETED" ? (
                                <span className="font-bold text-lg">
                                  {match.homeScore} - {match.awayScore}
                                </span>
                              ) : (
                                <span className="text-gray-400">vs</span>
                              )}
                            </div>
                            
                            <div className="flex-1 text-left">
                              <span className={`font-medium ${match.winner?.id === match.awayTeam?.id ? "text-green-600" : ""}`}>
                                {match.awayTeam?.name || match.awayTeamPlaceholder}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>
                              {new Date(match.scheduledTime).toLocaleDateString("nb-NO", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </span>
                            {match.venue && <span>{match.venue}</span>}
                          </div>
                        </div>
                        
                        {/* Fast bredde for knapp-området for konsistent justering */}
                        <div className="w-32 ml-4 flex-shrink-0">
                          {competition.status === "ACTIVE" && match.homeTeam && match.awayTeam && (
                            <button
                              onClick={() => {
                                setEditingMatch(match)
                                setMatchScores({ 
                                  home: match.homeScore ?? 0, 
                                  away: match.awayScore ?? 0 
                                })
                              }}
                              className={`w-full px-3 py-1.5 text-sm rounded-lg ${
                                match.status === "COMPLETED"
                                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                  : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                              }`}
                            >
                              {match.status === "COMPLETED" ? "Endre resultat" : "Registrer resultat"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "bracket" && (
            <div className="card overflow-hidden">
              {(competition.status !== "ACTIVE" && competition.status !== "COMPLETED") ? (
                <div className="p-12 text-center">
                  <Swords className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-2">Konkurransen er ikke startet</p>
                  <p className="text-sm text-gray-400">
                    Start konkurransen for å se kamptreet
                  </p>
                </div>
              ) : competition.matches.length === 0 ? (
                <div className="p-12 text-center">
                  <Swords className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-2">Ingen kamper generert</p>
                  <p className="text-sm text-gray-400">
                    Noe gikk galt - prøv å nullstille og starte på nytt
                  </p>
                </div>
              ) : competition.type === "LEAGUE" ? (
                <div className="p-12 text-center">
                  <Medal className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-2">Kamptre er kun for turneringer</p>
                  <p className="text-sm text-gray-400">
                    Seriespill vises best i tabell- og kampvisning
                  </p>
                </div>
              ) : (
                <div className="bg-slate-900 min-h-[400px]">
                  <TournamentBracket 
                    matches={competition.matches}
                    competitionId={competition.id}
                    competitionStatus={competition.status}
                    onMatchUpdate={fetchCompetition}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === "standings" && (
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Medal className="w-5 h-5 text-gray-400" />
                Tabell
              </h3>
              
              {competition.teams.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Ingen lag i konkurransen</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-500 border-b">
                        <th className="pb-3 font-medium w-8">#</th>
                        <th className="pb-3 font-medium">Lag</th>
                        <th className="pb-3 font-medium text-center w-12 cursor-help" title="Kamper spilt">K</th>
                        <th className="pb-3 font-medium text-center w-12 cursor-help" title="Seire">S</th>
                        <th className="pb-3 font-medium text-center w-12 cursor-help" title="Uavgjort">U</th>
                        <th className="pb-3 font-medium text-center w-12 cursor-help" title="Tap">T</th>
                        <th className="pb-3 font-medium text-center w-16 cursor-help" title="Mål scoret">M+</th>
                        <th className="pb-3 font-medium text-center w-16 cursor-help" title="Mål sluppet inn">M-</th>
                        <th className="pb-3 font-medium text-center w-16 cursor-help" title="Målforskjell">+/-</th>
                        <th className="pb-3 font-medium text-center w-16 cursor-help" title="Poeng">P</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...competition.teams]
                        .sort((a, b) => {
                          if (b.points !== a.points) return b.points - a.points
                          if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
                          return b.goalsFor - a.goalsFor
                        })
                        .map((team, index) => (
                          <tr 
                            key={team.id} 
                            className={`border-b last:border-0 ${
                              index === 0 ? "bg-yellow-50" : 
                              index === 1 ? "bg-gray-50" : 
                              index === 2 ? "bg-amber-50/50" : ""
                            }`}
                          >
                            <td className="py-3 text-center font-bold text-gray-400">{index + 1}</td>
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
                            <td className="py-3 text-center">{team.played}</td>
                            <td className="py-3 text-center text-green-600 font-medium">{team.wins}</td>
                            <td className="py-3 text-center text-gray-500">{team.draws}</td>
                            <td className="py-3 text-center text-red-500">{team.losses}</td>
                            <td className="py-3 text-center">{team.goalsFor}</td>
                            <td className="py-3 text-center">{team.goalsAgainst}</td>
                            <td className="py-3 text-center">
                              <span className={`font-medium ${
                                team.goalDifference > 0 ? "text-green-600" : 
                                team.goalDifference < 0 ? "text-red-500" : "text-gray-500"
                              }`}>
                                {team.goalDifference > 0 ? "+" : ""}{team.goalDifference}
                              </span>
                            </td>
                            <td className="py-3 text-center">
                              <span className="font-bold text-lg">{team.points}</span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      
      <Footer />

      {/* Settings Modal */}
      {showSettingsModal && competition && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-400" />
                Rediger innstillinger
              </h3>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Grunnleggende info */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Grunnleggende informasjon</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Navn på konkurransen *
                    </label>
                    <input
                      type="text"
                      value={editedSettings.name}
                      onChange={(e) => setEditedSettings(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Beskrivelse
                    </label>
                    <textarea
                      value={editedSettings.description}
                      onChange={(e) => setEditedSettings(prev => ({ ...prev, description: e.target.value }))}
                      rows={2}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Startdato
                      </label>
                      <input
                        type="date"
                        value={editedSettings.startDate}
                        onChange={(e) => setEditedSettings(prev => ({ ...prev, startDate: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sluttdato
                      </label>
                      <input
                        type="date"
                        value={editedSettings.endDate}
                        onChange={(e) => setEditedSettings(prev => ({ ...prev, endDate: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  </div>
                  
                  {/* Daglige tidspunkter */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Starttid hver dag
                      </label>
                      <input
                        type="time"
                        value={editedSettings.dailyStartTime}
                        onChange={(e) => setEditedSettings(prev => ({ ...prev, dailyStartTime: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Sluttid hver dag
                      </label>
                      <input
                        type="time"
                        value={editedSettings.dailyEndTime}
                        onChange={(e) => setEditedSettings(prev => ({ ...prev, dailyEndTime: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 -mt-2">
                    Disse tidspunktene blokkerer fasiliteten i kalenderen
                  </p>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <MapPin className="w-4 h-4 inline mr-1" />
                      Fasilitet <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={editedSettings.resourceId || ""}
                      onChange={(e) => {
                        const resourceId = e.target.value || null
                        const resource = resources.find(r => r.id === resourceId)
                        setEditedSettings(prev => ({
                          ...prev,
                          resourceId,
                          venue: resource?.name || ""
                        }))
                      }}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                        !editedSettings.resourceId ? "border-red-300 bg-red-50" : "border-gray-300"
                      }`}
                    >
                      <option value="">Velg fasilitet...</option>
                      {resources.map(resource => (
                        <option key={resource.id} value={resource.id}>
                          {resource.name} {resource.location ? `- ${resource.location}` : ""}
                        </option>
                      ))}
                    </select>
                    {!editedSettings.resourceId && (
                      <p className="mt-1 text-xs text-red-500">
                        Fasilitet er påkrevd for å vise kamper i kalenderen
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Kampinnstillinger */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Kampinnstillinger</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Kampvarighet (min)
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={180}
                        value={editedSettings.matchDuration}
                        onChange={(e) => setEditedSettings(prev => ({ ...prev, matchDuration: parseInt(e.target.value) || 60 }))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pause (min)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={editedSettings.breakDuration}
                        onChange={(e) => setEditedSettings(prev => ({ ...prev, breakDuration: parseInt(e.target.value) || 15 }))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Maks kamper/dag
                      </label>
                      <input
                        type="number"
                        min={1}
                        placeholder="Ingen grense"
                        value={editedSettings.matchesPerDay ?? ""}
                        onChange={(e) => setEditedSettings(prev => ({ ...prev, matchesPerDay: e.target.value ? parseInt(e.target.value) : null }))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Poengsystem (kun for seriespill) */}
              {competition.type === "LEAGUE" && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Poengsystem</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Poeng for seier</label>
                      <input
                        type="number"
                        min={0}
                        value={editedSettings.pointsForWin}
                        onChange={(e) => setEditedSettings(prev => ({ ...prev, pointsForWin: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Poeng for uavgjort</label>
                      <input
                        type="number"
                        min={0}
                        value={editedSettings.pointsForDraw}
                        onChange={(e) => setEditedSettings(prev => ({ ...prev, pointsForDraw: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Poeng for tap</label>
                      <input
                        type="number"
                        min={0}
                        value={editedSettings.pointsForLoss}
                        onChange={(e) => setEditedSettings(prev => ({ ...prev, pointsForLoss: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Ekstraomganger */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Ekstraomganger</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={editedSettings.hasOvertime}
                      onChange={(e) => setEditedSettings(prev => ({ ...prev, hasOvertime: e.target.checked }))}
                      className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">Overtid ved uavgjort</p>
                      <p className="text-xs text-gray-500">Ekstra spilletid hvis kampen står likt</p>
                    </div>
                    {editedSettings.hasOvertime && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={5}
                          max={30}
                          value={editedSettings.overtimeMinutes}
                          onChange={(e) => setEditedSettings(prev => ({ ...prev, overtimeMinutes: parseInt(e.target.value) || 10 }))}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                        />
                        <span className="text-xs text-gray-500">min</span>
                      </div>
                    )}
                  </label>

                  {competition.type === "TOURNAMENT" && (
                    <>
                      <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={editedSettings.hasPenalties}
                          onChange={(e) => setEditedSettings(prev => ({ ...prev, hasPenalties: e.target.checked }))}
                          className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                        />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">Straffespark</p>
                          <p className="text-xs text-gray-500">Avgjørelse ved straffespark hvis fortsatt uavgjort</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={editedSettings.thirdPlaceMatch}
                          onChange={(e) => setEditedSettings(prev => ({ ...prev, thirdPlaceMatch: e.target.checked }))}
                          className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                        />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">Bronsefinale</p>
                          <p className="text-xs text-gray-500">Kamp om 3. plass mellom semifinaletaperne</p>
                        </div>
                      </label>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
              >
                Avbryt
              </button>
              <button
                onClick={saveSettings}
                disabled={savingSettings || !editedSettings.name.trim()}
                className="flex-1 px-4 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingSettings && <Loader2 className="w-4 h-4 animate-spin" />}
                Lagre endringer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Team Modal */}
      {showAddTeamModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Legg til lag</h3>
              <button 
                onClick={() => setShowAddTeamModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lagnavn *
                </label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="F.eks. Haugesund FK"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kortnavn (valgfritt)
                </label>
                <input
                  type="text"
                  value={newTeamShortName}
                  onChange={(e) => setNewTeamShortName(e.target.value)}
                  placeholder="F.eks. HFK"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddTeamModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
              >
                Avbryt
              </button>
              <button
                onClick={addTeam}
                disabled={!newTeamName.trim() || addingTeam}
                className="flex-1 px-4 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {addingTeam && <Loader2 className="w-4 h-4 animate-spin" />}
                Legg til
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Match Score Modal */}
      {editingMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Registrer resultat</h3>
              <button 
                onClick={() => setEditingMatch(null)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="text-center mb-6">
              <p className="text-sm text-gray-500 mb-2">Kamp #{editingMatch.matchNumber}</p>
              <div className="flex items-center justify-center gap-4">
                <span className="font-medium">{editingMatch.homeTeam?.name}</span>
                <span className="text-gray-400">vs</span>
                <span className="font-medium">{editingMatch.awayTeam?.name}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-6 mb-6">
              <div className="text-center">
                <label className="block text-sm text-gray-500 mb-2">
                  {editingMatch.homeTeam?.shortName || editingMatch.homeTeam?.name}
                </label>
                <input
                  type="number"
                  min={0}
                  value={matchScores.home}
                  onChange={(e) => setMatchScores(prev => ({ ...prev, home: parseInt(e.target.value) || 0 }))}
                  className="w-20 h-16 text-center text-3xl font-bold border-2 border-gray-300 rounded-xl focus:border-orange-500 focus:ring-0"
                />
              </div>
              <span className="text-2xl text-gray-400">-</span>
              <div className="text-center">
                <label className="block text-sm text-gray-500 mb-2">
                  {editingMatch.awayTeam?.shortName || editingMatch.awayTeam?.name}
                </label>
                <input
                  type="number"
                  min={0}
                  value={matchScores.away}
                  onChange={(e) => setMatchScores(prev => ({ ...prev, away: parseInt(e.target.value) || 0 }))}
                  className="w-20 h-16 text-center text-3xl font-bold border-2 border-gray-300 rounded-xl focus:border-orange-500 focus:ring-0"
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setEditingMatch(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
              >
                Avbryt
              </button>
              <button
                onClick={saveMatchScore}
                disabled={savingScore}
                className="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingScore && <Loader2 className="w-4 h-4 animate-spin" />}
                <CheckCircle className="w-4 h-4" />
                Lagre resultat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Team Modal */}
      {editingTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Rediger lag</h3>
              <button 
                onClick={() => setEditingTeam(null)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Lagnavn */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lagnavn *
                </label>
                <input
                  type="text"
                  value={editedTeamData.name}
                  onChange={(e) => setEditedTeamData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Lagnavn"
                />
              </div>

              {/* Kortnavn */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kortnavn (valgfritt)
                </label>
                <input
                  type="text"
                  value={editedTeamData.shortName}
                  onChange={(e) => setEditedTeamData(prev => ({ ...prev, shortName: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="F.eks. LAG"
                  maxLength={5}
                />
              </div>

              {/* Lagfarge */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lagfarge
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={editedTeamData.color}
                    onChange={(e) => setEditedTeamData(prev => ({ ...prev, color: e.target.value }))}
                    className="w-12 h-10 rounded cursor-pointer border border-gray-300"
                  />
                  <input
                    type="text"
                    value={editedTeamData.color}
                    onChange={(e) => setEditedTeamData(prev => ({ ...prev, color: e.target.value }))}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="#3b82f6"
                  />
                </div>
              </div>

              {/* Kontaktinfo */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-3">Kontaktinformasjon</h4>
                <div className="grid grid-cols-1 gap-3">
                  <input
                    type="text"
                    value={editedTeamData.contactName}
                    onChange={(e) => setEditedTeamData(prev => ({ ...prev, contactName: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Kontaktperson"
                  />
                  <input
                    type="email"
                    value={editedTeamData.contactEmail}
                    onChange={(e) => setEditedTeamData(prev => ({ ...prev, contactEmail: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="E-post"
                  />
                  <input
                    type="tel"
                    value={editedTeamData.contactPhone}
                    onChange={(e) => setEditedTeamData(prev => ({ ...prev, contactPhone: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Telefon"
                  />
                </div>
              </div>

              {/* Spillere */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-3">Spillere</h4>
                
                {/* Legg til spiller */}
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={editedTeamData.newPlayer}
                    onChange={(e) => setEditedTeamData(prev => ({ ...prev, newPlayer: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPlayer())}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Spillernavn"
                  />
                  <button
                    type="button"
                    onClick={addPlayer}
                    className="px-4 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Legg til
                  </button>
                </div>

                {/* Spillerliste */}
                {editedTeamData.players.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {editedTeamData.players.map((player, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <span className="flex items-center gap-2">
                          <span className="text-gray-400 text-sm w-6">{index + 1}.</span>
                          <span>{player}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removePlayer(index)}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">Ingen spillere lagt til</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingTeam(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
              >
                Avbryt
              </button>
              <button
                onClick={saveTeam}
                disabled={savingTeam || !editedTeamData.name.trim()}
                className="flex-1 px-4 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingTeam && <Loader2 className="w-4 h-4 animate-spin" />}
                Lagre endringer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

