// Kampoppsett-modul (Match Setup)
// Hjelpefunksjoner for turneringer og seriespill

import { validateLicense } from "./license"

/**
 * Sjekker om Kampoppsett-modulen er aktivert for denne organisasjonen
 * Modulen styres av lisensserveren via "matchSetup" feature flag
 */
export async function isMatchSetupEnabled(): Promise<boolean> {
  try {
    const license = await validateLicense()
    
    // Sjekk om lisensen er gyldig
    if (!license.valid) {
      return false
    }
    
    // Sjekk om match-setup-modulen er aktivert
    // Moduler returneres fra lisensserveren i license.modules
    // Lisensserveren bruker "match-setup" med bindestrek
    if (license.modules?.["match-setup"]) {
      return true
    }
    
    return false
  } catch (error) {
    console.error("[MatchSetup] Error checking module status:", error)
    return false
  }
}

/**
 * Genererer kampoppsett for seriespill (alle mot alle)
 * @param teamIds Array av lag-IDer
 * @param startDate Startdato for serien
 * @param matchDuration Kampvarighet i minutter
 * @param breakDuration Pause mellom kamper i minutter
 * @param matchesPerDay Maks antall kamper per dag
 * @param venues Tilgjengelige baner/arenaer
 * @returns Array av kamper med tidspunkt og lag
 */
export function generateLeagueSchedule(
  teamIds: string[],
  startDate: Date,
  matchDuration: number = 60,
  breakDuration: number = 15,
  matchesPerDay: number = 10,
  venues: string[] = ["Bane 1"]
): ScheduledMatch[] {
  const matches: ScheduledMatch[] = []
  const n = teamIds.length
  
  // Round-robin algoritme for å generere alle kamper
  // Hvis ujevnt antall lag, legg til "bye" (pause)
  const teams = [...teamIds]
  const hasBye = n % 2 !== 0
  if (hasBye) {
    teams.push("BYE")
  }
  
  const totalTeams = teams.length
  const rounds = totalTeams - 1
  const matchesPerRound = totalTeams / 2
  
  let currentDate = new Date(startDate)
  let matchNumber = 1
  let matchesScheduledToday = 0
  let currentVenueIndex = 0
  
  // Beregn første kamptidspunkt (f.eks. 09:00)
  currentDate.setHours(9, 0, 0, 0)
  
  for (let round = 0; round < rounds; round++) {
    for (let match = 0; match < matchesPerRound; match++) {
      const home = (round + match) % (totalTeams - 1)
      let away = (totalTeams - 1 - match + round) % (totalTeams - 1)
      
      // Siste lag bytter hjemme/borte annenhver runde
      if (match === 0) {
        away = totalTeams - 1
      }
      
      const homeTeam = teams[home]
      const awayTeam = teams[away]
      
      // Hopp over kamper med "BYE"
      if (homeTeam === "BYE" || awayTeam === "BYE") {
        continue
      }
      
      // Sjekk om vi trenger ny dag
      if (matchesScheduledToday >= matchesPerDay) {
        currentDate.setDate(currentDate.getDate() + 1)
        currentDate.setHours(9, 0, 0, 0)
        matchesScheduledToday = 0
        currentVenueIndex = 0
      }
      
      matches.push({
        matchNumber: matchNumber++,
        round: round + 1,
        homeTeamId: homeTeam,
        awayTeamId: awayTeam,
        scheduledTime: new Date(currentDate),
        venue: venues[currentVenueIndex % venues.length]
      })
      
      // Oppdater tidspunkt for neste kamp
      currentDate.setMinutes(currentDate.getMinutes() + matchDuration + breakDuration)
      matchesScheduledToday++
      currentVenueIndex++
    }
  }
  
  return matches
}

/**
 * Genererer kampoppsett for turnering (sluttspill)
 * Optimalisert for å håndtere ulike lagantall smart:
 * - 2-4 lag: Semifinale/Finale
 * - 5-8 lag: Kvartfinale → Semifinale → Finale
 * - 9-16 lag: Innledende runde (kun for de som må spille) → Kvartfinale → ...
 * 
 * @param teamIds Array av lag-IDer (sortert etter seeding)
 * @param startDate Startdato for turneringen
 * @param matchDuration Kampvarighet i minutter
 * @param breakDuration Pause mellom kamper i minutter
 * @param hasThirdPlace Om det skal spilles bronsefinale
 * @returns Array av kamper med tidspunkt og lag/placeholders
 */
export function generateTournamentBracket(
  teamIds: string[],
  startDate: Date,
  matchDuration: number = 60,
  breakDuration: number = 15,
  hasThirdPlace: boolean = false
): ScheduledMatch[] {
  const matches: ScheduledMatch[] = []
  const n = teamIds.length
  
  if (n < 2) return matches
  
  // Finn nærmeste potens av 2 (for bracket-størrelse)
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)))
  const totalRounds = Math.log2(bracketSize)
  
  // Beregn hvor mange lag som får fripass (bye)
  const byeCount = bracketSize - n
  
  // Sjekk om det er et "perfekt" antall lag (potens av 2: 2, 4, 8, 16, 32...)
  // I så fall er det ingen innledende runde, første runde er 8-delsfinale/kvartfinale etc.
  const isPerfectBracket = (n & (n - 1)) === 0 && n >= 2
  
  // Har innledende runde kun hvis det IKKE er perfekt antall og det er byes
  const hasPreliminary = !isPerfectBracket && byeCount > 0
  
  // Generer smart rundenavn basert på faktisk antall lag
  const roundNames = getSmartRoundNames(n, totalRounds, hasPreliminary)
  
  let currentDate = new Date(startDate)
  currentDate.setHours(10, 0, 0, 0)
  let matchNumber = 1
  
  // Seeding - standard bracket seeding
  const seeding = generateBracketSeeding(bracketSize)
  
  // Track hvilke lag som har fripass til kvartfinale/neste runde
  const byeTeams: string[] = []
  const preliminaryWinnerSlots: Map<number, number> = new Map() // slotIndex -> matchNumber
  
  // ===== FØRSTE RUNDE (Innledende runde / Play-in) =====
  // Bare lag som MÅ spille - de andre får fripass
  
  if (hasPreliminary) {
    // Det er noen innledende kamper (ikke-perfekt antall lag)
    let prelimMatchCount = 0
    
    for (let i = 0; i < bracketSize / 2; i++) {
      const homePos = seeding[i * 2]
      const awayPos = seeding[i * 2 + 1]
      
      const homeTeam = homePos <= n ? teamIds[homePos - 1] : null
      const awayTeam = awayPos <= n ? teamIds[awayPos - 1] : null
      
      if (homeTeam && awayTeam) {
        // Ekte kamp - begge lag eksisterer
        matches.push({
          matchNumber: matchNumber,
          round: 1,
          roundName: roundNames[0],
          homeTeamId: homeTeam,
          awayTeamId: awayTeam,
          scheduledTime: new Date(currentDate),
          venue: "Bane 1"
        })
        preliminaryWinnerSlots.set(i, matchNumber)
        matchNumber++
        prelimMatchCount++
        currentDate.setMinutes(currentDate.getMinutes() + matchDuration + breakDuration)
      } else if (homeTeam && !awayTeam) {
        // Home har fripass
        byeTeams.push(homeTeam)
      } else if (!homeTeam && awayTeam) {
        // Away har fripass
        byeTeams.push(awayTeam)
      }
    }
  } else {
    // Alle lag starter direkte i hovedrunden (perfekt antall: 2, 4, 8, 16...)
    for (let i = 0; i < n / 2; i++) {
      const homeTeam = teamIds[i * 2]
      const awayTeam = teamIds[i * 2 + 1]
      
      matches.push({
        matchNumber: matchNumber++,
        round: 1,
        roundName: roundNames[0],
        homeTeamId: homeTeam,
        awayTeamId: awayTeam,
        scheduledTime: new Date(currentDate),
        venue: "Bane 1"
      })
      currentDate.setMinutes(currentDate.getMinutes() + matchDuration + breakDuration)
    }
  }
  
  // ===== SENERE RUNDER =====
  const actualStartRound = hasPreliminary ? 2 : 1
  const roundsToGenerate = hasPreliminary ? totalRounds : totalRounds
  
  for (let round = 2; round <= totalRounds; round++) {
    currentDate.setDate(currentDate.getDate() + 1)
    currentDate.setHours(10, 0, 0, 0)
    
    const matchesInRound = bracketSize / Math.pow(2, round)
    const roundIndex = hasPreliminary ? round - 1 : round - 1
    const roundName = roundNames[Math.min(roundIndex, roundNames.length - 1)]
    
    // VIKTIG: Beregn baseMatchNumber FØR løkken starter!
    // Dette er første kampnummer i forrige runde
    const prevMatchesInRound = bracketSize / Math.pow(2, round - 1)
    const matchesBeforeThisRound = matches.length
    const baseMatchNumber = matchesBeforeThisRound - prevMatchesInRound + 1
    
    for (let i = 0; i < matchesInRound; i++) {
      // Finn ut hvilke lag/kamper som mater inn i denne kampen
      let homePlaceholder: string
      let awayPlaceholder: string
      let homeTeamId: string | null = null
      let awayTeamId: string | null = null
      
      if (round === 2 && hasPreliminary) {
        // Kvartfinale etter innledende runde
        // Noen posisjoner har lag med fripass, andre har vinnere fra innledende
        const slotA = i * 2
        const slotB = i * 2 + 1
        
        const homePosA = seeding[slotA * 2]
        const awayPosA = seeding[slotA * 2 + 1]
        const homePosB = seeding[slotB * 2]
        const awayPosB = seeding[slotB * 2 + 1]
        
        // Sjekk om posisjon A har fripass eller må spille
        const homeTeamA = homePosA <= n ? teamIds[homePosA - 1] : null
        const awayTeamA = awayPosA <= n ? teamIds[awayPosA - 1] : null
        const homeTeamB = homePosB <= n ? teamIds[homePosB - 1] : null
        const awayTeamB = awayPosB <= n ? teamIds[awayPosB - 1] : null
        
        // Hjemmelag i denne kampen
        if (homeTeamA && awayTeamA) {
          // Begge eksisterer - vinner fra innledende
          const matchNum = preliminaryWinnerSlots.get(slotA)
          homePlaceholder = `Vinner kamp ${matchNum}`
        } else if (homeTeamA) {
          homeTeamId = homeTeamA
          homePlaceholder = ""
        } else if (awayTeamA) {
          homeTeamId = awayTeamA
          homePlaceholder = ""
        } else {
          homePlaceholder = "TBD"
        }
        
        // Bortelag i denne kampen
        if (homeTeamB && awayTeamB) {
          const matchNum = preliminaryWinnerSlots.get(slotB)
          awayPlaceholder = `Vinner kamp ${matchNum}`
        } else if (homeTeamB) {
          awayTeamId = homeTeamB
          awayPlaceholder = ""
        } else if (awayTeamB) {
          awayTeamId = awayTeamB
          awayPlaceholder = ""
        } else {
          awayPlaceholder = "TBD"
        }
      } else {
        // Standard - vinnere fra forrige runde
        // Bruk baseMatchNumber som ble beregnet FØR løkken
        const prevMatchA = baseMatchNumber + i * 2
        const prevMatchB = baseMatchNumber + i * 2 + 1
        
        homePlaceholder = `Vinner kamp ${prevMatchA}`
        awayPlaceholder = `Vinner kamp ${prevMatchB}`
      }
      
      matches.push({
        matchNumber: matchNumber++,
        round,
        roundName,
        homeTeamId,
        awayTeamId,
        homeTeamPlaceholder: homeTeamId ? null : homePlaceholder,
        awayTeamPlaceholder: awayTeamId ? null : awayPlaceholder,
        scheduledTime: new Date(currentDate),
        venue: "Bane 1"
      })
      currentDate.setMinutes(currentDate.getMinutes() + matchDuration + breakDuration)
    }
  }
  
  // ===== BRONSEFINALE =====
  if (hasThirdPlace && totalRounds >= 2) {
    const semiFinals = matches.filter(m => m.roundName === "Semifinale")
    if (semiFinals.length === 2) {
      matches.push({
        matchNumber: matchNumber++,
        round: totalRounds,
        roundName: "Bronsefinale",
        homeTeamId: null,
        awayTeamId: null,
        homeTeamPlaceholder: `Taper kamp ${semiFinals[0].matchNumber}`,
        awayTeamPlaceholder: `Taper kamp ${semiFinals[1].matchNumber}`,
        scheduledTime: new Date(currentDate),
        venue: "Bane 1"
      })
    }
  }
  
  return matches
}

/**
 * Genererer grupperundekamper for turnering med gruppespill
 */
export function generateGroupStageSchedule(
  groups: { id: string; teamIds: string[] }[],
  startDate: Date,
  matchDuration: number = 60,
  breakDuration: number = 15,
  matchesPerDay: number = 10
): ScheduledMatch[] {
  const allMatches: ScheduledMatch[] = []
  let matchNumber = 1
  
  for (const group of groups) {
    const groupMatches = generateLeagueSchedule(
      group.teamIds,
      startDate,
      matchDuration,
      breakDuration,
      matchesPerDay
    )
    
    // Oppdater kampnummer og legg til gruppe-ID
    for (const match of groupMatches) {
      allMatches.push({
        ...match,
        matchNumber: matchNumber++,
        groupId: group.id
      })
    }
  }
  
  // Sorter alle kamper etter tid
  allMatches.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime())
  
  // Renummer etter sortering
  allMatches.forEach((match, index) => {
    match.matchNumber = index + 1
  })
  
  return allMatches
}

/**
 * Oppdaterer lagstatistikk basert på kampresultat
 */
export function calculateTeamStats(
  currentStats: TeamStats,
  goalsFor: number,
  goalsAgainst: number,
  pointsForWin: number = 3,
  pointsForDraw: number = 1,
  pointsForLoss: number = 0
): TeamStats {
  const isWin = goalsFor > goalsAgainst
  const isDraw = goalsFor === goalsAgainst
  
  return {
    played: currentStats.played + 1,
    wins: currentStats.wins + (isWin ? 1 : 0),
    draws: currentStats.draws + (isDraw ? 1 : 0),
    losses: currentStats.losses + (!isWin && !isDraw ? 1 : 0),
    goalsFor: currentStats.goalsFor + goalsFor,
    goalsAgainst: currentStats.goalsAgainst + goalsAgainst,
    goalDifference: currentStats.goalDifference + (goalsFor - goalsAgainst),
    points: currentStats.points + (isWin ? pointsForWin : isDraw ? pointsForDraw : pointsForLoss)
  }
}

/**
 * Sorterer lag etter tabellplassering
 */
export function sortTeamsByStanding(teams: TeamWithStats[]): TeamWithStats[] {
  return [...teams].sort((a, b) => {
    // 1. Poeng (høyest først)
    if (b.points !== a.points) return b.points - a.points
    // 2. Målforskjell (høyest først)
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
    // 3. Mål scoret (høyest først)
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
    // 4. Alfabetisk
    return a.name.localeCompare(b.name)
  })
}

// Hjelpefunksjoner

/**
 * Genererer smarte rundenavn basert på faktisk antall lag
 * Med 10 lag: "Innledende runde" → "Kvartfinale" → "Semifinale" → "Finale"
 * Med 8 lag: "Kvartfinale" → "Semifinale" → "Finale"
 * Med 4 lag: "Semifinale" → "Finale"
 */
function getSmartRoundNames(teamCount: number, totalRounds: number, hasPreliminary: boolean): string[] {
  const names: string[] = []
  
  // Bestem hvilke runder vi faktisk har basert på antall lag
  if (teamCount <= 2) {
    return ["Finale"]
  } else if (teamCount <= 4) {
    return ["Semifinale", "Finale"]
  } else if (teamCount <= 8) {
    return ["Kvartfinale", "Semifinale", "Finale"]
  } else if (teamCount <= 16) {
    if (hasPreliminary) {
      // Med innledende kamper (f.eks. 10 lag)
      return ["Innledende runde", "Kvartfinale", "Semifinale", "Finale"]
    } else {
      return ["Åttendedelsfinale", "Kvartfinale", "Semifinale", "Finale"]
    }
  } else if (teamCount <= 32) {
    if (hasPreliminary) {
      return ["Innledende runde", "Åttendedelsfinale", "Kvartfinale", "Semifinale", "Finale"]
    } else {
      return ["Sekstendedelsfinale", "Åttendedelsfinale", "Kvartfinale", "Semifinale", "Finale"]
    }
  }
  
  // Fallback for større turneringer
  for (let i = 1; i <= totalRounds; i++) {
    const matchesInRound = Math.pow(2, totalRounds - i)
    if (matchesInRound === 1) {
      names.push("Finale")
    } else if (matchesInRound === 2) {
      names.push("Semifinale")
    } else if (matchesInRound === 4) {
      names.push("Kvartfinale")
    } else {
      names.push(`Runde ${i}`)
    }
  }
  
  return names
}

// Beholder gammel funksjon for bakoverkompatibilitet
function getRoundNames(totalRounds: number, hasThirdPlace: boolean): string[] {
  const names: string[] = []
  
  for (let i = 1; i <= totalRounds; i++) {
    const matchesInRound = Math.pow(2, totalRounds - i)
    
    if (matchesInRound === 1) {
      names.push("Finale")
    } else if (matchesInRound === 2) {
      names.push("Semifinale")
    } else if (matchesInRound === 4) {
      names.push("Kvartfinale")
    } else if (matchesInRound === 8) {
      names.push("Åttendedelsfinale")
    } else if (matchesInRound === 16) {
      names.push("Sekstendedelsfinale")
    } else {
      names.push(`Runde ${i}`)
    }
  }
  
  return names
}

function generateBracketSeeding(bracketSize: number): number[] {
  // Standard bracket seeding
  // For 8 lag: [1,8,4,5,2,7,3,6]
  // For 16 lag: [1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11]
  
  if (bracketSize === 2) return [1, 2]
  if (bracketSize === 4) return [1, 4, 2, 3]
  if (bracketSize === 8) return [1, 8, 4, 5, 2, 7, 3, 6]
  if (bracketSize === 16) return [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]
  if (bracketSize === 32) {
    return [1, 32, 16, 17, 8, 25, 9, 24, 4, 29, 13, 20, 5, 28, 12, 21, 
            2, 31, 15, 18, 7, 26, 10, 23, 3, 30, 14, 19, 6, 27, 11, 22]
  }
  
  // Fallback for større bracket
  const seeding: number[] = []
  for (let i = 1; i <= bracketSize; i++) {
    seeding.push(i)
  }
  return seeding
}

// Typer

export interface ScheduledMatch {
  matchNumber: number
  round: number
  roundName?: string
  homeTeamId: string | null
  awayTeamId: string | null
  homeTeamPlaceholder?: string | null
  awayTeamPlaceholder?: string | null
  scheduledTime: Date
  venue?: string
  groupId?: string
  isBye?: boolean
}

export interface TeamStats {
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

export interface TeamWithStats extends TeamStats {
  id: string
  name: string
  shortName?: string
  color?: string
}

