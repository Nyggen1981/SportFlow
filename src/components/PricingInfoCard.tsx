"use client"

import { Sparkles } from "lucide-react"
import { FixedPricePackagesList } from "./FixedPricePackagesList"

interface PricingRule {
  model: "FREE" | "HOURLY" | "DAILY" | "FIXED_DURATION"
  forRoles?: string[]
  pricePerHour?: number | null
  pricePerDay?: number | null
  fixedPrice?: number | null
  fixedPriceDuration?: number | null
  // Legacy fields for backwards compatibility
  memberPricePerHour?: number | null
  nonMemberPricePerHour?: number | null
  memberPricePerDay?: number | null
  nonMemberPricePerDay?: number | null
  memberFixedPrice?: number | null
  nonMemberFixedPrice?: number | null
}

interface FixedPackage {
  id: string
  name: string
  description?: string | null
  durationMinutes: number
  price: number
  memberPrice?: number | null // Medlemspris for sammenligning
}

interface PartPricing {
  partId: string
  partName: string
  parentId: string | null
  rule: PricingRule | null
  fixedPackages?: FixedPackage[]
  memberRule?: PricingRule | null // Medlemsprisregel for sammenligning
}

interface CustomRole {
  id: string
  name: string
}

interface PricingInfoCardProps {
  resourceName: string
  allowWholeBooking: boolean
  relevantRule: PricingRule | null
  resourceFixedPackages: FixedPackage[]
  partsPricing: PartPricing[]
  customRoles?: CustomRole[]
  isNonMember?: boolean // Vis medlemsbesparelser for ikke-medlemmer
  memberRule?: PricingRule | null // Medlemsprisregel for sammenligning
}

// Helper: Hent pris fra regel (støtter nytt og legacy format)
function getPriceFromRule(rule: PricingRule): { hourly: number | null; daily: number | null; fixed: number | null } {
  return {
    hourly: rule.pricePerHour ?? rule.memberPricePerHour ?? rule.nonMemberPricePerHour ?? null,
    daily: rule.pricePerDay ?? rule.memberPricePerDay ?? rule.nonMemberPricePerDay ?? null,
    fixed: rule.fixedPrice ?? rule.memberFixedPrice ?? rule.nonMemberFixedPrice ?? null
  }
}

function getPricingDescription(rule: PricingRule): string {
  const prices = getPriceFromRule(rule)

  switch (rule.model) {
    case "FREE":
      return "Gratis"
    case "HOURLY":
      if (prices.hourly === null || prices.hourly === 0) {
        return "Per time"
      }
      return `${Math.round(Number(prices.hourly))} kr/time`
    case "DAILY":
      if (prices.daily === null || prices.daily === 0) {
        return "Per døgn"
      }
      return `${Math.round(Number(prices.daily))} kr/døgn`
    case "FIXED_DURATION":
      if (prices.fixed === null || prices.fixed === 0) {
        return "Fast pris"
      }
      
      const h = Math.floor((rule.fixedPriceDuration || 0) / 60)
      const m = (rule.fixedPriceDuration || 0) % 60
      const durationStr = h > 0 && m > 0 ? `${h}t ${m}m` : h > 0 ? `${h}t` : `${m}m`
      
      return `${Math.round(Number(prices.fixed))} kr/${durationStr}`
    default:
      return "Ukjent"
  }
}

// Beregn besparelser mellom ikke-medlemspris og medlemspris
function calculateSavings(userRule: PricingRule, memberRule: PricingRule | null): { savings: number; memberPrice: number; suffix: string } | null {
  if (!memberRule || memberRule.model === "FREE") {
    // Hvis medlemmer får gratis, beregn besparelser
    if (memberRule?.model === "FREE") {
      const userPrices = getPriceFromRule(userRule)
      if (userRule.model === "HOURLY" && userPrices.hourly) {
        return { savings: userPrices.hourly, memberPrice: 0, suffix: "/time" }
      }
      if (userRule.model === "DAILY" && userPrices.daily) {
        return { savings: userPrices.daily, memberPrice: 0, suffix: "/døgn" }
      }
      if (userRule.model === "FIXED_DURATION" && userPrices.fixed) {
        return { savings: userPrices.fixed, memberPrice: 0, suffix: "" }
      }
    }
    return null
  }
  
  const userPrices = getPriceFromRule(userRule)
  const memberPrices = getPriceFromRule(memberRule)
  
  // Sammenlign basert på modell
  if (userRule.model === "HOURLY" && memberRule.model === "HOURLY") {
    if (userPrices.hourly && memberPrices.hourly && memberPrices.hourly < userPrices.hourly) {
      return { 
        savings: userPrices.hourly - memberPrices.hourly, 
        memberPrice: memberPrices.hourly,
        suffix: "/time"
      }
    }
  }
  
  if (userRule.model === "DAILY" && memberRule.model === "DAILY") {
    if (userPrices.daily && memberPrices.daily && memberPrices.daily < userPrices.daily) {
      return { 
        savings: userPrices.daily - memberPrices.daily, 
        memberPrice: memberPrices.daily,
        suffix: "/døgn"
      }
    }
  }
  
  if (userRule.model === "FIXED_DURATION" && memberRule.model === "FIXED_DURATION") {
    if (userPrices.fixed && memberPrices.fixed && memberPrices.fixed < userPrices.fixed) {
      return { 
        savings: userPrices.fixed - memberPrices.fixed, 
        memberPrice: memberPrices.fixed,
        suffix: ""
      }
    }
  }
  
  return null
}

// Helper function to format role names
function formatRoleNames(forRoles: string[] | undefined, customRoles: CustomRole[] = []): string | null {
  if (!forRoles || forRoles.length === 0) return null
  
  const roleNames = forRoles.map(roleId => {
    // Map system role IDs to Norwegian names
    if (roleId === "admin") return "Administrator"
    if (roleId === "member") return "Medlem"
    if (roleId === "user") return "Ikke medlem"
    
    // Check custom roles
    const customRole = customRoles.find(r => r.id === roleId)
    if (customRole) return customRole.name
    
    return roleId // Fallback
  })
  
  return roleNames.join(", ")
}

export function PricingInfoCard({
  resourceName,
  allowWholeBooking,
  relevantRule,
  resourceFixedPackages,
  partsPricing,
  customRoles = [],
  isNonMember = false,
  memberRule = null
}: PricingInfoCardProps) {
  // Sort parts pricing hierarchically
  const sortedPartsPricing = [...partsPricing].sort((a, b) => {
    if (a.parentId === null && b.parentId !== null) return -1
    if (a.parentId !== null && b.parentId === null) return 1
    if (a.parentId === b.partId) return 1
    if (b.parentId === a.partId) return -1
    return a.partName.localeCompare(b.partName, 'no')
  })

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-gray-900 mb-4">
        Prisinfo
      </h3>
      <div className="space-y-3">
        {/* Hovedfasilitet */}
        {allowWholeBooking && (relevantRule || resourceFixedPackages.length > 0) && (
          <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">Hele {resourceName}</span>
            </div>
            
            {relevantRule && (
              <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 text-xs font-bold">kr</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {getPricingDescription(relevantRule)}
                    </p>
                    {formatRoleNames(relevantRule.forRoles, customRoles) && (
                      <p className="text-xs text-blue-600">
                        Kun for: {formatRoleNames(relevantRule.forRoles, customRoles)}
                      </p>
                    )}
                  </div>
                </div>
                {/* Vis medlemsbesparelser for ikke-medlemmer */}
                {isNonMember && memberRule && (() => {
                  const savings = calculateSavings(relevantRule, memberRule)
                  if (!savings) return null
                  return (
                    <div className="mt-2 p-2 bg-green-50 rounded-lg border border-green-200 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <div className="text-xs">
                        <span className="text-green-700 font-medium">
                          Som medlem: {savings.memberPrice === 0 ? "Gratis" : `${Math.round(savings.memberPrice)} kr${savings.suffix}`}
                        </span>
                        <span className="text-green-600 ml-1">
                          (spar {Math.round(savings.savings)} kr{savings.suffix})
                        </span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
            
            {resourceFixedPackages.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-gray-500 mb-1">Fastpriser:</p>
                <FixedPricePackagesList packages={resourceFixedPackages} showMemberSavings={isNonMember} />
              </div>
            )}
          </div>
        )}
        
        {allowWholeBooking && !relevantRule && resourceFixedPackages.length === 0 && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">
              Ingen prisregel funnet for din rolle.
            </p>
          </div>
        )}
        
        {/* Deler */}
        {sortedPartsPricing.length > 0 && (
          <div className="space-y-2">
            {sortedPartsPricing.map(({ partId, partName, parentId, rule, fixedPackages, memberRule: partMemberRule }) => {
              const isChildPart = !!parentId
              
              return (
                <div 
                  key={partId} 
                  className={`p-3 rounded-lg border shadow-sm bg-gray-50 border-gray-200 ${
                    isChildPart ? 'ml-4' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${isChildPart ? 'text-gray-700' : 'text-gray-900'}`}>
                      {partName}
                    </span>
                  </div>
                  
                  {rule && (
                    <div className="mt-2 p-2 bg-white rounded-lg border border-gray-100">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-600 text-xs font-bold">kr</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">
                            {getPricingDescription(rule)}
                          </p>
                          {formatRoleNames(rule.forRoles, customRoles) && (
                            <p className="text-xs text-blue-600">
                              Kun for: {formatRoleNames(rule.forRoles, customRoles)}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Vis medlemsbesparelser for ikke-medlemmer */}
                      {isNonMember && partMemberRule && (() => {
                        const savings = calculateSavings(rule, partMemberRule)
                        if (!savings) return null
                        return (
                          <div className="mt-2 p-2 bg-green-50 rounded-lg border border-green-200 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <div className="text-xs">
                              <span className="text-green-700 font-medium">
                                Som medlem: {savings.memberPrice === 0 ? "Gratis" : `${Math.round(savings.memberPrice)} kr${savings.suffix}`}
                              </span>
                              <span className="text-green-600 ml-1">
                                (spar {Math.round(savings.savings)} kr{savings.suffix})
                              </span>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                  
                  {fixedPackages && fixedPackages.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-gray-500 mb-1">Fastpriser:</p>
                      <FixedPricePackagesList packages={fixedPackages} showMemberSavings={isNonMember} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        
        {partsPricing.length === 0 && !allowWholeBooking && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">
              Ingen prisregler funnet.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

