// Utlegg og refusjoner-modul (Expenses)
// Hjelpefunksjoner for dommerregninger, reiseutgifter, refusjoner osv.

import { validateLicense } from "./license"

// Cache for ytelse
let expensesEnabledCache: { value: boolean; timestamp: number } | null = null
const CACHE_TTL = 30000 // 30 sekunder

/**
 * Sjekker om Utlegg og refusjoner-modulen er aktivert for denne organisasjonen
 * Modulen styres av lisensserveren via "expenses" feature flag
 * Koster 99 kr/mnd ekstra og kan aktiveres per kunde i admin-panelet
 */
export async function isExpensesEnabled(): Promise<boolean> {
  // Sjekk cache først
  const now = Date.now()
  if (expensesEnabledCache && (now - expensesEnabledCache.timestamp) < CACHE_TTL) {
    return expensesEnabledCache.value
  }

  try {
    const license = await validateLicense()
    
    // Sjekk om lisensen er gyldig
    if (!license.valid) {
      expensesEnabledCache = { value: false, timestamp: now }
      return false
    }
    
    // Sjekk om expenses-modulen er aktivert
    // Moduler returneres fra lisensserveren i license.modules
    const hasModule = license.modules?.expenses === true
    
    expensesEnabledCache = { value: hasModule, timestamp: now }
    return hasModule
  } catch (error) {
    console.error("[Expenses] Error checking module status:", error)
    expensesEnabledCache = { value: false, timestamp: now }
    return false
  }
}

/**
 * Tømmer cache - bruk når lisensen oppdateres
 */
export function clearExpensesCache(): void {
  expensesEnabledCache = null
}
