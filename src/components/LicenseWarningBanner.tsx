"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, X, Clock, Ban } from "lucide-react"

interface LicenseInfo {
  status: "active" | "grace" | "expired" | "suspended" | "invalid" | "error"
  organization: string
  expiresAt: string | null
  daysRemaining: number | null
  showWarning: boolean
  warningMessage: string | null
}

export function LicenseWarningBanner() {
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Sjekk om banneret allerede er dismissed i denne sesjonen
    const isDismissed = sessionStorage.getItem("license-warning-dismissed")
    if (isDismissed) {
      setDismissed(true)
    }

    // Hent lisensstatus
    fetch("/api/license/status")
      .then(res => res.json())
      .then(data => {
        setLicenseInfo(data)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    sessionStorage.setItem("license-warning-dismissed", "true")
  }

  // Ikke vis noe mens vi laster
  if (loading) return null

  // Ikke vis hvis ingen advarsel eller hvis dismissed
  if (!licenseInfo?.showWarning || dismissed) return null

  // Velg styling basert på status
  const isBlocking = licenseInfo.status === "expired" || licenseInfo.status === "suspended" || licenseInfo.status === "invalid"
  const isGrace = licenseInfo.status === "grace"

  const bgColor = isBlocking 
    ? "bg-red-600" 
    : isGrace 
      ? "bg-orange-500" 
      : "bg-yellow-500"

  const Icon = isBlocking ? Ban : isGrace ? AlertTriangle : Clock

  return (
    <div className={`${bgColor} text-white px-4 py-2`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            {licenseInfo.warningMessage}
          </p>
        </div>
        
        {!isBlocking && (
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="Lukk advarsel"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

