"use client"

import { useState, useEffect } from "react"
import { Key, Calendar, AlertTriangle, CheckCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"

interface LicenseInfo {
  valid: boolean
  status: string
  organization?: string
  expiresAt?: string
  daysRemaining?: number | null
  licenseType?: string
  licenseTypeName?: string
  modules?: {
    booking?: boolean
    pricing?: boolean
    "match-setup"?: boolean
    [key: string]: boolean | undefined
  }
}

export function LicenseStatusCard() {
  const router = useRouter()
  const pathname = usePathname()
  const [license, setLicense] = useState<LicenseInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/license/status")
      .then(res => res.json())
      .then(data => {
        setLicense(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="card p-4 flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">Laster lisensstatus...</span>
      </div>
    )
  }

  if (!license) {
    return null
  }

  // Format date nicely
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("nb-NO", {
      day: "numeric",
      month: "long",
      year: "numeric"
    })
  }

  // Determine status color and icon
  const getStatusStyle = () => {
    if (!license.valid || license.status === "expired" || license.status === "suspended") {
      return { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: AlertTriangle }
    }
    if (license.status === "grace" || (license.daysRemaining && license.daysRemaining <= 14)) {
      return { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", icon: AlertTriangle }
    }
    return { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", icon: CheckCircle }
  }

  const style = getStatusStyle()
  const Icon = style.icon

  // Status text
  const getStatusText = () => {
    if (license.status === "invalid") return "Ikke konfigurert"
    if (license.status === "expired") return "Utløpt"
    if (license.status === "suspended") return "Suspendert"
    if (license.status === "grace") return "Grace period"
    if (license.status === "active") return "Aktiv"
    return license.status
  }

  return (
    <div className={`card p-4 ${style.bg} ${style.border} border`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg ${style.bg} flex items-center justify-center`}>
            <Key className={`w-5 h-5 ${style.text}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900">Lisens</h3>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                <Icon className="w-3 h-3" />
                {getStatusText()}
              </span>
            </div>
            
            {license.expiresAt && (
              <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>
                  {license.daysRemaining !== null && license.daysRemaining !== undefined ? (
                    license.daysRemaining > 0 ? (
                      <>Utløper {formatDate(license.expiresAt)} ({license.daysRemaining} dager)</>
                    ) : (
                      <>Utløpt {formatDate(license.expiresAt)}</>
                    )
                  ) : (
                    <>Gyldig til {formatDate(license.expiresAt)}</>
                  )}
                </span>
              </div>
            )}

            {/* Lisens-type */}
            {(license.licenseTypeName || license.licenseType) && (
              <p className="text-xs text-gray-500 mt-1">
                Type: <span className="font-medium text-gray-700">{license.licenseTypeName || (license.licenseType?.charAt(0).toUpperCase() + license.licenseType?.slice(1))}</span>
              </p>
            )}
            
            {/* Aktive moduler som badges */}
            {license.modules && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {license.modules.pricing && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                    Betalingsmodul
                  </span>
                )}
                {license.modules["match-setup"] && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                    Kampoppsett
                  </span>
                )}
                {license.modules["asset-register"] && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">
                    Anleggsregister
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <Link 
          href="/admin/settings#license"
          onClick={(e) => {
            // Hvis vi allerede er på settings-siden, scroller vi
            if (pathname === "/admin/settings") {
              e.preventDefault()
              setTimeout(() => {
                const element = document.getElementById("license")
                if (element) {
                  element.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              }, 100)
            }
          }}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Administrer
        </Link>
      </div>

      {/* Warning for expiring soon */}
      {license.valid && license.daysRemaining && license.daysRemaining <= 14 && license.daysRemaining > 0 && (
        <div className="mt-3 pt-3 border-t border-amber-200">
          <p className="text-sm text-amber-700">
            ⚠️ Lisensen utløper snart. Kontakt din Sportflow Booking-leverandør for fornyelse.
          </p>
        </div>
      )}

      {/* Error for invalid/expired */}
      {(!license.valid || license.status === "expired") && (
        <div className="mt-3 pt-3 border-t border-red-200">
          <p className="text-sm text-red-700">
            ⚠️ Lisensen er ikke gyldig. Kontakt din Sportflow Booking-leverandør.
          </p>
        </div>
      )}
    </div>
  )
}
