"use client"

import Link from "next/link"
import Image from "next/image"
import { useSession, signOut } from "next-auth/react"
import { useState, useEffect } from "react"
import { 
  Calendar, 
  LogOut, 
  Menu, 
  Settings, 
  User, 
  X,
  Building2,
  ClipboardList,
  Trophy
} from "lucide-react"
import { ReportBugButton } from "./ReportBugButton"

interface Organization {
  id: string
  name: string
  logo: string | null
  tagline: string
  primaryColor: string
}

// Simple in-memory cache for organization data
let orgCache: { data: Organization | null; timestamp: number } | null = null
const ORG_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function Navbar() {
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [org, setOrg] = useState<Organization | null>(orgCache?.data || null)
  const [hasPendingBookings, setHasPendingBookings] = useState(false)
  const [hasMatchSetupAccess, setHasMatchSetupAccess] = useState(false)
  const [matchSetupEnabled, setMatchSetupEnabled] = useState(false)

  // Sjekk både systemRole og role (legacy) for bakoverkompatibilitet
  const isAdmin = session?.user?.systemRole === "admin" || session?.user?.role === "admin"
  const isModerator = session?.user?.hasModeratorAccess ?? false
  const canAccessAdmin = isAdmin || isModerator
  const isLoggedIn = !!session

  useEffect(() => {
    // Use cache if valid
    if (orgCache && Date.now() - orgCache.timestamp < ORG_CACHE_TTL) {
      setOrg(orgCache.data)
      return
    }

    fetch("/api/organization")
      .then(res => res.json())
      .then(data => {
        orgCache = { data, timestamp: Date.now() }
        setOrg(data)
      })
      .catch(() => {})
  }, [])

  // Fetch pending bookings status for admin and moderators
  useEffect(() => {
    if (canAccessAdmin) {
      const fetchPendingStatus = async () => {
        try {
          const response = await fetch("/api/admin/bookings/pending-count")
          if (response.ok) {
            const data = await response.json()
            setHasPendingBookings(data.count > 0)
          }
        } catch (error) {
          console.error("Failed to fetch pending status:", error)
        }
      }
      
      fetchPendingStatus()
      // Refresh every 30 seconds
      const interval = setInterval(fetchPendingStatus, 30000)
      return () => clearInterval(interval)
    }
  }, [canAccessAdmin])

  // Check match setup module status (for all users, including not logged in)
  useEffect(() => {
    const checkMatchSetupStatus = async () => {
      try {
        const statusRes = await fetch("/api/match-setup/status")
        if (statusRes.ok) {
          const statusData = await statusRes.json()
          setMatchSetupEnabled(statusData.enabled)
        }
      } catch (error) {
        console.error("Failed to check match setup status:", error)
      }
    }
    checkMatchSetupStatus()
  }, [])

  // Check match setup access for logged in non-admin users
  useEffect(() => {
    if (isLoggedIn && !isAdmin) {
      const checkMatchSetupAccess = async () => {
        try {
          const accessRes = await fetch("/api/match-setup/access")
          if (accessRes.ok) {
            const accessData = await accessRes.json()
            setHasMatchSetupAccess(accessData.hasAccess && !accessData.isAdmin)
          }
        } catch (error) {
          console.error("Failed to check match setup access:", error)
        }
      }
      checkMatchSetupAccess()
    }
  }, [isLoggedIn, isAdmin])

  const orgName = org?.name || session?.user?.organizationName || "Sportflow Booking"
  const orgColor = org?.primaryColor || session?.user?.organizationColor || "#2563eb"
  const orgLogo = org?.logo
  const orgTagline = org?.tagline || "Kalender"

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 md:h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 md:gap-3">
              {orgLogo ? (
                <Image
                  src={orgLogo}
                  alt={orgName}
                  width={40}
                  height={40}
                  className="rounded-lg w-8 h-8 md:w-10 md:h-10"
                />
              ) : (
                <div 
                  className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: orgColor }}
                >
                  <Calendar className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
              )}
              <div>
                <span className="font-bold text-gray-900 block text-sm md:text-base">
                  {orgName}
                </span>
                <span className="text-xs text-gray-500 hidden sm:block">
                  {orgTagline}
                </span>
              </div>
            </Link>
          </div>

          {/* Mobile Profile/Login + Logout buttons */}
          <div className="flex md:hidden items-center gap-0.5">
            {isLoggedIn ? (
              <>
                <Link
                  href="/innstillinger"
                  className="flex items-center gap-1 px-1.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Profil</span>
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                <span>Logg inn</span>
              </Link>
            )}
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {session ? (
              <>
                <Link 
                  href="/kalender" 
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  Kalender
                </Link>
                <Link 
                  href="/resources" 
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <Building2 className="w-4 h-4" />
                  Fasiliteter
                </Link>
                <Link 
                  href="/my-bookings" 
                  className="relative flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <ClipboardList className="w-4 h-4" />
                  Mine bookinger
                </Link>

                {/* Konkurranser - vises for alle roller når modulen er aktivert */}
                {matchSetupEnabled && (
                  <Link 
                    href="/competitions" 
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  >
                    <Trophy className="w-4 h-4" />
                    Konkurranser
                  </Link>
                )}

                {/* Kampoppsett admin for brukere med tilgang (ikke admin) */}
                {hasMatchSetupAccess && !canAccessAdmin && (
                  <Link 
                    href="/match-admin" 
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-orange-600 hover:text-orange-700 hover:bg-orange-50 transition-colors"
                  >
                    <Trophy className="w-4 h-4" />
                    Kampoppsett
                  </Link>
                )}

                {canAccessAdmin && (
                  <Link 
                    href="/admin" 
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      isAdmin 
                        ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50" 
                        : "text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    {isAdmin ? "Admin" : "Moderator"}
                    {hasPendingBookings && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    )}
                  </Link>
                )}

                <div className="ml-4 flex items-center gap-1 pl-4 border-l border-gray-200">
                  <Link href="/innstillinger" className="text-right hover:opacity-80 transition-opacity cursor-pointer mr-2">
                    <p className="text-sm font-medium text-gray-900">{session.user?.name}</p>
                    <p className="text-xs text-gray-500">{session.user?.organizationName}</p>
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Logg ut"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                  <ReportBugButton className="p-2 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-colors" />
                </div>
              </>
            ) : (
              <>
                {/* Kalender og Konkurranser for ikke-innloggede */}
                <Link 
                  href="/kalender" 
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  Kalender
                </Link>
                
                {matchSetupEnabled && (
                  <Link 
                    href="/competitions" 
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  >
                    <Trophy className="w-4 h-4" />
                    Konkurranser
                  </Link>
                )}
                
                <Link 
                  href="/login" 
                  className="ml-4 btn btn-primary"
                >
                  <User className="w-4 h-4" />
                  Logg inn
                </Link>
              </>
            )}
          </div>

          {/* Mobile: Navigation is handled by bottom navbar */}
        </div>
      </div>

      {/* Mobile menu - HIDDEN since we use bottom navigation bar now */}
      {false && mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white animate-fadeIn">
          <div className="px-4 py-3 space-y-1">
            {session ? (
              <>
                <Link 
                  href="/kalender" 
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-100"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Calendar className="w-5 h-5" />
                  Kalender
                </Link>
                <Link 
                  href="/resources" 
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-100"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Building2 className="w-5 h-5" />
                  Fasiliteter
                </Link>
                <Link 
                  href="/my-bookings" 
                  className="relative flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-100"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <ClipboardList className="w-5 h-5" />
                  Mine bookinger
                </Link>

                {/* Konkurranser - vises kun for vanlige brukere (ikke admins eller kampoppsett-admins) - mobil */}
                {matchSetupEnabled && !canAccessAdmin && !hasMatchSetupAccess && (
                  <Link 
                    href="/competitions" 
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-100"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Trophy className="w-5 h-5" />
                    Konkurranser
                  </Link>
                )}

                {/* Kampoppsett admin for brukere med tilgang (ikke admin) - mobil */}
                {hasMatchSetupAccess && !canAccessAdmin && (
                  <Link 
                    href="/match-admin" 
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-orange-600 hover:bg-orange-50"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Trophy className="w-5 h-5" />
                    Kampoppsett admin
                  </Link>
                )}

                {canAccessAdmin && (
                  <Link 
                    href="/admin" 
                    className={`relative flex items-center gap-3 px-4 py-3 rounded-lg ${
                      isAdmin 
                        ? "text-blue-600 hover:bg-blue-50" 
                        : "text-purple-600 hover:bg-purple-50"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Settings className="w-5 h-5" />
                    {isAdmin ? "Admin" : "Moderator"}
                    {hasPendingBookings && (
                      <span className="ml-1.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                    )}
                  </Link>
                )}

                <div className="pt-3 mt-3 border-t border-gray-200">
                  <div className="px-4 py-2">
                    <p className="font-medium text-gray-900">{session?.user?.name}</p>
                    <p className="text-sm text-gray-500">{session?.user?.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      signOut({ callbackUrl: "/" })
                      setMobileMenuOpen(false)
                    }}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-5 h-5" />
                    Logg ut
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Kalender og Konkurranser for ikke-innloggede - mobil */}
                <Link 
                  href="/kalender" 
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-100"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Calendar className="w-5 h-5" />
                  Kalender
                </Link>
                
                {matchSetupEnabled && (
                  <Link 
                    href="/competitions" 
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-100"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Trophy className="w-5 h-5" />
                    Konkurranser
                  </Link>
                )}

                <div className="pt-3 mt-3 border-t border-gray-200">
                  <Link 
                    href="/login" 
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-blue-600 hover:bg-blue-50"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <User className="w-5 h-5" />
                    Logg inn
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
