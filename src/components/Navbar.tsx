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
  ClipboardList
} from "lucide-react"

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
  const [pendingCount, setPendingCount] = useState(0)

  const isAdmin = session?.user?.role === "admin"

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

  // Fetch pending bookings count for admin
  useEffect(() => {
    if (isAdmin) {
      const fetchPendingCount = async () => {
        try {
          const response = await fetch("/api/admin/bookings/pending-count")
          if (response.ok) {
            const data = await response.json()
            setPendingCount(data.count)
          }
        } catch (error) {
          console.error("Failed to fetch pending count:", error)
        }
      }
      
      fetchPendingCount()
      // Refresh every 30 seconds
      const interval = setInterval(fetchPendingCount, 30000)
      return () => clearInterval(interval)
    }
  }, [isAdmin])

  const orgName = org?.name || session?.user?.organizationName || "Arena Booking"
  const orgColor = org?.primaryColor || session?.user?.organizationColor || "#2563eb"
  const orgLogo = org?.logo
  const orgTagline = org?.tagline || "Kalender"

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-3">
              {orgLogo ? (
                <Image
                  src={orgLogo}
                  alt={orgName}
                  width={40}
                  height={40}
                  className="rounded-lg"
                />
              ) : (
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: orgColor }}
                >
                  <Calendar className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <span className="font-bold text-gray-900 block">
                  {orgName}
                </span>
                <span className="text-xs text-gray-500">
                  {orgTagline}
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            <Link 
              href="/resources" 
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <Building2 className="w-4 h-4" />
              Fasiliteter
            </Link>
            <Link 
              href="/calendar" 
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Kalender
            </Link>

            {session ? (
              <>
                <Link 
                  href="/my-bookings" 
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <ClipboardList className="w-4 h-4" />
                  Mine bookinger
                </Link>

                {isAdmin && (
                  <Link 
                    href="/admin" 
                    className="relative flex items-center gap-2 px-4 py-2 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Admin
                    {pendingCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                        {pendingCount > 99 ? "99+" : pendingCount}
                      </span>
                    )}
                  </Link>
                )}

                <div className="ml-4 flex items-center gap-3 pl-4 border-l border-gray-200">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{session.user?.name}</p>
                    <p className="text-xs text-gray-500">{session.user?.organizationName}</p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Logg ut"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </>
            ) : (
              <Link 
                href="/login" 
                className="ml-4 btn btn-primary"
              >
                <User className="w-4 h-4" />
                Logg inn
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white animate-fadeIn">
          <div className="px-4 py-3 space-y-1">
            <Link 
              href="/resources" 
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Building2 className="w-5 h-5" />
              Fasiliteter
            </Link>
            <Link 
              href="/calendar" 
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Calendar className="w-5 h-5" />
              Kalender
            </Link>

            {session ? (
              <>
                <Link 
                  href="/my-bookings" 
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-100"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <ClipboardList className="w-5 h-5" />
                  Mine bookinger
                </Link>

                {isAdmin && (
                  <Link 
                    href="/admin" 
                    className="relative flex items-center gap-3 px-4 py-3 rounded-lg text-blue-600 hover:bg-blue-50"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Settings className="w-5 h-5" />
                    Admin
                    {pendingCount > 0 && (
                      <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full">
                        {pendingCount}
                      </span>
                    )}
                  </Link>
                )}

                <div className="pt-3 mt-3 border-t border-gray-200">
                  <div className="px-4 py-2">
                    <p className="font-medium text-gray-900">{session.user?.name}</p>
                    <p className="text-sm text-gray-500">{session.user?.email}</p>
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
              <Link 
                href="/login" 
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-blue-600 hover:bg-blue-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                <User className="w-5 h-5" />
                Logg inn
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
