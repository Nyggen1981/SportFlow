"use client"

import { useState, useEffect, useCallback } from "react"
import { RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react"

// Get version from package.json at build time
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0"

export function VersionChecker() {
  const [serverVersion, setServerVersion] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const checkVersion = useCallback(async () => {
    setIsChecking(true)
    try {
      const response = await fetch("/api/version", { cache: "no-store" })
      if (response.ok) {
        const data = await response.json()
        setServerVersion(data.version)
      }
    } catch (error) {
      console.error("Failed to check version:", error)
    } finally {
      setIsChecking(false)
    }
  }, [])

  useEffect(() => {
    checkVersion()
    // Check every 5 minutes
    const interval = setInterval(checkVersion, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [checkVersion])

  const handleUpdate = useCallback(() => {
    setIsUpdating(true)
    // Clear caches and force reload
    if (typeof window !== "undefined") {
      if ("caches" in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name))
        })
      }
      window.location.reload()
    }
  }, [])

  const isOutdated = serverVersion && serverVersion !== APP_VERSION

  if (isChecking) {
    return (
      <span className="text-xs text-gray-400">
        v{APP_VERSION}
      </span>
    )
  }

  if (isOutdated) {
    return (
      <button
        onClick={handleUpdate}
        disabled={isUpdating}
        className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 transition-colors"
        title={`Ny versjon tilgjengelig: ${serverVersion}`}
      >
        {isUpdating ? (
          <RefreshCw className="w-3 h-3 animate-spin" />
        ) : (
          <AlertTriangle className="w-3 h-3" />
        )}
        <span>Oppdater til v{serverVersion}</span>
      </button>
    )
  }

  return (
    <span className="flex items-center gap-1 text-xs text-gray-400" title="Appen er oppdatert">
      <CheckCircle2 className="w-3 h-3 text-green-500" />
      v{APP_VERSION}
    </span>
  )
}
