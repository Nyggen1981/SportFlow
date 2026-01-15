"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { PricingInfoCard } from "./PricingInfoCard"

interface Props {
  resourceId: string
  resourceName: string
}

export function PricingInfoCardLoader({ resourceId, resourceName }: Props) {
  const [isLoading, setIsLoading] = useState(true)
  const [pricingData, setPricingData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPricing = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/resources/${resourceId}/pricing`)
        if (response.ok) {
          const data = await response.json()
          setPricingData(data)
        } else {
          setError("Kunne ikke laste prisinfo")
        }
      } catch (err) {
        console.error("Failed to fetch pricing:", err)
        setError("Kunne ikke laste prisinfo")
      } finally {
        setIsLoading(false)
      }
    }

    fetchPricing()
  }, [resourceId])

  // Loading state
  if (isLoading) {
    return (
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Prisinfo</h3>
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-sm text-gray-500">Laster priser...</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Prisinfo</h3>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    )
  }

  // Pricing not enabled
  if (!pricingData?.enabled) {
    return null
  }

  // Hidden (visPrislogikk is false)
  if (pricingData.hidden) {
    return null
  }

  // No session (not logged in)
  if (pricingData.noSession) {
    return (
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Prisinfo</h3>
        <p className="text-sm text-gray-500">
          Logg inn for å se priser.
        </p>
      </div>
    )
  }

  // Render the actual pricing card
  return (
    <PricingInfoCard
      resourceName={resourceName}
      allowWholeBooking={pricingData.allowWholeBooking}
      relevantRule={pricingData.relevantRule}
      resourceFixedPackages={pricingData.resourceFixedPackages || []}
      partsPricing={pricingData.partsPricing || []}
      customRoles={pricingData.customRoles || []}
      isNonMember={pricingData.isNonMember}
      memberRule={pricingData.memberRule}
    />
  )
}

