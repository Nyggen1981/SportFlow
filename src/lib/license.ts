// Lisensvalidering mot sentral lisensserver

export interface LicenseValidationResult {
  valid: boolean
  status: "active" | "grace" | "expired" | "suspended" | "invalid" | "error"
  organization?: string
  expiresAt?: string
  daysRemaining?: number
  licenseType?: string // "free", "trial", "standard", "premium"
  licenseTypeName?: string // ✨ NYTT: "Gratis", "Standard", "Premium", etc.
  modules?: { // ✨ NYTT: Modulbasert lisenssystem
    booking: boolean // Alltid true (unntatt inaktiv lisens)
    pricing?: boolean // Hvis aktivert
    "match-setup"?: boolean // Kampoppsett-modul
    [key: string]: boolean | undefined
  }
  pricing?: { // ✨ NYTT: Prisinformasjon
    basePrice: number
    totalMonthlyPrice: number
    moduleCount: number
  }
  limits?: {
    maxUsers: number | null
    maxResources: number | null
  }
  features?: {
    emailNotifications: boolean
    customBranding: boolean
    prioritySupport: boolean
  }
  message?: string
  graceMode?: boolean
  restrictions?: {
    readOnly: boolean
    showWarning: boolean
    canCreateBookings: boolean
    canCreateUsers: boolean
  }
}

// Cache for å unngå for mange API-kall
let cachedResult: LicenseValidationResult | null = null
let cacheTimestamp: number = 0
// I development mode: 10 sekunder cache (for raskere testing)
// I produksjon: 5 minutter cache
const CACHE_DURATION = process.env.NODE_ENV === "development" 
  ? 10 * 1000 // 10 sekunder i development
  : 5 * 60 * 1000 // 5 minutter i produksjon

// Hardkodet lisensserver URL
const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL || "https://sportflow-administration.vercel.app"

// Cache for database config
let cachedLicenseKey: string | null = null
let dbConfigTimestamp: number = 0
const DB_CONFIG_CACHE_DURATION = 60 * 1000 // 1 minutt

/**
 * Henter lisensnøkkel fra database eller env
 */
async function getLicenseKey(): Promise<string | null> {
  // Sjekk cache først
  if (cachedLicenseKey && Date.now() - dbConfigTimestamp < DB_CONFIG_CACHE_DURATION) {
    return cachedLicenseKey
  }

  // Prøv å hente fra database
  try {
    const { prisma } = await import("./prisma")
    const org = await prisma.organization.findFirst({
      select: {
        licenseKey: true
      }
    })

    if (org?.licenseKey) {
      cachedLicenseKey = org.licenseKey
      dbConfigTimestamp = Date.now()
      return cachedLicenseKey
    }
  } catch (error) {
    console.log("[License] Could not read config from database, falling back to env")
  }

  // Fallback til miljøvariabel
  return process.env.LICENSE_KEY || null
}

/**
 * Validerer lisensen mot lisensserveren
 * Cacher resultatet i 5 minutter for å redusere API-kall
 */
export async function validateLicense(forceRefresh = false): Promise<LicenseValidationResult> {
  // Hent lisensnøkkel fra database eller env
  const licenseKey = await getLicenseKey()

  // Sjekk om vi er i utviklingsmodus (kun lokalt)
  const isDevelopment = process.env.NODE_ENV === "development"
  const allowUnlicensed = process.env.ALLOW_UNLICENSED === "true"

  // Hvis ingen lisensnøkkel er konfigurert
  if (!licenseKey) {
    // Kun tillat i lokal utvikling eller hvis eksplisitt tillatt
    if (isDevelopment || allowUnlicensed) {
      console.log("[License] No license configured - running in development mode")
      return {
        valid: true,
        status: "active",
        organization: "Development Mode",
        message: "Utviklingsmodus - ingen lisensvalidering"
      }
    }

    // I produksjon uten lisens = blokkert
    console.log("[License] No license configured in production - blocking access")
    return {
      valid: false,
      status: "invalid",
      message: "Ingen lisens konfigurert. Kontakt administrator for å aktivere."
    }
  }

  // Returner cached resultat hvis det er gyldig
  if (!forceRefresh && cachedResult && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedResult
  }

  try {
    // Hent statistikk fra databasen for å sende med
    const stats = await getLicenseStats()

    const response = await fetch(`${LICENSE_SERVER_URL}/api/license/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: licenseKey,
        appVersion: process.env.npm_package_version || "1.0.19",
        stats
      }),
      // Timeout etter 10 sekunder
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      throw new Error(`License server returned ${response.status}`)
    }

    const data = await response.json()
    
    // Cache resultatet
    cachedResult = data
    cacheTimestamp = Date.now()

    console.log(`[License] Validation result: ${data.status} for ${data.organization}`)
    
    return data
  } catch (error) {
    console.error("[License] Validation error:", error)
    
    // Ved feil, bruk cached resultat hvis det finnes (grace ved nettverksfeil)
    if (cachedResult) {
      console.log("[License] Using cached result due to error")
      return cachedResult
    }

    // Hvis ingen cache og feil, returner "error" status men tillat bruk
    // Dette gir en grace period ved nettverksproblemer
    return {
      valid: true, // Tillat bruk ved feil (grace)
      status: "error",
      message: "Kunne ikke kontakte lisensserver. Prøver igjen senere.",
      graceMode: true
    }
  }
}

/**
 * Henter statistikk fra databasen for å rapportere til lisensserveren
 */
async function getLicenseStats(): Promise<{ users: number; bookings: number }> {
  try {
    // Dynamisk import for å unngå sirkulære avhengigheter
    const { prisma } = await import("./prisma")
    
    const [userCount, bookingCount] = await Promise.all([
      prisma.user.count(),
      prisma.booking.count()
    ])

    return {
      users: userCount,
      bookings: bookingCount
    }
  } catch {
    return { users: 0, bookings: 0 }
  }
}

/**
 * Sjekker om en spesifikk funksjon er tilgjengelig basert på lisensen
 */
export async function hasFeature(feature: keyof NonNullable<LicenseValidationResult["features"]>): Promise<boolean> {
  const license = await validateLicense()
  return license.features?.[feature] ?? false
}

/**
 * Sjekker om vi er innenfor brukergrensen
 */
export async function canCreateUser(): Promise<{ allowed: boolean; message?: string }> {
  const license = await validateLicense()
  
  if (!license.valid) {
    return { allowed: false, message: license.message || "Lisensen er ikke gyldig" }
  }

  if (license.restrictions?.canCreateUsers === false) {
    return { allowed: false, message: "Kan ikke opprette nye brukere i grace period" }
  }

  if (license.limits?.maxUsers) {
    const stats = await getLicenseStats()
    if (stats.users >= license.limits.maxUsers) {
      return { 
        allowed: false, 
        message: `Maksimalt antall brukere (${license.limits.maxUsers}) er nådd. Oppgrader lisensen for flere brukere.` 
      }
    }
  }

  return { allowed: true }
}

/**
 * Sjekker om vi er innenfor ressursgrensen
 */
export async function canCreateResource(): Promise<{ allowed: boolean; message?: string }> {
  const license = await validateLicense()
  
  if (!license.valid) {
    return { allowed: false, message: license.message || "Lisensen er ikke gyldig" }
  }

  if (license.limits?.maxResources) {
    try {
      const { prisma } = await import("./prisma")
      const resourceCount = await prisma.resource.count()
      
      if (resourceCount >= license.limits.maxResources) {
        return { 
          allowed: false, 
          message: `Maksimalt antall ressurser (${license.limits.maxResources}) er nådd. Oppgrader lisensen for flere.` 
        }
      }
    } catch {
      // Ved feil, tillat
    }
  }

  return { allowed: true }
}

/**
 * Tømmer cache - bruk når du vil tvinge en ny validering
 */
export function clearLicenseCache(): void {
  cachedResult = null
  cacheTimestamp = 0
  cachedLicenseKey = null
  dbConfigTimestamp = 0
}

/**
 * Henter lisensinfo for visning i UI (server-side)
 */
export async function getLicenseInfo(): Promise<{
  valid: boolean
  status: LicenseValidationResult["status"]
  organization: string
  expiresAt: string | null
  daysRemaining: number | null
  licenseType: string | null
  licenseTypeName: string | null
  modules: LicenseValidationResult["modules"]
  pricing: LicenseValidationResult["pricing"]
  showWarning: boolean
  warningMessage: string | null
  limits: LicenseValidationResult["limits"]
}> {
  const license = await validateLicense()

  let showWarning = false
  let warningMessage: string | null = null

  if (license.status === "invalid") {
    showWarning = true
    warningMessage = license.message || "Ingen gyldig lisens. Kontakt administrator for å aktivere."
  } else if (license.status === "grace") {
    showWarning = true
    warningMessage = license.message || `Lisensen har utløpt. ${license.daysRemaining} dager igjen av grace period.`
  } else if (license.status === "expired" || license.status === "suspended") {
    showWarning = true
    warningMessage = license.message || "Lisensen er ikke gyldig. Kontakt administrator."
  } else if (license.daysRemaining && license.daysRemaining <= 14) {
    showWarning = true
    warningMessage = `Lisensen utløper om ${license.daysRemaining} dager.`
  }

  return {
    valid: license.valid,
    status: license.status,
    organization: license.organization || "Ukjent",
    expiresAt: license.expiresAt || null,
    daysRemaining: license.daysRemaining ?? null,
    licenseType: license.licenseType || null,
    licenseTypeName: license.licenseTypeName || null,
    modules: license.modules,
    pricing: license.pricing,
    showWarning,
    warningMessage,
    limits: license.limits
  }
}

