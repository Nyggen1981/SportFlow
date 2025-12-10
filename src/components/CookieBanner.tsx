"use client"

import { useState, useEffect } from "react"
import { Cookie, X } from "lucide-react"
import Link from "next/link"

export function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Check if user has already accepted cookies
    const cookieConsent = localStorage.getItem("cookieConsent")
    if (!cookieConsent) {
      setShowBanner(true)
    }
  }, [])

  const acceptCookies = () => {
    localStorage.setItem("cookieConsent", "accepted")
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slideUp">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Cookie className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Vi bruker cookies</h3>
              <p className="text-sm text-gray-600">
                Vi bruker nødvendige cookies for å holde deg innlogget og sikre systemets funksjonalitet. 
                Ved å fortsette godtar du vår bruk av cookies.{" "}
                <Link href="/personvern" className="text-blue-600 hover:text-blue-700 underline">
                  Les mer i personvernpolicyn
                </Link>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={acceptCookies}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm whitespace-nowrap"
            >
              Godta
            </button>
            <button
              onClick={acceptCookies}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Lukk"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

