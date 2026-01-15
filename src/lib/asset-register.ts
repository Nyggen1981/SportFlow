// Anleggsregister-modul (Asset Register)
// Hjelpefunksjoner for anleggsregister og vedlikehold

import { validateLicense } from "./license"

// Cache for ytelse
let assetRegisterEnabledCache: { value: boolean; timestamp: number } | null = null
const CACHE_TTL = 30000 // 30 sekunder

/**
 * Sjekker om Anleggsregister-modulen er aktivert for denne organisasjonen
 * Modulen styres av lisensserveren via "asset-register" feature flag
 */
export async function isAssetRegisterEnabled(): Promise<boolean> {
  // Sjekk cache først
  const now = Date.now()
  if (assetRegisterEnabledCache && (now - assetRegisterEnabledCache.timestamp) < CACHE_TTL) {
    return assetRegisterEnabledCache.value
  }

  try {
    const license = await validateLicense()
    
    // Sjekk om lisensen er gyldig
    if (!license.valid) {
      assetRegisterEnabledCache = { value: false, timestamp: now }
      return false
    }
    
    // Sjekk om asset-register-modulen er aktivert
    // Moduler returneres fra lisensserveren i license.modules
    const hasModule = license.modules?.["asset-register"] === true
    
    assetRegisterEnabledCache = { value: hasModule, timestamp: now }
    return hasModule
  } catch (error) {
    console.error("[AssetRegister] Error checking module status:", error)
    assetRegisterEnabledCache = { value: false, timestamp: now }
    return false
  }
}

