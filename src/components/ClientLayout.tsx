"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Home, Calendar, Plus, ClipboardList, User, Settings } from "lucide-react"

// Device detection hook - inline
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  return isMobile
}

// Mobile Navbar - inline
function MobileNavbar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  
  const isAdmin = session?.user?.systemRole === "admin"
  const isLoggedIn = !!session?.user

  const navItems = [
    { href: "/", icon: <Home className="w-5 h-5" />, label: "Hjem", requiresAuth: false },
    { href: "/kalender", icon: <Calendar className="w-5 h-5" />, label: "Kalender", requiresAuth: true },
    { href: "/resources", icon: <Plus className="w-6 h-6" />, label: "Book", requiresAuth: false },
    { href: "/my-bookings", icon: <ClipboardList className="w-5 h-5" />, label: "Mine", requiresAuth: true },
  ]

  // Add admin or profile based on role
  if (isAdmin) {
    navItems.push({ href: "/admin", icon: <Settings className="w-5 h-5" />, label: "Admin", requiresAuth: true })
  } else {
    navItems.push({ 
      href: isLoggedIn ? "/profile" : "/login", 
      icon: <User className="w-5 h-5" />, 
      label: isLoggedIn ? "Profil" : "Logg inn",
      requiresAuth: false
    })
  }

  // Filter based on auth
  const visibleItems = navItems.filter(item => !item.requiresAuth || isLoggedIn)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
          const isBookButton = item.href === "/resources"
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isBookButton ? "relative" : isActive ? "text-teal-600" : "text-gray-500"
              }`}
            >
              {isBookButton ? (
                <>
                  <div className="absolute -top-5 flex items-center justify-center w-14 h-14 bg-teal-600 rounded-full shadow-lg text-white">
                    {item.icon}
                  </div>
                  <span className="text-xs mt-8 text-gray-500">{item.label}</span>
                </>
              ) : (
                <>
                  <div className={isActive ? "text-teal-600" : "text-gray-400"}>{item.icon}</div>
                  <span className={`text-xs mt-1 ${isActive ? "font-medium" : ""}`}>{item.label}</span>
                </>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

// Pages where we hide the mobile navbar
const HIDE_NAVBAR_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/admin"]

interface ClientLayoutProps {
  children: React.ReactNode
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const isMobile = useIsMobile()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't add mobile layout during SSR
  if (!mounted) {
    return <>{children}</>
  }

  // Desktop or hidden navbar paths - just render children
  if (!isMobile || HIDE_NAVBAR_PATHS.some(path => pathname.startsWith(path))) {
    return <>{children}</>
  }

  // Mobile view with bottom navbar
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 pb-20">
        {children}
      </main>
      <MobileNavbar />
    </div>
  )
}

