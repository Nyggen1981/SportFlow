"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Calendar, Plus, ClipboardList, User, Settings } from "lucide-react"
import { useSession } from "next-auth/react"

interface NavItem {
  href: string
  icon: React.ReactNode
  label: string
  requiresAuth?: boolean
  adminOnly?: boolean
}

export function MobileNavbar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  
  const isAdmin = session?.user?.systemRole === "admin"
  const isLoggedIn = !!session?.user

  const navItems: NavItem[] = [
    {
      href: "/",
      icon: <Home className="w-5 h-5" />,
      label: "Hjem",
    },
    {
      href: "/kalender",
      icon: <Calendar className="w-5 h-5" />,
      label: "Kalender",
      requiresAuth: true,
    },
    {
      href: "/resources",
      icon: <Plus className="w-6 h-6" />,
      label: "Book",
    },
    {
      href: "/my-bookings",
      icon: <ClipboardList className="w-5 h-5" />,
      label: "Mine",
      requiresAuth: true,
    },
    ...(isAdmin ? [{
      href: "/admin",
      icon: <Settings className="w-5 h-5" />,
      label: "Admin",
      adminOnly: true,
    }] : [{
      href: isLoggedIn ? "/profile" : "/login",
      icon: <User className="w-5 h-5" />,
      label: isLoggedIn ? "Profil" : "Logg inn",
    }]),
  ]

  // Filter items based on auth state
  const visibleItems = navItems.filter(item => {
    if (item.adminOnly && !isAdmin) return false
    if (item.requiresAuth && !isLoggedIn) return false
    return true
  })

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/" && pathname.startsWith(item.href))
          
          // Special styling for the center "Book" button
          const isBookButton = item.href === "/resources"
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isBookButton
                  ? "relative"
                  : isActive
                    ? "text-teal-600"
                    : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {isBookButton ? (
                <div className="absolute -top-5 flex items-center justify-center w-14 h-14 bg-teal-600 rounded-full shadow-lg text-white">
                  {item.icon}
                </div>
              ) : (
                <>
                  <div className={isActive ? "text-teal-600" : "text-gray-400"}>
                    {item.icon}
                  </div>
                  <span className={`text-xs mt-1 ${isActive ? "font-medium" : ""}`}>
                    {item.label}
                  </span>
                </>
              )}
              {isBookButton && (
                <span className="text-xs mt-8 text-gray-500">{item.label}</span>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

