"use client"

import { FixedPricePackagesList } from "./FixedPricePackagesList"

interface PricingRule {
  model: "FREE" | "HOURLY" | "DAILY" | "FIXED_DURATION"
  memberPricePerHour?: number | null
  nonMemberPricePerHour?: number | null
  memberPricePerDay?: number | null
  nonMemberPricePerDay?: number | null
  memberFixedPrice?: number | null
  nonMemberFixedPrice?: number | null
  fixedPriceDuration?: number | null
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
  isMember: boolean
  relevantRule: PricingRule | null
  resourceFixedPackages: FixedPackage[]
  partsPricing: PartPricing[]
}

function getPricingDescription(rule: PricingRule, isMember: boolean): string {
  switch (rule.model) {
    case "FREE":
      return "Gratis"
    case "HOURLY":
      const hourlyPrice = isMember 
        ? (rule.memberPricePerHour ?? rule.nonMemberPricePerHour)
        : (rule.nonMemberPricePerHour ?? rule.memberPricePerHour)
      
      if (hourlyPrice === null || hourlyPrice === undefined || hourlyPrice === 0) {
        return "Per time"
      }
      return `${Math.round(Number(hourlyPrice))} kr/time`
    case "DAILY":
      const dailyPrice = isMember
        ? (rule.memberPricePerDay ?? rule.nonMemberPricePerDay)
        : (rule.nonMemberPricePerDay ?? rule.memberPricePerDay)
      
      if (dailyPrice === null || dailyPrice === undefined || dailyPrice === 0) {
        return "Per døgn"
      }
      return `${Math.round(Number(dailyPrice))} kr/døgn`
    case "FIXED_DURATION":
      const fixedPrice = isMember
        ? (rule.memberFixedPrice ?? rule.nonMemberFixedPrice)
        : (rule.nonMemberFixedPrice ?? rule.memberFixedPrice)
      
      if (fixedPrice === null || fixedPrice === undefined || fixedPrice === 0) {
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
  isMember,
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
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Prisinfo
      </h2>
      <div className="space-y-5">
        {/* Hovedfasilitet */}
        {allowWholeBooking && (relevantRule || resourceFixedPackages.length > 0) && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900">{resourceName}</span>
              {relevantRule && (
                <span className="font-semibold text-blue-600">
                  {getPricingDescription(relevantRule, isMember)}
                </span>
              )}
            </div>
            
            {resourceFixedPackages.length > 0 && (
              <FixedPricePackagesList packages={resourceFixedPackages} />
            )}
          </div>
        )}
        
        {allowWholeBooking && !relevantRule && resourceFixedPackages.length === 0 && (
          <p className="text-gray-600">
            Ingen prisregel funnet for din rolle.
          </p>
        )}
        
        {/* Deler */}
        {sortedPartsPricing.length > 0 && (
          <div className="space-y-4">
            {sortedPartsPricing.map(({ partId, partName, parentId, rule, fixedPackages }) => {
              const isChildPart = !!parentId
              
              return (
                <div 
                  key={partId} 
                  className={isChildPart ? 'ml-4' : ''}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-medium ${isChildPart ? 'text-gray-700' : 'text-gray-900'}`}>
                      {partName}
                    </span>
                    {rule && (
                      <span className="font-semibold text-blue-600">
                        {getPricingDescription(rule, isMember)}
                      </span>
                    )}
                  </div>
                  
                  {fixedPackages && fixedPackages.length > 0 && (
                    <FixedPricePackagesList packages={fixedPackages} />
                  )}
                </div>
              )
            })}
          </div>
        )}
        
        {partsPricing.length === 0 && !allowWholeBooking && (
          <p className="text-gray-600">
            Ingen prisregler funnet.
          </p>
        )}
      </div>
    </div>
  )
}
