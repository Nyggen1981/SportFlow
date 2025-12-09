"use client"

import Link from "next/link"
import Image from "next/image"
import { useSession, signOut } from "next-auth/react"
import { useState } from "react"
import { 
  Calendar, 
  Home, 
  LogOut, 
  Menu, 
  Settings, 
  User, 
  X,
  Building2,
  ClipboardList
} from "lucide-react"

export function Navbar() {
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isAdmin = session?.user?.role === "admin"
  const orgName = session?.user?.organizationName || "Arena Booking"
  const orgLogo = session?.user?.organizationLogo
  const orgColor = session?.user?.organizationColor || "#2563eb"

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
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: orgColor }}
                >
                  <Calendar className="w-6 h-6 text-white" />
                </div>
              )}
              <span className="font-bold text-xl text-gray-900">
                {orgName}
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            <Link 
              href="/" 
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <Home className="w-4 h-4" />
              Hjem
            </Link>
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
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Admin
                  </Link>
                )}

                <div className="ml-4 flex items-center gap-3 pl-4 border-l border-gray-200">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{session.user?.name}</p>
                    <p className="text-xs text-gray-500">{session.user?.organizationName}</p>
                  </div>
                  <button
                    onClick={() => signOut()}
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
              href="/" 
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Home className="w-5 h-5" />
              Hjem
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
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-blue-600 hover:bg-blue-50"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Settings className="w-5 h-5" />
                    Admin
                  </Link>
                )}

                <div className="pt-3 mt-3 border-t border-gray-200">
                  <div className="px-4 py-2">
                    <p className="font-medium text-gray-900">{session.user?.name}</p>
                    <p className="text-sm text-gray-500">{session.user?.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      signOut()
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

