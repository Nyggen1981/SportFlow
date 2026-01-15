"use client"

import { useSession, signOut } from "next-auth/react"
import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AlertTriangle, Key, Settings, LogOut, RefreshCw } from "lucide-react"

interface LicenseStatus {
  valid: boolean
  status: "active" | "grace" | "expired" | "suspended" | "invalid" | "error" | "loading"
  message?: string
  isLoading: boolean
}

const LicenseContext = createContext<LicenseStatus>({
  valid: true,
  status: "loading",
  isLoading: true
})

export function useLicense() {
  return useContext(LicenseContext)
}

// Paths that are ALWAYS accessible (even without license)
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/personvern",
  "/api/"
]

// Path only admin can access when license is invalid
const ADMIN_LICENSE_PATH = "/admin/settings"

interface LicenseGuardProps {
  children: ReactNode
}

export function LicenseGuard({ children }: LicenseGuardProps) {
  const { data: session, status: sessionStatus } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>({
    valid: true,
    status: "loading",
    isLoading: true
  })

  const isPublicPath = PUBLIC_PATHS.some(path => pathname?.startsWith(path))
  const isAdminSettingsPath = pathname?.startsWith(ADMIN_LICENSE_PATH)
  const isAdmin = session?.user?.role === "admin"

  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch license status function
  const fetchLicenseStatus = useCallback(() => {
    fetch("/api/license/status")
      .then(res => res.json())
      .then(data => {
        const isValid = data.status === "active" || data.status === "grace"
        setLicenseStatus({
          valid: isValid,
          status: data.status || "active",
          message: data.warningMessage,
          isLoading: false
        })
      })
      .catch(() => {
        // On network error, assume valid to not lock out users accidentally
        setLicenseStatus({ valid: true, status: "error", isLoading: false })
      })
  }, [])

  useEffect(() => {
    // Not logged in - no license check needed
    if (sessionStatus !== "authenticated") {
      setLicenseStatus({ valid: true, status: "active", isLoading: false })
      return
    }

    // Initial fetch
    fetchLicenseStatus()
    
    // No automatic polling - users can use "Sjekk på nytt" button
    // This avoids spamming the license server
  }, [sessionStatus, fetchLicenseStatus])

  // Still loading session or license - show children (will show loading states)
  if (sessionStatus === "loading" || licenseStatus.isLoading) {
    return (
      <LicenseContext.Provider value={licenseStatus}>
        {children}
      </LicenseContext.Provider>
    )
  }

  // Not logged in - show page normally
  if (sessionStatus !== "authenticated") {
    return (
      <LicenseContext.Provider value={licenseStatus}>
        {children}
      </LicenseContext.Provider>
    )
  }

  // License is valid - show everything
  if (licenseStatus.valid) {
    return (
      <LicenseContext.Provider value={licenseStatus}>
        {children}
      </LicenseContext.Provider>
    )
  }

  // === LICENSE IS INVALID ===

  // Public paths are always accessible
  if (isPublicPath) {
    return (
      <LicenseContext.Provider value={licenseStatus}>
        {children}
      </LicenseContext.Provider>
    )
  }

  // Admin on settings page - allow access
  if (isAdmin && isAdminSettingsPath) {
    return (
      <LicenseContext.Provider value={licenseStatus}>
        {children}
      </LicenseContext.Provider>
    )
  }

  // Admin on any other page - show license activation screen
  if (isAdmin) {
    return (
      <LicenseContext.Provider value={licenseStatus}>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
          <div className="max-w-lg w-full">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <Key className="w-10 h-10 text-red-400" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Lisens kreves
              </h1>
              <p className="text-slate-400">
                {licenseStatus.status === "expired" 
                  ? "Lisensen har utløpt. Kontakt leverandør for å fornye." 
                  : licenseStatus.status === "suspended"
                    ? "Lisensen er suspendert. Kontakt leverandør."
                    : "Legg inn lisensnøkkel for å aktivere appen."}
              </p>
            </div>

            {/* Card */}
            <div className="bg-white rounded-2xl shadow-2xl p-8">
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-amber-800">Appen er låst</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Brukere kan ikke logge inn eller bruke systemet før lisensen er aktivert.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => router.push("/admin/settings#license")}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                >
                  <Settings className="w-5 h-5" />
                  Gå til lisensinnstillinger
                </button>

                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logg ut
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center mt-6">
                Kontakt din Sportflow Booking-leverandør for lisensnøkkel eller fornyelse.
              </p>
            </div>
          </div>
        </div>
      </LicenseContext.Provider>
    )
  }

  // Manual refresh handler
  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    await new Promise(resolve => setTimeout(resolve, 500)) // Small delay for UX
    fetchLicenseStatus()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  // Non-admin users - completely blocked
  return (
    <LicenseContext.Provider value={licenseStatus}>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">
            Tjenesten er utilgjengelig
          </h1>
          <p className="text-slate-400 mb-8">
            {licenseStatus.status === "expired" 
              ? "Abonnementet har utløpt. Kontakt din klubb for mer informasjon."
              : "Systemet er midlertidig utilgjengelig. Kontakt din klubb."}
          </p>
          <div className="flex flex-col gap-3 items-center">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? "Sjekker..." : "Sjekk på nytt"}
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logg ut
            </button>
          </div>
          <p className="text-slate-500 text-sm mt-6">
            Trykk &quot;Sjekk på nytt&quot; når abonnementet er fornyet
          </p>
        </div>
      </div>
    </LicenseContext.Provider>
  )
}
