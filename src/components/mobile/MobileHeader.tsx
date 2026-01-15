"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Menu } from "lucide-react"
import { useState } from "react"
import { useSession, signOut } from "next-auth/react"

interface MobileHeaderProps {
  title: string
  showBackButton?: boolean
  backHref?: string
  rightAction?: React.ReactNode
}

export function MobileHeader({
  title,
  showBackButton = false,
  backHref,
  rightAction,
}: MobileHeaderProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [showMenu, setShowMenu] = useState(false)

  const handleBack = () => {
    if (backHref) {
      router.push(backHref)
    } else {
      router.back()
    }
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 safe-area-top">
        <div className="flex items-center justify-between h-14 px-4">
          {/* Left side */}
          <div className="flex items-center gap-3 flex-1">
            {showBackButton ? (
              <button
                onClick={handleBack}
                className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
            ) : (
              <div className="w-9" /> // Spacer
            )}
          </div>

          {/* Title */}
          <h1 className="text-lg font-semibold text-gray-900 truncate">
            {title}
          </h1>

          {/* Right side */}
          <div className="flex items-center justify-end gap-2 flex-1">
            {rightAction || (
              <button
                onClick={() => setShowMenu(true)}
                className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Menu overlay */}
      {showMenu && (
        <div
          className="fixed inset-0 z-50 bg-black/50"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200">
              {session?.user ? (
                <div>
                  <p className="font-medium text-gray-900">{session.user.name}</p>
                  <p className="text-sm text-gray-500">{session.user.email}</p>
                </div>
              ) : (
                <p className="text-gray-600">Ikke innlogget</p>
              )}
            </div>

            <nav className="p-2">
              <Link
                href="/kalender"
                className="block px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700"
                onClick={() => setShowMenu(false)}
              >
                Kalender
              </Link>
              <Link
                href="/resources"
                className="block px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700"
                onClick={() => setShowMenu(false)}
              >
                Fasiliteter
              </Link>
              {session?.user && (
                <>
                  <Link
                    href="/my-bookings"
                    className="block px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700"
                    onClick={() => setShowMenu(false)}
                  >
                    Mine bookinger
                  </Link>
                  <Link
                    href="/profile"
                    className="block px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700"
                    onClick={() => setShowMenu(false)}
                  >
                    Profil
                  </Link>
                  {session.user.systemRole === "admin" && (
                    <Link
                      href="/admin"
                      className="block px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700"
                      onClick={() => setShowMenu(false)}
                    >
                      Admin
                    </Link>
                  )}
                </>
              )}
            </nav>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
              {session?.user ? (
                <button
                  onClick={() => signOut()}
                  className="w-full py-3 text-center text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors"
                >
                  Logg ut
                </button>
              ) : (
                <Link
                  href="/login"
                  className="block w-full py-3 text-center text-teal-600 font-medium rounded-lg hover:bg-teal-50 transition-colors"
                  onClick={() => setShowMenu(false)}
                >
                  Logg inn
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

