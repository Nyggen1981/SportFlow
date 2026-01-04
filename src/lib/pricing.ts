import { prisma } from "./prisma"
import { validateLicense } from "./license"
import { getUserRoleInfo } from "./roles"

// Cache for isPricingEnabled - reduserer database-kall dramatisk
let pricingEnabledCache: { value: boolean; timestamp: number } | null = null
const PRICING_CACHE_TTL = 30000 // 30 sekunder

export type PricingModel = "FREE" | "HOURLY" | "DAILY" | "FIXED_DURATION"

export interface PricingRule {
  forRoles: string[] // Array av role IDs: "admin", "member", "user", eller custom role IDs. Tom array = standard for alle som ikke dekkes av andre regler
  model: PricingModel
  // Enkle prisfelter - én pris per regel
  pricePerHour?: number | null
  pricePerDay?: number | null
  fixedPrice?: number | null
  fixedPriceDuration?: number | null // minutter (kun for FIXED_DURATION)
  // DEPRECATED: Legacy member/non-member fields for backwards compatibility during migration
  // These will be converted to separate rules on load
  memberPricePerHour?: number | null
  memberPricePerDay?: number | null
  memberFixedPrice?: number | null
  nonMemberPricePerHour?: number | null
  nonMemberPricePerDay?: number | null
  nonMemberFixedPrice?: number | null
}

export interface PricingConfig {
  rules: PricingRule[] // Array av pris-regler
}

/**
 * Konverterer legacy format (member/nonMember priser på samme regel) til nytt format (separate regler)
 * Dette kjøres automatisk når prisregler lastes fra databasen
 */
export function migratePricingRulesToNewFormat(rules: PricingRule[]): PricingRule[] {
  const migratedRules: PricingRule[] = []
  
  for (const rule of rules) {
    // Sjekk om regelen bruker legacy format (har member/nonMember priser)
    const hasMemberPrice = rule.memberPricePerHour != null || rule.memberPricePerDay != null || rule.memberFixedPrice != null
    const hasNonMemberPrice = rule.nonMemberPricePerHour != null || rule.nonMemberPricePerDay != null || rule.nonMemberFixedPrice != null
    const hasNewFormatPrice = rule.pricePerHour != null || rule.pricePerDay != null || rule.fixedPrice != null
    
    // Hvis regelen allerede bruker nytt format, behold den som den er
    if (hasNewFormatPrice || (!hasMemberPrice && !hasNonMemberPrice)) {
      migratedRules.push(rule)
      continue
    }
    
    // Konverter legacy format til separate regler
    // Regel for medlemmer
    if (hasMemberPrice) {
      migratedRules.push({
        forRoles: ["member"],
        model: rule.model,
        pricePerHour: rule.memberPricePerHour ?? null,
        pricePerDay: rule.memberPricePerDay ?? null,
        fixedPrice: rule.memberFixedPrice ?? null,
        fixedPriceDuration: rule.fixedPriceDuration ?? null
      })
    }
    
    // Regel for ikke-medlemmer (bruker)
    if (hasNonMemberPrice) {
      migratedRules.push({
        forRoles: ["user"],
        model: rule.model,
        pricePerHour: rule.nonMemberPricePerHour ?? null,
        pricePerDay: rule.nonMemberPricePerDay ?? null,
        fixedPrice: rule.nonMemberFixedPrice ?? null,
        fixedPriceDuration: rule.fixedPriceDuration ?? null
      })
    }
  }
  
  return migratedRules
}

export interface BookingPriceCalculation {
  price: number
  isFree: boolean
  reason?: string // Hvorfor det er gratis (f.eks. "Gratis for admin", "Gratis for Trener")
  pricingModel: PricingModel
  breakdown?: {
    basePrice: number
    hours?: number
    days?: number
    duration?: number // minutter
  }
}

/**
 * Sjekker om prislogikk er aktivert basert på lisensserver-status
 * Prislogikk er kun aktiv hvis lisensen har "pricing" modulen aktivert
 * OPTIMALISERT: Cacher resultatet i 30 sekunder for å unngå gjentatte database-kall
 */
export async function isPricingEnabled(): Promise<boolean> {
  // Sjekk cache først
  const now = Date.now()
  if (pricingEnabledCache && (now - pricingEnabledCache.timestamp) < PRICING_CACHE_TTL) {
    return pricingEnabledCache.value
  }
  
  try {
    const license = await validateLicense()
    
    // Prislogikk er aktiv hvis:
    // 1. Lisensen er gyldig (active, grace, eller error med grace)
    // 2. Lisensen har pricing-modulen aktivert
    
    if (!license.valid && license.status !== "grace" && license.status !== "error") {
      pricingEnabledCache = { value: false, timestamp: now }
      return false
    }
    
    // Sjekk om lisensen har pricing-modulen aktivert
    // Booking er alltid tilgjengelig (modules.booking), men pricing er en tilleggsmodul
    const hasPricingModule = license.modules?.pricing === true
    
    // Fallback til legacy sjekk for bakoverkompatibilitet
    // (hvis modules ikke er tilgjengelig, sjekk licenseType)
    if (license.modules === undefined) {
      const hasPricingFeature = 
        license.licenseType === "premium" || 
        license.licenseType === "standard" ||
        license.licenseType === "pilot" ||
        license.features?.emailNotifications === true
      pricingEnabledCache = { value: hasPricingFeature, timestamp: now }
      return hasPricingFeature
    }
    
    pricingEnabledCache = { value: hasPricingModule, timestamp: now }
    return hasPricingModule
  } catch (error) {
    console.error("[Pricing] Error checking license:", error)
    // Ved feil, returner false for å være på den sikre siden
    pricingEnabledCache = { value: false, timestamp: now }
    return false
  }
}

/**
 * Sjekker om en ressursdel har prisregler konfigurert
 * Returnerer true hvis del har prisregler, false ellers
 */
export async function hasPricingRules(
  resourceId: string,
  resourcePartId: string
): Promise<boolean> {
  // Sjekk først om det finnes fastprispakker for denne delen
  const fixedPackagesCount = await prisma.fixedPricePackage.count({
    where: { 
      resourcePartId: resourcePartId,
      isActive: true
    }
  })
  
  if (fixedPackagesCount > 0) {
    return true
  }
  
  const config = await getPricingConfig(resourceId, resourcePartId)
  if (!config || config.rules.length === 0) {
    return false
  }
  
  // Sjekk om det faktisk er noen pris satt (ikke bare FREE modell uten faktiske priser)
  // En regel teller som "har prisregler" hvis:
  // 1. Den har en pris satt (pricePerHour, pricePerDay, eller fixedPrice)
  // 2. ELLER den har legacy member/nonMember priser satt (for bakoverkompatibilitet)
  // 3. ELLER den har freeForRoles satt (gratis for spesifikke roller)
  const hasActualPricing = config.rules.some(rule => {
    // Hvis modellen er FREE og det ikke er noen spesifikke roller, teller det ikke som "har prisregler"
    if (rule.model === "FREE" && rule.forRoles.length === 0) {
      return false
    }
    
    // Sjekk om det er noen faktiske priser satt (nytt format)
    const hasNewPrice = 
      (rule.pricePerHour !== null && rule.pricePerHour !== undefined) ||
      (rule.pricePerDay !== null && rule.pricePerDay !== undefined) ||
      (rule.fixedPrice !== null && rule.fixedPrice !== undefined)
    
    // Sjekk legacy format for bakoverkompatibilitet
    const hasLegacyPrice = 
      (rule.memberPricePerHour !== null && rule.memberPricePerHour !== undefined) ||
      (rule.memberPricePerDay !== null && rule.memberPricePerDay !== undefined) ||
      (rule.memberFixedPrice !== null && rule.memberFixedPrice !== undefined) ||
      (rule.nonMemberPricePerHour !== null && rule.nonMemberPricePerHour !== undefined) ||
      (rule.nonMemberPricePerDay !== null && rule.nonMemberPricePerDay !== undefined) ||
      (rule.nonMemberFixedPrice !== null && rule.nonMemberFixedPrice !== undefined)
    
    // Hvis det er gratis for spesifikke roller, teller det som "har prisregler"
    if (rule.model === "FREE" && rule.forRoles.length > 0) {
      return true
    }
    
    return hasNewPrice || hasLegacyPrice
  })
  
  return hasActualPricing
}

/**
 * OPTIMALISERT: Sjekker prisregler for flere deler på én gang
 * Reduserer N+1 spørringer til 2 spørringer (en for pakker, en for deler)
 */
export async function hasPricingRulesForParts(
  resourceId: string,
  partIds: string[]
): Promise<Set<string>> {
  if (partIds.length === 0) return new Set()
  
  const pricingEnabled = await isPricingEnabled()
  if (!pricingEnabled) return new Set()
  
  // Hent alle fastprispakker for alle deler i én spørring
  const packagesWithParts = await prisma.fixedPricePackage.groupBy({
    by: ['resourcePartId'],
    where: {
      resourcePartId: { in: partIds },
      isActive: true
    }
  })
  
  const partsWithPackages = new Set(packagesWithParts.map(p => p.resourcePartId).filter(Boolean) as string[])
  
  // Hent alle deler med prisregler i én spørring
  const partsWithRules = await prisma.resourcePart.findMany({
    where: {
      id: { in: partIds },
      OR: [
        { pricingRules: { not: null } },
        { pricingModel: { not: null } }
      ]
    },
    select: { id: true, pricingRules: true, pricingModel: true }
  })
  
  const result = new Set<string>()
  
  // Legg til deler med fastprispakker
  partsWithPackages.forEach(id => result.add(id))
  
  // Legg til deler med prisregler
  for (const part of partsWithRules) {
    if (part.pricingRules) {
      try {
        const rules = JSON.parse(part.pricingRules as string)
        if (Array.isArray(rules) && rules.length > 0) {
          // Sjekk om det er faktiske prisregler (ikke bare tomme)
          const hasActualRules = rules.some((rule: PricingRule) => {
            if (rule.model === "FREE" && (!rule.forRoles || rule.forRoles.length === 0)) {
              return false
            }
            return true
          })
          if (hasActualRules) {
            result.add(part.id)
          }
        }
      } catch {
        // Ignorer parse-feil
      }
    } else if (part.pricingModel) {
      result.add(part.id)
    }
  }
  
  return result
}

/**
 * Henter pris-konfigurasjon for en ressurs eller ressursdel
 * Støtter flere pris-regler per ressurs (én per rolle)
 */
export async function getPricingConfig(
  resourceId: string,
  resourcePartId?: string | null
): Promise<PricingConfig | null> {
  // Sjekk om prising er aktivert
  const pricingEnabled = await isPricingEnabled()
  if (!pricingEnabled) {
    return null // Prislogikk er ikke aktivert
  }

  try {
    if (resourcePartId) {
      // Hent pris fra ressursdel (overstyrer ressurs hvis satt)
      const part = await prisma.resourcePart.findUnique({
        where: { id: resourcePartId },
        select: {
          pricingRules: true,
          // Legacy fields for bakoverkompatibilitet
          pricingModel: true,
          pricePerHour: true,
          pricePerDay: true,
          fixedPrice: true,
          fixedPriceDuration: true,
          freeForRoles: true,
          resource: {
            select: {
              pricingRules: true,
              // Legacy fields
              pricingModel: true,
              pricePerHour: true,
              pricePerDay: true,
              fixedPrice: true,
              fixedPriceDuration: true,
              freeForRoles: true
            }
          }
        }
      })

      if (!part) return null

      // Bruk part pricingRules hvis satt, ellers fallback til resource
      const pricingRulesJson = part.pricingRules || part.resource.pricingRules
      
      if (pricingRulesJson) {
        try {
          const rules = JSON.parse(pricingRulesJson) as PricingRule[]
          return { rules }
        } catch (e) {
          console.error("[Pricing] Error parsing pricingRules:", e)
        }
      }

      // Fallback til legacy format (konverter til nytt format)
      const legacyModel = (part.pricingModel || part.resource.pricingModel || "FREE") as PricingModel
      const legacyFreeForRoles = part.freeForRoles 
        ? JSON.parse(part.freeForRoles) 
        : (part.resource.freeForRoles ? JSON.parse(part.resource.freeForRoles) : [])
      
      const rules: PricingRule[] = []
      
      // Hvis det er roller med gratis tilgang, legg til regel for dem
      if (legacyFreeForRoles.length > 0) {
        rules.push({
          forRoles: legacyFreeForRoles,
          model: "FREE"
        })
      }
      
      // Legg til standard regel for alle andre
      rules.push({
        forRoles: [], // Tom array = standard for alle andre
        model: legacyModel,
        pricePerHour: part.pricePerHour ? Number(part.pricePerHour) : (part.resource.pricePerHour ? Number(part.resource.pricePerHour) : null),
        pricePerDay: part.pricePerDay ? Number(part.pricePerDay) : (part.resource.pricePerDay ? Number(part.resource.pricePerDay) : null),
        fixedPrice: part.fixedPrice ? Number(part.fixedPrice) : (part.resource.fixedPrice ? Number(part.resource.fixedPrice) : null),
        fixedPriceDuration: part.fixedPriceDuration ?? part.resource.fixedPriceDuration ?? null
      })
      
      return { rules }
    } else {
      // Hent pris fra ressurs
      const resource = await prisma.resource.findUnique({
        where: { id: resourceId },
        select: {
          pricingRules: true,
          // Legacy fields
          pricingModel: true,
          pricePerHour: true,
          pricePerDay: true,
          fixedPrice: true,
          fixedPriceDuration: true,
          freeForRoles: true
        }
      })

      if (!resource) return null

      // Bruk pricingRules hvis satt
      if (resource.pricingRules) {
        try {
          const rules = JSON.parse(resource.pricingRules) as PricingRule[]
          return { rules }
        } catch (e) {
          console.error("[Pricing] Error parsing pricingRules:", e)
        }
      }

      // Fallback til legacy format (konverter til nytt format)
      const legacyModel = (resource.pricingModel || "FREE") as PricingModel
      const legacyFreeForRoles = resource.freeForRoles ? JSON.parse(resource.freeForRoles) : []
      
      const rules: PricingRule[] = []
      
      // Hvis det er roller med gratis tilgang, legg til regel for dem
      if (legacyFreeForRoles.length > 0) {
        rules.push({
          forRoles: legacyFreeForRoles,
          model: "FREE"
        })
      }
      
      // Legg til standard regel for alle andre
      rules.push({
        forRoles: [], // Tom array = standard for alle andre
        model: legacyModel,
        pricePerHour: resource.pricePerHour ? Number(resource.pricePerHour) : null,
        pricePerDay: resource.pricePerDay ? Number(resource.pricePerDay) : null,
        fixedPrice: resource.fixedPrice ? Number(resource.fixedPrice) : null,
        fixedPriceDuration: resource.fixedPriceDuration ?? null
      })
      
      return { rules }
    }
  } catch (error) {
    console.error("[Pricing] Error getting pricing config:", error)
    return null
  }
}

// Cache for user role info for å unngå gjentatte database-kall
const userRoleCache = new Map<string, { roleInfo: any; isMember: boolean; timestamp: number }>()
const USER_ROLE_CACHE_TTL = 10000 // 10 sekunder

/**
 * OPTIMALISERT: Henter brukerinfo med caching for å unngå gjentatte database-kall
 */
async function getCachedUserInfo(userId: string): Promise<{ roleInfo: any; isMember: boolean }> {
  const now = Date.now()
  const cached = userRoleCache.get(userId)
  
  if (cached && (now - cached.timestamp) < USER_ROLE_CACHE_TTL) {
    return { roleInfo: cached.roleInfo, isMember: cached.isMember }
  }
  
  // Hent data parallelt
  const [roleInfo, user] = await Promise.all([
    getUserRoleInfo(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { isMember: true }
    })
  ])
  
  const isMember = user?.isMember ?? false
  
  // Cache resultatet
  userRoleCache.set(userId, { roleInfo, isMember, timestamp: now })
  
  // Rens gammel cache (maks 100 entries)
  if (userRoleCache.size > 100) {
    const oldestKey = userRoleCache.keys().next().value
    if (oldestKey) userRoleCache.delete(oldestKey)
  }
  
  return { roleInfo, isMember }
}

/**
 * Finner riktig pris-regel for en bruker basert på deres roller
 * OPTIMALISERT: Cacher brukerinfo for å unngå gjentatte database-kall
 */
export async function findPricingRuleForUser(
  userId: string,
  rules: PricingRule[]
): Promise<{ rule: PricingRule | null; reason?: string }> {
  if (rules.length === 0) {
    return { rule: null }
  }

  try {
    const { roleInfo, isMember } = await getCachedUserInfo(userId)
    
    // Først: sjekk spesifikke regler (forRoles er ikke tom)
    // Prioriter rekkefølge: admin > member > custom role > user > standard (tom forRoles)
    // "member" = verifisert medlem (isMember: true)
    // "user" = ikke-verifisert bruker (isMember: false)
    
    // 1. Sjekk om brukeren er admin og admin er i listen
    // VIKTIG: Admin skal KUN se priser der "admin" er eksplisitt valgt - ingen fallback til standardregel
    if (roleInfo.isAdmin) {
      const adminRule = rules.find(r => r.forRoles.includes("admin"))
      if (adminRule) {
        return { rule: adminRule }
      }
      // Admin har ingen spesifikk regel - ikke fall tilbake til standardregel
      return { rule: null }
    }
    
    // PRIORITET FOR VANLIGE BRUKERE:
    // 2. Custom role (f.eks. Lagleder, Trener) - sjekkes FØRST
    // 3. Verifisert medlem (isMember: true)
    // 4. Ikke-medlem ("user") - KUN hvis ingen custom role
    
    // 2. Sjekk om brukeren har en custom role som er i listen - FØRST
    if (roleInfo.customRole) {
      const customRoleRule = rules.find(r => r.forRoles.includes(roleInfo.customRole!.id))
      if (customRoleRule) {
        return { 
          rule: customRoleRule, 
          reason: customRoleRule.model === "FREE" ? `Gratis for ${roleInfo.customRole.name}` : undefined 
        }
      }
    }
    
    // 3. Sjekk om brukeren er verifisert medlem og "member" er i listen
    if (isMember) {
      const memberRule = rules.find(r => r.forRoles.includes("member"))
      if (memberRule) {
        return { 
          rule: memberRule, 
          reason: memberRule.model === "FREE" ? "Gratis for medlemmer" : undefined 
        }
      }
    }
    
    // 4. Sjekk om brukeren IKKE er verifisert medlem og "user" er i listen
    // VIKTIG: Kun hvis bruker ikke har custom role (forhindrer at Lagleder ser "ikke medlem"-priser)
    if (!roleInfo.customRole && !isMember && roleInfo.systemRole === "user") {
      const userRule = rules.find(r => r.forRoles.includes("user"))
      if (userRule) {
        return { 
          rule: userRule, 
          reason: userRule.model === "FREE" ? "Gratis for ikke-medlemmer" : undefined 
        }
      }
    }
    
    // 5. Hvis ingen spesifikk match, bruk standard-regelen (forRoles er tom)
    // Dette gjelder alle som ikke dekkes av reglene over
    const defaultRule = rules.find(r => r.forRoles.length === 0)
    if (defaultRule) {
      return { rule: defaultRule }
    }
    
    // Hvis ingen regel funnet, returner null
    return { rule: null }
  } catch (error) {
    console.error("[Pricing] Error finding pricing rule:", error)
    return { rule: null }
  }
}

/**
 * Beregner pris for en booking
 */
export async function calculateBookingPrice(
  userId: string,
  resourceId: string,
  resourcePartId: string | null,
  startTime: Date,
  endTime: Date
): Promise<BookingPriceCalculation> {
  // Sjekk om prising er aktivert
  const pricingEnabled = await isPricingEnabled()
  if (!pricingEnabled) {
    return {
      price: 0,
      isFree: true,
      reason: "Prislogikk er ikke aktivert",
      pricingModel: "FREE"
    }
  }

  const config = await getPricingConfig(resourceId, resourcePartId)
  
  if (!config || config.rules.length === 0) {
    return {
      price: 0,
      isFree: true,
      reason: "Gratis booking",
      pricingModel: "FREE"
    }
  }

  // Finn riktig pris-regel for brukeren
  const ruleMatch = await findPricingRuleForUser(userId, config.rules)
  
  if (!ruleMatch.rule) {
    return {
      price: 0,
      isFree: true,
      reason: "Gratis booking",
      pricingModel: "FREE"
    }
  }

  const rule = ruleMatch.rule

  // Hvis modellen er FREE, returner gratis
  if (rule.model === "FREE") {
    return {
      price: 0,
      isFree: true,
      reason: ruleMatch.reason || "Gratis booking",
      pricingModel: "FREE"
    }
  }

  // Beregn varighet
  const durationMs = endTime.getTime() - startTime.getTime()
  const durationMinutes = Math.ceil(durationMs / (1000 * 60))
  const durationHours = durationMinutes / 60
  const durationDays = Math.ceil(durationHours / 24)

  let price = 0
  let breakdown: BookingPriceCalculation["breakdown"] | undefined

  // Helper: hent pris fra regel (støtter både nytt og legacy format)
  const getHourlyPrice = (r: PricingRule): number | null => {
    // Nytt format: enkelt prisfelt
    if (r.pricePerHour != null) return r.pricePerHour
    // Legacy fallback: bruk første tilgjengelige
    return r.memberPricePerHour ?? r.nonMemberPricePerHour ?? null
  }
  
  const getDailyPrice = (r: PricingRule): number | null => {
    if (r.pricePerDay != null) return r.pricePerDay
    return r.memberPricePerDay ?? r.nonMemberPricePerDay ?? null
  }
  
  const getFixedPrice = (r: PricingRule): number | null => {
    if (r.fixedPrice != null) return r.fixedPrice
    return r.memberFixedPrice ?? r.nonMemberFixedPrice ?? null
  }

  switch (rule.model) {
    case "HOURLY":
      const hourlyPrice = getHourlyPrice(rule)
      
      if (!hourlyPrice) {
        return {
          price: 0,
          isFree: true,
          reason: "Ingen timepris satt",
          pricingModel: "HOURLY"
        }
      }
      price = hourlyPrice * durationHours
      breakdown = {
        basePrice: hourlyPrice,
        hours: durationHours
      }
      break

    case "DAILY":
      const dailyPrice = getDailyPrice(rule)
      
      if (!dailyPrice) {
        return {
          price: 0,
          isFree: true,
          reason: "Ingen døgnpris satt",
          pricingModel: "DAILY"
        }
      }
      price = dailyPrice * durationDays
      breakdown = {
        basePrice: dailyPrice,
        days: durationDays
      }
      break

    case "FIXED_DURATION":
      const fixedPriceForDuration = getFixedPrice(rule)
      
      if (!fixedPriceForDuration || !rule.fixedPriceDuration) {
        return {
          price: 0,
          isFree: true,
          reason: "Ingen fast pris eller varighet satt",
          pricingModel: "FIXED_DURATION"
        }
      }
      // Hvis varigheten matcher fixedPriceDuration, bruk fast pris
      // Ellers beregn basert på timepris hvis tilgjengelig
      if (durationMinutes <= rule.fixedPriceDuration) {
        price = fixedPriceForDuration
        breakdown = {
          basePrice: fixedPriceForDuration,
          duration: durationMinutes
        }
      } else {
        // Hvis lengre enn fast pris-varighet, beregn timepris for hele perioden
        const hourlyPriceForDuration = getHourlyPrice(rule)
        
        if (hourlyPriceForDuration) {
          price = hourlyPriceForDuration * durationHours
          breakdown = {
            basePrice: hourlyPriceForDuration,
            hours: durationHours
          }
        } else {
          price = fixedPriceForDuration
          breakdown = {
            basePrice: fixedPriceForDuration,
            duration: durationMinutes
          }
        }
      }
      break

    default:
      return {
        price: 0,
        isFree: true,
        reason: "Ukjent pris-modell",
        pricingModel: "FREE"
      }
  }

  return {
    price: Math.round(price * 100) / 100, // Rund av til 2 desimaler
    isFree: false,
    pricingModel: rule.model,
    breakdown
  }
}

/**
 * Formaterer pris for visning
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("no-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price)
}

