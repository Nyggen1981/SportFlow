"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Trophy, X, Loader2, CheckCircle, ZoomIn, ZoomOut, Maximize2 } from "lucide-react"

interface Team {
  id: string
  name: string
  shortName?: string
  color?: string
}

interface Match {
  id: string
  matchNumber: number
  round?: number | null
  roundName?: string
  scheduledTime: string
  status: string
  homeScore?: number | null
  awayScore?: number | null
  homeTeam?: Team | null
  awayTeam?: Team | null
  homeTeamPlaceholder?: string | null
  awayTeamPlaceholder?: string | null
  winnerId?: string | null
  winner?: Team | null
}

interface TournamentBracketProps {
  matches: Match[]
  competitionId?: string
  competitionStatus: string
  onMatchUpdate?: () => void
  onResultRegistered?: () => void
  readOnly?: boolean
}

export function TournamentBracket({ matches, competitionId, competitionStatus, onMatchUpdate, onResultRegistered, readOnly = false }: TournamentBracketProps) {
  const [editingMatch, setEditingMatch] = useState<Match | null>(null)
  const [matchScores, setMatchScores] = useState({ home: 0, away: 0 })
  const [savingScore, setSavingScore] = useState(false)
  
  // Zoom og pan state
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  
  const handleZoomIn = () => setScale(s => Math.min(s + 0.2, 2))
  const handleZoomOut = () => setScale(s => Math.max(s - 0.2, 0.4))
  const handleReset = () => { setScale(1); setPosition({ x: 0, y: 0 }) }
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return // Only left click
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }
  
  const handleMouseUp = () => setIsDragging(false)
  
  // Native wheel handler for å forhindre side-scroll
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale(s => Math.max(0.4, Math.min(2, s + delta)))
  }, [])
  
  // Registrer native event listener for wheel (passive: false er nødvendig for preventDefault)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  // Grupper kamper etter runde
  const rounds = matches.reduce((acc, match) => {
    const round = match.round || 1
    if (!acc[round]) acc[round] = []
    acc[round].push(match)
    return acc
  }, {} as Record<number, Match[]>)

  const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b)
  const totalRounds = roundNumbers.length

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
      onMatchUpdate?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Feil ved lagring")
    } finally {
      setSavingScore(false)
    }
  }

  const getTeamDisplay = (match: Match, isHome: boolean) => {
    const team = isHome ? match.homeTeam : match.awayTeam
    const placeholder = isHome ? match.homeTeamPlaceholder : match.awayTeamPlaceholder
    const score = isHome ? match.homeScore : match.awayScore
    const isWinner = match.winnerId && match.winnerId === team?.id
    
    return {
      name: team?.name || placeholder || "-",
      fullName: team?.name || placeholder || "TBD",
      score: match.status === "COMPLETED" ? score : null,
      isWinner,
      hasTeam: !!team,
      color: team?.color
    }
  }

  // Konstanter for layout
  const MATCH_HEIGHT = 72
  const MATCH_WIDTH = 200
  const CONNECTOR_WIDTH = 40
  const HEADER_HEIGHT = 32
  const FIRST_ROUND_GAP = 20 // Ekstra gap for første runde (plass til kampnummer)

  // Sjekk om første runde er "innledende" (ikke alle kamper i neste runde kommer fra denne)
  const isFirstRoundPreliminary = () => {
    if (totalRounds < 2) return false
    const firstRoundName = rounds[roundNumbers[0]]?.[0]?.roundName?.toLowerCase() || ""
    return firstRoundName.includes("innledende") || firstRoundName.includes("play-in") || firstRoundName.includes("qualifying")
  }

  // Beregn om vi trenger ekstra plass på venstre side for innledende kamper
  // (når det er 9-16 lag som ikke er perfekt potens av 2)
  const needsExtraSpace = totalRounds >= 4 && !isFirstRoundPreliminary()
  
  return (
    <div className="relative w-full">
      {/* Zoom kontroller */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-slate-800/90 rounded-lg p-1 border border-slate-700">
        <button
          onClick={handleZoomOut}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
          title="Zoom ut"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs text-slate-400 w-12 text-center">{Math.round(scale * 100)}%</span>
        <button
          onClick={handleZoomIn}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
          title="Zoom inn"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-slate-600 mx-1" />
        <button
          onClick={handleReset}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
          title="Tilbakestill"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
      
      {/* Zoombart og drabart kamptre */}
      <div 
        ref={containerRef}
        className="overflow-hidden pb-16 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div 
          className={`flex min-w-max p-6 pb-20 ${needsExtraSpace ? "pl-12" : ""}`}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'top left',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
        >
        {roundNumbers.map((roundNum, roundIndex) => {
          const roundMatches = rounds[roundNum].sort((a, b) => a.matchNumber - b.matchNumber)
          const isLastRound = roundIndex === totalRounds - 1
          const isFirstRound = roundIndex === 0
          const isPreliminary = isFirstRound && isFirstRoundPreliminary()
          
          // For første runde: bruk FIRST_ROUND_GAP
          // For senere runder: beregn basert på forrige rundes plassering
          
          // Tett layout for alle runder
          const baseSlotHeight = MATCH_HEIGHT + FIRST_ROUND_GAP
          
          // Finn ut hvilken "logisk" runde dette er (0 = første hovedrunde med streker)
          const hasPreliminary = isFirstRoundPreliminary()
          const logicalRoundIndex = hasPreliminary ? roundIndex - 1 : roundIndex
          
          let topPadding: number
          let slotHeight: number
          
          if (isPreliminary) {
            // Innledende runde: tett layout
            topPadding = 0
            slotHeight = baseSlotHeight
          } else if (logicalRoundIndex === 0) {
            // Første hovedrunde (8-del eller kvart): tett layout, samme som innledende
            topPadding = 0
            slotHeight = baseSlotHeight
          } else {
            // Senere runder: dobling fra første hovedrunde
            slotHeight = baseSlotHeight * Math.pow(2, logicalRoundIndex)
            
            // Beregn topPadding basert på akkumulert offset
            let accumulatedOffset = 0
            for (let i = 0; i < logicalRoundIndex; i++) {
              const prevSlot = baseSlotHeight * Math.pow(2, i)
              accumulatedOffset += prevSlot / 2
            }
            topPadding = accumulatedOffset
          }
          
          const gapBetweenMatches = slotHeight - MATCH_HEIGHT
          
          return (
            <div key={roundNum} className="flex">
              {/* Kolonne for kamper */}
              <div style={{ width: MATCH_WIDTH }}>
                {/* Runde-header */}
                <div 
                  className="text-center flex items-end justify-center"
                  style={{ height: HEADER_HEIGHT }}
                >
                  <span className={`text-xs font-bold uppercase tracking-widest ${
                    isLastRound ? "text-amber-400" : "text-slate-500"
                  }`}>
                    {roundMatches[0]?.roundName || `Runde ${roundNum}`}
                  </span>
                </div>
                
                {/* Kamper */}
                <div 
                  className="flex flex-col pt-4"
                  style={{ 
                    marginTop: topPadding,
                    gap: gapBetweenMatches
                  }}
                >
                  {roundMatches.map((match) => {
                    const home = getTeamDisplay(match, true)
                    const away = getTeamDisplay(match, false)
                    const canEdit = !readOnly && competitionStatus === "ACTIVE" && home.hasTeam && away.hasTeam
                    const isCompleted = match.status === "COMPLETED"
                    const isFinal = isLastRound && roundMatches.length === 1
                    
                    return (
                      <div
                        key={match.id}
                        className="relative"
                        style={{ height: MATCH_HEIGHT }}
                      >
                        {/* Kampnummer - over boksen */}
                        <div className="absolute -top-4 left-1 text-[10px] text-slate-500 font-mono">
                          #{match.matchNumber}
                        </div>
                        
                        {/* Kamp-boks */}
                        <div 
                          className={`
                            h-full rounded-lg border-2 overflow-hidden transition-all flex flex-col
                            ${isFinal 
                              ? "border-amber-500 bg-gradient-to-br from-amber-500/20 to-slate-800 shadow-lg shadow-amber-500/20" 
                              : isCompleted 
                                ? "border-emerald-600/50 bg-slate-800" 
                                : canEdit
                                  ? "border-blue-500/50 bg-slate-800/80 cursor-pointer hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/10"
                                  : "border-slate-600 bg-slate-800/50"
                            }
                          `}
                          onClick={() => {
                            if (canEdit) {
                              setEditingMatch(match)
                              // Hvis kampen allerede har resultat, vis eksisterende
                              setMatchScores({ 
                                home: match.homeScore ?? 0, 
                                away: match.awayScore ?? 0 
                              })
                            }
                          }}
                        >
                          {/* Finale-badge */}
                          {isFinal && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                              <div className="px-3 py-0.5 bg-amber-500 text-slate-900 text-[10px] font-bold rounded-full flex items-center gap-1 shadow-lg">
                                <Trophy className="w-3 h-3" />
                                FINALE
                              </div>
                            </div>
                          )}
                          
                          {/* Hjemmelag */}
                          <div 
                            className={`
                              flex-1 flex items-center justify-between px-3 border-b border-slate-700/50
                              ${home.isWinner ? "bg-emerald-500/15" : ""}
                            `}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {home.color && (
                                <div 
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-white/20"
                                  style={{ backgroundColor: home.color }}
                                />
                              )}
                              <span 
                                className={`text-sm truncate ${
                                  home.hasTeam 
                                    ? home.isWinner 
                                      ? "text-emerald-400 font-bold" 
                                      : "text-white font-medium" 
                                    : "text-slate-500 italic text-xs"
                                }`}
                                title={home.fullName}
                              >
                                {home.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {home.score !== null && (
                                <span className={`text-base font-bold tabular-nums ${
                                  home.isWinner ? "text-emerald-400" : "text-slate-400"
                                }`}>
                                  {home.score}
                                </span>
                              )}
                              {home.isWinner && (
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                              )}
                            </div>
                          </div>
                          
                          {/* Bortelag */}
                          <div 
                            className={`
                              flex-1 flex items-center justify-between px-3
                              ${away.isWinner ? "bg-emerald-500/15" : ""}
                            `}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {away.color && (
                                <div 
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-white/20"
                                  style={{ backgroundColor: away.color }}
                                />
                              )}
                              <span 
                                className={`text-sm truncate ${
                                  away.hasTeam 
                                    ? away.isWinner 
                                      ? "text-emerald-400 font-bold" 
                                      : "text-white font-medium" 
                                    : "text-slate-500 italic text-xs"
                                }`}
                                title={away.fullName}
                              >
                                {away.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {away.score !== null && (
                                <span className={`text-base font-bold tabular-nums ${
                                  away.isWinner ? "text-emerald-400" : "text-slate-400"
                                }`}>
                                  {away.score}
                                </span>
                              )}
                              {away.isWinner && (
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              
              {/* Connector-linjer til neste runde eller vinner-boks */}
              {!isPreliminary && (
                <svg 
                  style={{ 
                    width: CONNECTOR_WIDTH,
                    marginTop: HEADER_HEIGHT
                  }}
                  className="overflow-visible"
                >
                  {/* Tegn connectors for hvert par av kamper */}
                  {Array.from({ length: Math.ceil(roundMatches.length / 2) }).map((_, pairIdx) => {
                    const match1 = roundMatches[pairIdx * 2]
                    const match2 = roundMatches[pairIdx * 2 + 1]
                    
                    // pt-4 = 16px
                    const ptPadding = 16
                    
                    // Beregn Y for hver kamp
                    const matchIdx1 = pairIdx * 2
                    const matchIdx2 = pairIdx * 2 + 1
                    
                    const y1 = ptPadding + topPadding + matchIdx1 * slotHeight + MATCH_HEIGHT / 2
                    const y2 = match2 
                      ? ptPadding + topPadding + matchIdx2 * slotHeight + MATCH_HEIGHT / 2
                      : y1
                    
                    // Midtpunkt = der neste rundes kamp er plassert
                    const midY = (y1 + y2) / 2
                    
                    const midX = CONNECTOR_WIDTH / 2
                    const lineColor = "#475569"
                    
                    // For finale: bruk gull farge kun hvis vinner er bestemt
                    const finalHasWinner = isLastRound && match1?.winner
                    const finalLineColor = finalHasWinner ? "#f59e0b" : lineColor
                    const finalLineWidth = finalHasWinner ? 2 : 1.5
                    
                    // Ikke tegn linje ut fra finale før vinner er bestemt
                    if (isLastRound && !match1?.winner) {
                      return null
                    }
                    
                    return (
                      <g key={pairIdx}>
                        {/* Horisontal fra øvre kamp */}
                        <line
                          x1={0}
                          y1={y1}
                          x2={isLastRound ? CONNECTOR_WIDTH : midX}
                          y2={y1}
                          stroke={finalLineColor}
                          strokeWidth={finalLineWidth}
                        />
                        
                        {/* Horisontal fra nedre kamp (kun hvis ikke finale) */}
                        {match2 && !isLastRound && (
                          <line
                            x1={0}
                            y1={y2}
                            x2={midX}
                            y2={y2}
                            stroke={lineColor}
                            strokeWidth={1.5}
                          />
                        )}
                        
                        {/* Vertikal linje mellom øvre og nedre (kun hvis ikke finale) */}
                        {!isLastRound && (
                          <line
                            x1={midX}
                            y1={y1}
                            x2={midX}
                            y2={match2 ? y2 : y1}
                            stroke={lineColor}
                            strokeWidth={1.5}
                          />
                        )}
                        
                        {/* Horisontal fra midtpunkt til neste runde (kun hvis ikke finale) */}
                        {!isLastRound && (
                          <line
                            x1={midX}
                            y1={midY}
                            x2={CONNECTOR_WIDTH}
                            y2={midY}
                            stroke={lineColor}
                            strokeWidth={1.5}
                          />
                        )}
                      </g>
                    )
                  })}
                </svg>
              )}
              
              {/* Innledende kamper har ingen streker, men behold avstanden */}
              {isPreliminary && !isLastRound && (
                <div style={{ width: CONNECTOR_WIDTH }} />
              )}
            </div>
          )
        })}
        
        {/* Gull connector-linje til vinner-boks */}
        {totalRounds > 0 && (() => {
          const finalMatch = matches.find(m => 
            m.round === Math.max(...roundNumbers) && 
            m.status === "COMPLETED" &&
            m.winner
          )
          
          if (!finalMatch?.winner) return null
          
          // Beregn samme topPadding som finalen
          const baseSlotHeight = MATCH_HEIGHT + FIRST_ROUND_GAP
          const hasPreliminary = isFirstRoundPreliminary()
          const finalRoundIndex = totalRounds - 1
          const logicalFinalIndex = hasPreliminary ? finalRoundIndex - 1 : finalRoundIndex
          
          let finalTopPadding: number
          if (logicalFinalIndex <= 0) {
            finalTopPadding = 0
          } else {
            // Beregn akkumulert offset
            let accumulatedOffset = 0
            for (let i = 0; i < logicalFinalIndex; i++) {
              const prevSlot = baseSlotHeight * Math.pow(2, i)
              accumulatedOffset += prevSlot / 2
            }
            finalTopPadding = accumulatedOffset
          }
          
          const lineY = HEADER_HEIGHT + 16 + finalTopPadding + MATCH_HEIGHT / 2
          
          return (
            <>
              {/* Gull connector-linje */}
              <div 
                className="relative flex-shrink-0" 
                style={{ width: CONNECTOR_WIDTH }}
              >
                <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                  <line
                    x1={0}
                    y1={lineY}
                    x2={CONNECTOR_WIDTH}
                    y2={lineY}
                    stroke="#f59e0b"
                    strokeWidth={2}
                  />
                </svg>
              </div>
              
              {/* Vinner-boks */}
              <div className="flex flex-col" style={{ width: MATCH_WIDTH }}>
                {/* Tom header for å matche høyde */}
                <div style={{ height: HEADER_HEIGHT }} />
                
                {/* Vinner-boks på samme nivå som finalen */}
                <div 
                  className="flex flex-col pt-4"
                  style={{ marginTop: finalTopPadding }}
                >
                  <div className="relative" style={{ height: MATCH_HEIGHT }}>
                    {/* Vinner-boks */}
                    <div className="h-full rounded-lg border-2 border-amber-500 bg-gradient-to-br from-amber-500/20 to-amber-600/5 flex flex-col items-center justify-center px-3 py-2">
                      <Trophy className="w-5 h-5 text-amber-400 mb-1" />
                      <span className="text-[9px] uppercase tracking-wider text-amber-500/80 font-semibold mb-0.5">Vinner</span>
                      <p className="text-sm font-bold text-amber-400 text-center">
                        {finalMatch.winner.name}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )
        })()}
        </div>
      </div>

      {/* Modal for å registrere resultat */}
      {editingMatch && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-600 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Registrer resultat</h3>
              <button 
                onClick={() => setEditingMatch(null)}
                className="p-1 hover:bg-slate-700 rounded-lg text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-700 rounded-full">
                <span className="text-xs text-slate-400">
                  {editingMatch.roundName || `Runde ${editingMatch.round}`}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400">
                  Kamp #{editingMatch.matchNumber}
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="text-center flex-1">
                <label className="block text-sm text-slate-300 mb-2 font-medium">
                  {editingMatch.homeTeam?.name}
                </label>
                <input
                  type="number"
                  min={0}
                  value={matchScores.home}
                  onChange={(e) => setMatchScores(prev => ({ ...prev, home: parseInt(e.target.value) || 0 }))}
                  className="w-20 h-16 text-center text-3xl font-bold bg-slate-900 border-2 border-slate-600 rounded-xl text-white focus:border-blue-500 focus:ring-0 focus:outline-none"
                />
              </div>
              <div className="text-3xl text-slate-600 font-light mt-6">–</div>
              <div className="text-center flex-1">
                <label className="block text-sm text-slate-300 mb-2 font-medium">
                  {editingMatch.awayTeam?.name}
                </label>
                <input
                  type="number"
                  min={0}
                  value={matchScores.away}
                  onChange={(e) => setMatchScores(prev => ({ ...prev, away: parseInt(e.target.value) || 0 }))}
                  className="w-20 h-16 text-center text-3xl font-bold bg-slate-900 border-2 border-slate-600 rounded-xl text-white focus:border-blue-500 focus:ring-0 focus:outline-none"
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setEditingMatch(null)}
                className="flex-1 px-4 py-2.5 border border-slate-600 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={saveMatchScore}
                disabled={savingScore}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-500 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {savingScore && <Loader2 className="w-4 h-4 animate-spin" />}
                <CheckCircle className="w-4 h-4" />
                Lagre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
