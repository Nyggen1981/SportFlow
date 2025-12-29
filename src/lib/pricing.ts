import { prisma } from "./prisma"
import { validateLicense } from "./license"
import { getUserRoleInfo } from "./roles"

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
 */
export async function isPricingEnabled(): Promise<boolean> {
  try {
    const license = await validateLicense()
    
    // Prislogikk er aktiv hvis:
    // 1. Lisensen er gyldig (active, grace, eller error med grace)
    // 2. Lisensen har pricing-modulen aktivert
    
    if (!license.valid && license.status !== "grace" && license.status !== "error") {
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
      return hasPricingFeature
    }
    
    return hasPricingModule
  } catch (error) {
    console.error("[Pricing] Error checking license:", error)
    // Ved feil, returner false for å være på den sikre siden
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
          console.log("[Pricing] Loaded pricingRules from database:", {
            rulesCount: rules.length,
            rules: rules.map(r => ({
              forRoles: r.forRoles,
              model: r.model,
              hasMemberPrice: !!(r.memberPricePerHour || r.memberPricePerDay || r.memberFixedPrice),
              hasNonMemberPrice: !!(r.nonMemberPricePerHour || r.nonMemberPricePerDay || r.nonMemberFixedPrice),
              memberPricePerHour: r.memberPricePerHour,
              nonMemberPricePerHour: r.nonMemberPricePerHour
            }))
          })
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

/**
 * Finner riktig pris-regel for en bruker basert på deres roller
 */
export async function findPricingRuleForUser(
  userId: string,
  rules: PricingRule[]
): Promise<{ rule: PricingRule | null; reason?: string }> {
  if (rules.length === 0) {
    return { rule: null }
  }

  try {
    const roleInfo = await getUserRoleInfo(userId)
    
    // Hent brukerens medlemsstatus
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isMember: true }
    })
    const isMember = user?.isMember ?? false
    
    // Debug logging
    console.log("[Pricing] Finding rule for user:", {
      userId,
      systemRole: roleInfo.systemRole,
      isAdmin: roleInfo.isAdmin,
      isMember,
      customRole: roleInfo.customRole?.name || null,
      rulesCount: rules.length,
      rules: rules.map(r => ({ forRoles: r.forRoles, model: r.model }))
    })
    
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
    
    // 2. Sjekk om brukeren er verifisert medlem og "member" er i listen
    if (isMember) {
      const memberRule = rules.find(r => r.forRoles.includes("member"))
      if (memberRule) {
        return { 
          rule: memberRule, 
          reason: memberRule.model === "FREE" ? "Gratis for medlemmer" : undefined 
        }
      }
    }
    
    // 3. Sjekk om brukeren har en custom role som er i listen
    if (roleInfo.customRole) {
      const customRoleRule = rules.find(r => r.forRoles.includes(roleInfo.customRole!.id))
      if (customRoleRule) {
        return { 
          rule: customRoleRule, 
          reason: customRoleRule.model === "FREE" ? `Gratis for ${roleInfo.customRole.name}` : undefined 
        }
      }
    }
    
    // 4. Sjekk om brukeren IKKE er verifisert medlem og "user" er i listen
    if (!isMember && roleInfo.systemRole === "user") {
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
    console.log("[Pricing] No specific rule matched, checking default rule:", {
      defaultRuleFound: !!defaultRule,
      defaultRuleDetails: defaultRule ? { 
        model: defaultRule.model,
        forRoles: defaultRule.forRoles,
        hasMemberPrice: !!(defaultRule.memberPricePerHour || defaultRule.memberPricePerDay || defaultRule.memberFixedPrice),
        hasNonMemberPrice: !!(defaultRule.nonMemberPricePerHour || defaultRule.nonMemberPricePerDay || defaultRule.nonMemberFixedPrice),
        memberPricePerHour: defaultRule.memberPricePerHour,
        nonMemberPricePerHour: defaultRule.nonMemberPricePerHour,
        allRules: rules.map(r => ({ 
          forRoles: r.forRoles, 
          model: r.model,
          isDefault: r.forRoles.length === 0
        }))
      } : null,
      allRules: rules.map(r => ({ 
        forRoles: r.forRoles, 
        model: r.model,
        isDefault: r.forRoles.length === 0,
        forRolesString: JSON.stringify(r.forRoles)
      })),
      rulesCount: rules.length
    })
    if (defaultRule) {
      return { rule: defaultRule }
    }
    
    // Hvis ingen standardregel finnes, men det finnes regler, logg en advarsel
    if (rules.length > 0) {
      console.warn("[Pricing] No default rule found, but rules exist. User will see 'gratis'. Rules:", rules.map(r => ({
        forRoles: r.forRoles,
        forRolesString: JSON.stringify(r.forRoles),
        model: r.model,
        isDefault: r.forRoles.length === 0,
        hasMemberPrice: !!(r.memberPricePerHour || r.memberPricePerDay || r.memberFixedPrice),
        hasNonMemberPrice: !!(r.nonMemberPricePerHour || r.nonMemberPricePerDay || r.nonMemberFixedPrice)
      })))
      console.warn("[Pricing] SOLUTION: Add a rule with NO roles selected (empty forRoles array) to make it the default rule for standard users.")
    }
    
    // Hvis ingen regel funnet, returner null (gratis)
    console.log("[Pricing] No rule found for user, returning null (gratis)")
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

