"use client"

import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { useState } from "react"
import { 
  Calendar, 
  LogOut, 
  Menu, 
  Settings, 
  User, 
  X,
  Building2,
  ClipboardList,
  LogIn,
  UserPlus
} from "lucide-react"

export function NavLinks() {
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isAdmin = session?.user?.role === "admin"

  return (
    <>
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
                onClick={() => signOut({ callbackUrl: "/" })}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Logg ut"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </>
        ) : (
          <>
            <Link 
              href="/login" 
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Logg inn
            </Link>
            <Link 
              href="/register" 
              className="btn btn-primary"
            >
              <UserPlus className="w-4 h-4" />
              Registrer deg
            </Link>
          </>
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

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="absolute top-16 left-0 right-0 md:hidden border-t border-gray-200 bg-white shadow-lg animate-fadeIn">
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
                <Link 
                  href="/login" 
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-100"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <LogIn className="w-5 h-5" />
                  Logg inn
                </Link>
                <Link 
                  href="/register" 
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-blue-600 hover:bg-blue-50"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <UserPlus className="w-5 h-5" />
                  Registrer deg
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

