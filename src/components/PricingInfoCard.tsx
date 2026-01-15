"use client"

import { useState } from "react"
import { X, Clock, Sparkles } from "lucide-react"
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
  memberPrice?: number | null
}

interface PartPricing {
  partId: string
  partName: string
  parentId: string | null
  rule: PricingRule | null
  fixedPackages?: FixedPackage[]
  memberRule?: PricingRule | null // For sammenligning av besparelser
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
  isNonMember?: boolean
  memberRule?: PricingRule | null // Medlemsprisregel for hele fasilitet
}

interface SelectedPricing {
  name: string
  rule: PricingRule
  memberRule?: PricingRule | null
}

// Hent pris fra regel
function getPriceFromRule(rule: PricingRule): { price: number | null; suffix: string } {
  switch (rule.model) {
    case "FREE":
      return { price: 0, suffix: "" }
    case "HOURLY":
      const hourly = rule.pricePerHour ?? rule.memberPricePerHour ?? rule.nonMemberPricePerHour ?? null
      return { price: hourly, suffix: "/time" }
    case "DAILY":
      const daily = rule.pricePerDay ?? rule.memberPricePerDay ?? rule.nonMemberPricePerDay ?? null
      return { price: daily, suffix: "/døgn" }
    case "FIXED_DURATION":
      const fixed = rule.fixedPrice ?? rule.memberFixedPrice ?? rule.nonMemberFixedPrice ?? null
      const h = Math.floor((rule.fixedPriceDuration || 0) / 60)
      const m = (rule.fixedPriceDuration || 0) % 60
      const durationStr = h > 0 && m > 0 ? `/${h}t ${m}m` : h > 0 ? `/${h}t` : `/${m}m`
      return { price: fixed, suffix: durationStr }
    default:
      return { price: null, suffix: "" }
  }
}

function getPricingDescription(rule: PricingRule): string {
  if (rule.model === "FREE") return "Gratis"
  const { price, suffix } = getPriceFromRule(rule)
  if (price === null || price === 0) {
    switch (rule.model) {
      case "HOURLY": return "Per time"
      case "DAILY": return "Per døgn"
      case "FIXED_DURATION": return "Fast pris"
      default: return "Ukjent"
    }
  }
  return `${Math.round(Number(price))}kr${suffix}`
}

function getModelLabel(model: string): string {
  switch (model) {
    case "FREE": return "Gratis"
    case "HOURLY": return "Timepris"
    case "DAILY": return "Døgnpris"
    case "FIXED_DURATION": return "Fast varighet"
    default: return "Pris"
  }
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
  const [selectedPricing, setSelectedPricing] = useState<SelectedPricing | null>(null)

  // Build hierarchical list with correct order and levels
  const buildHierarchy = (parts: PartPricing[]): Array<PartPricing & { level: number }> => {
    const result: Array<PartPricing & { level: number }> = []
    
    const addChildren = (parentId: string | null, level: number) => {
      const children = parts.filter(p => p.parentId === parentId)
      const sorted = [...children].sort((a, b) => a.partName.localeCompare(b.partName, 'no'))
      
      for (const child of sorted) {
        result.push({ ...child, level })
        addChildren(child.partId, level + 1)
      }
    }
    
    addChildren(null, 0)
    return result
  }
  
  const sortedPartsPricing = buildHierarchy(partsPricing)

  // Beregn besparelser
  const calculateSavings = (userRule: PricingRule, memRule: PricingRule | null): { savings: number; memberPrice: number } | null => {
    if (!memRule) return null
    
    const userPrice = getPriceFromRule(userRule)
    const memberPrice = getPriceFromRule(memRule)
    
    if (userPrice.price === null || memberPrice.price === null) return null
    if (memRule.model === "FREE") {
      return { savings: userPrice.price, memberPrice: 0 }
    }
    if (memberPrice.price < userPrice.price) {
      return { savings: userPrice.price - memberPrice.price, memberPrice: memberPrice.price }
    }
    return null
  }

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-gray-900 mb-4">
        Prisinfo
      </h3>
      <div className="space-y-3">
        {/* Hovedfasilitet */}
        {allowWholeBooking && (relevantRule || resourceFixedPackages.length > 0) && (
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            {relevantRule ? (
              <button
                onClick={() => setSelectedPricing({ name: resourceName, rule: relevantRule, memberRule })}
                className="w-full flex items-center justify-between text-sm font-medium text-gray-900 hover:text-blue-700 transition-colors cursor-pointer"
                title="Klikk for mer info"
              >
                <span>{resourceName}</span>
                <span className="text-blue-700 hover:underline">{getPricingDescription(relevantRule)}</span>
              </button>
            ) : (
              <span className="text-sm font-medium text-gray-900">{resourceName}</span>
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
            {sortedPartsPricing.map(({ partId, partName, rule, fixedPackages, memberRule: partMemberRule, level }) => {
              // Calculate indentation based on level (0=none, 1=ml-4, 2=ml-8, etc.)
              const marginLeft = level * 16 // 16px per level
              const isSubPart = level > 0
              
              return (
                <div 
                  key={partId} 
                  className="p-3 rounded-lg border bg-gray-50 border-gray-200"
                  style={{ marginLeft: `${marginLeft}px` }}
                >
                  {rule ? (
                    <button
                      onClick={() => setSelectedPricing({ name: partName, rule, memberRule: partMemberRule })}
                      className={`w-full flex items-center justify-between text-sm font-medium ${isSubPart ? 'text-gray-700' : 'text-gray-900'} hover:text-blue-700 transition-colors cursor-pointer`}
                      title="Klikk for mer info"
                    >
                      <span>{partName}</span>
                      <span className="text-blue-700 hover:underline">{getPricingDescription(rule)}</span>
                    </button>
                  ) : (
                    <span className={`text-sm font-medium ${isSubPart ? 'text-gray-700' : 'text-gray-900'}`}>
                      {partName}
                    </span>
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

      {/* Modal for prisdetaljer */}
      {selectedPricing && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedPricing(null)}
        >
          <div 
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedPricing.name}</h3>
                <p className="text-sm text-gray-500">{getModelLabel(selectedPricing.rule.model)}</p>
              </div>
              <button
                onClick={() => setSelectedPricing(null)}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-3">
              {selectedPricing.rule.model === "FREE" ? (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <Sparkles className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-xl font-bold text-green-900">Gratis</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-500">Pris</p>
                    <p className="text-xl font-bold text-blue-900">
                      {getPricingDescription(selectedPricing.rule)}
                    </p>
                  </div>
                </div>
              )}

              {/* Vis medlemsbesparelser for ikke-medlemmer */}
              {isNonMember && selectedPricing.memberRule && (() => {
                const savings = calculateSavings(selectedPricing.rule, selectedPricing.memberRule)
                if (!savings) return null
                const { suffix } = getPriceFromRule(selectedPricing.rule)
                return (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <Sparkles className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm text-green-700 font-medium">
                        Som medlem: {savings.memberPrice === 0 ? "Gratis" : `${Math.round(savings.memberPrice)}kr${suffix}`}
                      </p>
                      <p className="text-xs text-green-600">
                        Spar {Math.round(savings.savings)}kr{suffix} ved å bli medlem!
                      </p>
                    </div>
                  </div>
                )
              })()}
            </div>

            <button
              onClick={() => setSelectedPricing(null)}
              className="w-full mt-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Lukk
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
