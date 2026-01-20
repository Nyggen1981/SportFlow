"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import Link from "next/link"
import { 
  ArrowLeft,
  Trophy,
  Swords,
  Medal,
  Calendar,
  Clock,
  Users,
  Settings,
  Loader2,
  CheckCircle,
  Info,
  Building2,
  UserPlus,
  CreditCard
} from "lucide-react"

type CompetitionType = "LEAGUE" | "TOURNAMENT"
type RegistrationType = "TEAM" | "PLAYER"

interface Resource {
  id: string
  name: string
  location?: string
  parts: { id: string; name: string }[]
}

interface FormData {
  name: string
  description: string
  type: CompetitionType
  startDate: string
  endDate: string
  dailyStartTime: string
  dailyEndTime: string
  venue: string
  resourceId: string | null
  pointsForWin: number
  pointsForDraw: number
  pointsForLoss: number
  hasOvertime: boolean
  overtimeMinutes: number
  hasPenalties: boolean
  matchDuration: number
  breakDuration: number
  matchesPerDay: number | null
  hasGroups: boolean
  groupCount: number
  teamsPerGroup: number
  advancePerGroup: number
  thirdPlaceMatch: boolean
  // Påmeldingsinnstillinger
  registrationType: RegistrationType
  registrationOpen: boolean
  registrationDeadline: string
  registrationFee: number | null
  maxRegistrations: number | null
  minPlayersPerTeam: number | null
  maxPlayersPerTeam: number | null
  requiresPayment: boolean
}

export default function NewCompetitionPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [isFullAdmin, setIsFullAdmin] = useState(true)
  const [resources, setResources] = useState<Resource[]>([])
  const [loadingResources, setLoadingResources] = useState(true)
  
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
        console.error("Kunne ikke hente fasiliteter:", error)
      } finally {
        setLoadingResources(false)
      }
    }
    fetchResources()
  }, [])

  const backLink = isFullAdmin ? "/admin/match-setup" : "/match-admin"
  
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    type: "LEAGUE",
    startDate: "",
    endDate: "",
    dailyStartTime: "09:00",
    dailyEndTime: "18:00",
    venue: "",
    resourceId: null,
    pointsForWin: 3,
    pointsForDraw: 1,
    pointsForLoss: 0,
    hasOvertime: false,
    overtimeMinutes: 10,
    hasPenalties: false,
    matchDuration: 60,
    breakDuration: 15,
    matchesPerDay: null,
    hasGroups: false,
    groupCount: 4,
    teamsPerGroup: 4,
    advancePerGroup: 2,
    thirdPlaceMatch: false,
    // Påmeldingsinnstillinger
    registrationType: "TEAM",
    registrationOpen: false,
    registrationDeadline: "",
    registrationFee: null,
    maxRegistrations: null,
    minPlayersPerTeam: 1,
    maxPlayersPerTeam: null,
    requiresPayment: false
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" 
        ? (e.target as HTMLInputElement).checked 
        : type === "number" 
          ? value === "" ? null : Number(value)
          : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/match-setup/competitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunne ikke opprette konkurranse")
      }

      const competition = await response.json()
      router.push(`/admin/match-setup/${competition.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "En feil oppstod")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link 
              href={backLink}
              className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Tilbake til oversikt
            </Link>
            
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              Ny konkurranse
            </h1>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2 sm:gap-4 mb-8 overflow-x-auto">
            <button
              onClick={() => setStep(1)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap text-sm ${
                step === 1 
                  ? "bg-orange-100 text-orange-700" 
                  : step > 1 
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
              }`}
            >
              {step > 1 ? <CheckCircle className="w-4 h-4" /> : <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">1</span>}
              Grunninfo
            </button>
            <div className="h-px flex-1 bg-gray-200 min-w-4" />
            <button
              onClick={() => step > 1 && setStep(2)}
              disabled={step < 2}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap text-sm ${
                step === 2 
                  ? "bg-orange-100 text-orange-700" 
                  : step > 2 
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
              }`}
            >
              {step > 2 ? <CheckCircle className="w-4 h-4" /> : <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">2</span>}
              Innstillinger
            </button>
            <div className="h-px flex-1 bg-gray-200 min-w-4" />
            <button
              onClick={() => step > 2 && setStep(3)}
              disabled={step < 3}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap text-sm ${
                step === 3 
                  ? "bg-orange-100 text-orange-700" 
                  : step > 3 
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
              }`}
            >
              {step > 3 ? <CheckCircle className="w-4 h-4" /> : <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">3</span>}
              Påmelding
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Step 1: Basic Info */}
            {step === 1 && (
              <div className="card p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Info className="w-5 h-5 text-gray-400" />
                    Grunnleggende informasjon
                  </h2>
                  
                  {/* Competition Type */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Type konkurranse
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, type: "LEAGUE" }))}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          formData.type === "LEAGUE"
                            ? "border-orange-500 bg-orange-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <Swords className={`w-8 h-8 mx-auto mb-2 ${formData.type === "LEAGUE" ? "text-orange-500" : "text-gray-400"}`} />
                        <p className="font-medium text-gray-900">Seriespill</p>
                        <p className="text-xs text-gray-500 mt-1">Alle lag møter hverandre</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, type: "TOURNAMENT" }))}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          formData.type === "TOURNAMENT"
                            ? "border-orange-500 bg-orange-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <Medal className={`w-8 h-8 mx-auto mb-2 ${formData.type === "TOURNAMENT" ? "text-orange-500" : "text-gray-400"}`} />
                        <p className="font-medium text-gray-900">Turnering</p>
                        <p className="text-xs text-gray-500 mt-1">Cup/sluttspill-format</p>
                      </button>
                    </div>
                  </div>

                  {/* Name */}
                  <div className="mb-4">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Navn på konkurransen *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="F.eks. Vårserien 2026 eller Påskecup"
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>

                  {/* Description */}
                  <div className="mb-4">
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                      Beskrivelse
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Kort beskrivelse av konkurransen..."
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Startdato *
                      </label>
                      <input
                        type="date"
                        id="startDate"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                        Sluttdato
                      </label>
                      <input
                        type="date"
                        id="endDate"
                        name="endDate"
                        value={formData.endDate}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  </div>
                  
                  {/* Daglige tidspunkter */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="dailyStartTime" className="block text-sm font-medium text-gray-700 mb-1">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Starttid hver dag
                      </label>
                      <input
                        type="time"
                        id="dailyStartTime"
                        name="dailyStartTime"
                        value={formData.dailyStartTime}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="dailyEndTime" className="block text-sm font-medium text-gray-700 mb-1">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Sluttid hver dag
                      </label>
                      <input
                        type="time"
                        id="dailyEndTime"
                        name="dailyEndTime"
                        value={formData.dailyEndTime}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  </div>

                  {/* Fasilitet - påkrevd */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Building2 className="w-4 h-4 inline mr-1" />
                      Fasilitet <span className="text-red-500">*</span>
                    </label>
                    {loadingResources ? (
                      <div className="flex items-center gap-2 text-gray-500 py-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Laster fasiliteter...
                      </div>
                    ) : resources.length === 0 ? (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
                        Ingen fasiliteter er opprettet. Opprett en fasilitet først.
                      </div>
                    ) : (
                      <>
                        <select
                          value={formData.resourceId || ""}
                          onChange={(e) => {
                            const resourceId = e.target.value || null
                            const resource = resources.find(r => r.id === resourceId)
                            setFormData(prev => ({
                              ...prev,
                              resourceId,
                              venue: resource?.name || ""
                            }))
                          }}
                          className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                            !formData.resourceId ? "border-gray-300" : "border-orange-300 bg-orange-50"
                          }`}
                        >
                          <option value="">Velg fasilitet...</option>
                          {resources.map(resource => (
                            <option key={resource.id} value={resource.id}>
                              {resource.name} {resource.location ? `- ${resource.location}` : ""}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                          Turneringen låses til denne fasiliteten og vises i bookingkalenderen
                        </p>
                      </>
                    )}

                    {/* Valgt fasilitet info */}
                    {formData.resourceId && (
                      <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-orange-700">
                          <CheckCircle className="w-4 h-4" />
                          <span className="font-medium">
                            {resources.find(r => r.id === formData.resourceId)?.name}
                          </span>
                        </div>
                        {resources.find(r => r.id === formData.resourceId)?.parts?.length ? (
                          <p className="mt-1 text-xs text-orange-600">
                            {resources.find(r => r.id === formData.resourceId)?.parts.length} baner tilgjengelig for kampfordeling
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-orange-600">
                            Hele fasiliteten brukes til turneringen
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!formData.name || !formData.startDate || !formData.resourceId}
                    className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Neste: Innstillinger
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Settings */}
            {step === 2 && (
              <div className="card p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-gray-400" />
                    Kampinnstillinger
                  </h2>

                  {/* Match Duration */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="matchDuration" className="block text-sm font-medium text-gray-700 mb-1">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Kampvarighet (min)
                      </label>
                      <input
                        type="number"
                        id="matchDuration"
                        name="matchDuration"
                        value={formData.matchDuration}
                        onChange={handleChange}
                        min={10}
                        max={180}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="breakDuration" className="block text-sm font-medium text-gray-700 mb-1">
                        Pause mellom kamper (min)
                      </label>
                      <input
                        type="number"
                        id="breakDuration"
                        name="breakDuration"
                        value={formData.breakDuration}
                        onChange={handleChange}
                        min={1}
                        max={60}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div className="mb-6">
                    <label htmlFor="matchesPerDay" className="block text-sm font-medium text-gray-700 mb-1">
                      Maks kamper per dag (valgfritt)
                    </label>
                    <input
                      type="number"
                      id="matchesPerDay"
                      name="matchesPerDay"
                      value={formData.matchesPerDay ?? ""}
                      onChange={handleChange}
                      min={1}
                      placeholder="Ingen grense"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Points System (for League) */}
                {formData.type === "LEAGUE" && (
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-gray-400" />
                      Poengsystem
                    </h2>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label htmlFor="pointsForWin" className="block text-sm font-medium text-gray-700 mb-1">
                          Poeng for seier
                        </label>
                        <input
                          type="number"
                          id="pointsForWin"
                          name="pointsForWin"
                          value={formData.pointsForWin}
                          onChange={handleChange}
                          min={0}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="pointsForDraw" className="block text-sm font-medium text-gray-700 mb-1">
                          Poeng for uavgjort
                        </label>
                        <input
                          type="number"
                          id="pointsForDraw"
                          name="pointsForDraw"
                          value={formData.pointsForDraw}
                          onChange={handleChange}
                          min={0}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="pointsForLoss" className="block text-sm font-medium text-gray-700 mb-1">
                          Poeng for tap
                        </label>
                        <input
                          type="number"
                          id="pointsForLoss"
                          name="pointsForLoss"
                          value={formData.pointsForLoss}
                          onChange={handleChange}
                          min={0}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Tournament Settings */}
                {formData.type === "TOURNAMENT" && (
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-gray-400" />
                      Turneringsformat
                    </h2>
                    
                    <div className="space-y-4">
                      <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          name="hasGroups"
                          checked={formData.hasGroups}
                          onChange={handleChange}
                          className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                        />
                        <div>
                          <p className="font-medium text-gray-900">Gruppespill først</p>
                          <p className="text-sm text-gray-500">Lag spiller i grupper før sluttspill</p>
                        </div>
                      </label>

                      {formData.hasGroups && (
                        <div className="grid grid-cols-3 gap-4 pl-4 border-l-2 border-orange-200">
                          <div>
                            <label htmlFor="groupCount" className="block text-sm font-medium text-gray-700 mb-1">
                              Antall grupper
                            </label>
                            <input
                              type="number"
                              id="groupCount"
                              name="groupCount"
                              value={formData.groupCount}
                              onChange={handleChange}
                              min={2}
                              max={16}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                            />
                          </div>
                          <div>
                            <label htmlFor="teamsPerGroup" className="block text-sm font-medium text-gray-700 mb-1">
                              Lag per gruppe
                            </label>
                            <input
                              type="number"
                              id="teamsPerGroup"
                              name="teamsPerGroup"
                              value={formData.teamsPerGroup}
                              onChange={handleChange}
                              min={2}
                              max={12}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                            />
                          </div>
                          <div>
                            <label htmlFor="advancePerGroup" className="block text-sm font-medium text-gray-700 mb-1">
                              Går videre per gruppe
                            </label>
                            <input
                              type="number"
                              id="advancePerGroup"
                              name="advancePerGroup"
                              value={formData.advancePerGroup}
                              onChange={handleChange}
                              min={1}
                              max={formData.teamsPerGroup - 1}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                            />
                          </div>
                        </div>
                      )}

                      <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          name="thirdPlaceMatch"
                          checked={formData.thirdPlaceMatch}
                          onChange={handleChange}
                          className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                        />
                        <div>
                          <p className="font-medium text-gray-900">Bronsefinale</p>
                          <p className="text-sm text-gray-500">Kamp om 3. plass mellom semifinaletaperne</p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Overtime Settings */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Ekstraomganger
                  </h2>
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        name="hasOvertime"
                        checked={formData.hasOvertime}
                        onChange={handleChange}
                        className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Overtid ved uavgjort</p>
                        <p className="text-sm text-gray-500">Ekstra spilletid hvis kampen står likt</p>
                      </div>
                      {formData.hasOvertime && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            name="overtimeMinutes"
                            value={formData.overtimeMinutes}
                            onChange={handleChange}
                            min={5}
                            max={30}
                            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          <span className="text-sm text-gray-500">min</span>
                        </div>
                      )}
                    </label>

                    {formData.type === "TOURNAMENT" && (
                      <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          name="hasPenalties"
                          checked={formData.hasPenalties}
                          onChange={handleChange}
                          className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                        />
                        <div>
                          <p className="font-medium text-gray-900">Straffespark</p>
                          <p className="text-sm text-gray-500">Avgjørelse ved straffespark hvis fortsatt uavgjort</p>
                        </div>
                      </label>
                    )}
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-6 py-2.5 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                  >
                    Tilbake
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
                  >
                    Neste: Påmelding
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Registration Settings */}
            {step === 3 && (
              <div className="card p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-gray-400" />
                    Påmeldingsinnstillinger
                  </h2>

                  {/* Registration Type */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Type påmelding
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, registrationType: "TEAM" }))}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          formData.registrationType === "TEAM"
                            ? "border-orange-500 bg-orange-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <Users className={`w-8 h-8 mx-auto mb-2 ${formData.registrationType === "TEAM" ? "text-orange-500" : "text-gray-400"}`} />
                        <p className="font-medium text-gray-900">Lagpåmelding</p>
                        <p className="text-xs text-gray-500 mt-1">Meld på hele lag med spillere</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, registrationType: "PLAYER" }))}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          formData.registrationType === "PLAYER"
                            ? "border-orange-500 bg-orange-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <UserPlus className={`w-8 h-8 mx-auto mb-2 ${formData.registrationType === "PLAYER" ? "text-orange-500" : "text-gray-400"}`} />
                        <p className="font-medium text-gray-900">Individuel påmelding</p>
                        <p className="text-xs text-gray-500 mt-1">Enkeltpersoner melder seg på</p>
                      </button>
                    </div>
                  </div>

                  {/* Team Settings */}
                  {formData.registrationType === "TEAM" && (
                    <>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label htmlFor="minTeams" className="block text-sm font-medium text-gray-700 mb-1">
                            Min antall lag
                          </label>
                          <input
                            type="number"
                            id="minTeams"
                            name="minTeams"
                            value={formData.minTeams ?? ""}
                            onChange={handleChange}
                            min={2}
                            placeholder="2"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="maxTeams" className="block text-sm font-medium text-gray-700 mb-1">
                            Maks antall lag
                          </label>
                          <input
                            type="number"
                            id="maxTeams"
                            name="maxTeams"
                            value={formData.maxTeams ?? ""}
                            onChange={handleChange}
                            min={2}
                            placeholder="Ingen grense"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label htmlFor="minPlayersPerTeam" className="block text-sm font-medium text-gray-700 mb-1">
                            Min spillere per lag
                          </label>
                          <input
                            type="number"
                            id="minPlayersPerTeam"
                            name="minPlayersPerTeam"
                            value={formData.minPlayersPerTeam ?? ""}
                            onChange={handleChange}
                            min={1}
                            placeholder="1"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="maxPlayersPerTeam" className="block text-sm font-medium text-gray-700 mb-1">
                            Maks spillere per lag
                          </label>
                          <input
                            type="number"
                            id="maxPlayersPerTeam"
                            name="maxPlayersPerTeam"
                            value={formData.maxPlayersPerTeam ?? ""}
                            onChange={handleChange}
                            min={1}
                            placeholder="Ingen grense"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Registration Open Toggle */}
                  <div className="flex items-center gap-3 mb-6">
                    <input
                      type="checkbox"
                      id="registrationOpen"
                      name="registrationOpen"
                      checked={formData.registrationOpen}
                      onChange={(e) => setFormData(prev => ({ ...prev, registrationOpen: e.target.checked }))}
                      className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <label htmlFor="registrationOpen" className="text-sm font-medium text-gray-700">
                      Åpen for påmelding
                    </label>
                  </div>

                  {/* Registration Deadline */}
                  <div className="mb-6">
                    <label htmlFor="registrationDeadline" className="block text-sm font-medium text-gray-700 mb-1">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Påmeldingsfrist
                    </label>
                    <input
                      type="date"
                      id="registrationDeadline"
                      name="registrationDeadline"
                      value={formData.registrationDeadline}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Fees Section */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-gray-400" />
                    Avgifter (valgfritt)
                  </h2>
                  
                  <div className="p-4 bg-gray-50 rounded-lg mb-4">
                    <p className="text-sm text-gray-600">
                      Sett avgifter for påmelding. Betaling håndteres via faktura etter godkjenning.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="registrationFee" className="block text-sm font-medium text-gray-700 mb-1">
                        Påmeldingsavgift (NOK)
                      </label>
                      <input
                        type="number"
                        id="registrationFee"
                        name="registrationFee"
                        value={formData.registrationFee ?? ""}
                        onChange={handleChange}
                        min={0}
                        step="50"
                        placeholder="0 = Gratis"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="maxRegistrations" className="block text-sm font-medium text-gray-700 mb-1">
                        Maks påmeldinger
                      </label>
                      <input
                        type="number"
                        id="maxRegistrations"
                        name="maxRegistrations"
                        value={formData.maxRegistrations ?? ""}
                        onChange={handleChange}
                        min={1}
                        placeholder="Ubegrenset"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                    {error}
                  </div>
                )}

                <div className="flex justify-between pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-6 py-2.5 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                  >
                    Tilbake
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Oppretter...
                      </>
                    ) : (
                      <>
                        <Trophy className="w-4 h-4" />
                        Opprett konkurranse
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </main>
      
      <Footer />
    </div>
  )
}

