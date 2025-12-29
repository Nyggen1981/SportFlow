"use client"

import { FixedPricePackagesList } from "./FixedPricePackagesList"

interface PricingRule {
  model: "FREE" | "HOURLY" | "DAILY" | "FIXED_DURATION"
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
}

interface PartPricing {
  partId: string
  partName: string
  parentId: string | null
  rule: PricingRule | null
  fixedPackages?: FixedPackage[]
}

interface PricingInfoCardProps {
  resourceName: string
  allowWholeBooking: boolean
  relevantRule: PricingRule | null
  resourceFixedPackages: FixedPackage[]
  partsPricing: PartPricing[]
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

export function PricingInfoCard({
  resourceName,
  allowWholeBooking,
  relevantRule,
  resourceFixedPackages,
  partsPricing
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
              {relevantRule && (
                <span className="text-sm font-semibold text-blue-600">
                  {getPricingDescription(relevantRule)}
                </span>
              )}
            </div>
            
            {resourceFixedPackages.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-gray-500 mb-1">Fastpriser:</p>
                <FixedPricePackagesList packages={resourceFixedPackages} />
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
                  className={`p-3 rounded-lg border shadow-sm ${
                    isChildPart ? 'ml-4 bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${isChildPart ? 'text-gray-700' : 'text-gray-900'}`}>
                      {partName}
                    </span>
                    {rule && (
                      <span className="text-sm font-semibold text-blue-600">
                        {getPricingDescription(rule)}
                      </span>
                    )}
                  </div>
                  
                  {fixedPackages && fixedPackages.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-gray-500 mb-1">Fastpriser:</p>
                      <FixedPricePackagesList packages={fixedPackages} />
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

