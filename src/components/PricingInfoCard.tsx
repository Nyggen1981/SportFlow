"use client"

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
  isNonMember?: boolean // Vis medlemsbesparelser for ikke-medlemmer (for fastprispakker)
}

function getPricingDescription(rule: PricingRule): string {
  // Helper: få pris fra regel (støtter nytt og legacy format)
  const getHourlyPrice = (): number | null => 
    rule.pricePerHour ?? rule.memberPricePerHour ?? rule.nonMemberPricePerHour ?? null
  
  const getDailyPrice = (): number | null => 
    rule.pricePerDay ?? rule.memberPricePerDay ?? rule.nonMemberPricePerDay ?? null
  
  const getFixedPrice = (): number | null => 
    rule.fixedPrice ?? rule.memberFixedPrice ?? rule.nonMemberFixedPrice ?? null

  switch (rule.model) {
    case "FREE":
      return "Gratis"
    case "HOURLY":
      const hourlyPrice = getHourlyPrice()
      if (hourlyPrice === null || hourlyPrice === 0) {
        return "Per time"
      }
      return `${Math.round(Number(hourlyPrice))} kr/time`
    case "DAILY":
      const dailyPrice = getDailyPrice()
      if (dailyPrice === null || dailyPrice === 0) {
        return "Per døgn"
      }
      return `${Math.round(Number(dailyPrice))} kr/døgn`
    case "FIXED_DURATION":
      const fixedPrice = getFixedPrice()
      if (fixedPrice === null || fixedPrice === 0) {
        return "Fast pris"
      }
      
      const h = Math.floor((rule.fixedPriceDuration || 0) / 60)
      const m = (rule.fixedPriceDuration || 0) % 60
      const durationStr = h > 0 && m > 0 ? `${h}t ${m}m` : h > 0 ? `${h}t` : `${m}m`
      
      return `${Math.round(Number(fixedPrice))} kr/${durationStr}`
    default:
      return "Ukjent"
  }
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
  isNonMember = false
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
            {sortedPartsPricing.map(({ partId, partName, parentId, rule, fixedPackages }) => {
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

