"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Calendar, Plus, ClipboardList, Settings, Shield, X, LogIn, Trophy } from "lucide-react"

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
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const [competitionsEnabled, setCompetitionsEnabled] = useState(false)
  const [hasMatchSetupAccess, setHasMatchSetupAccess] = useState(false)
  const [hasPendingBookings, setHasPendingBookings] = useState(false)
  
  const isAdmin = session?.user?.systemRole === "admin"
  const isModerator = session?.user?.hasModeratorAccess ?? false
  const isLoggedIn = !!session?.user
  const canAccessAdmin = isAdmin || isModerator

  // Check if competitions module is enabled
  useEffect(() => {
    fetch("/api/match-setup/status")
      .then(res => res.json())
      .then(data => setCompetitionsEnabled(data.enabled === true))
      .catch(() => setCompetitionsEnabled(false))
  }, [])

  // Check if user has match setup access
  useEffect(() => {
    if (isLoggedIn && !isAdmin) {
      fetch("/api/match-setup/access")
        .then(res => res.json())
        .then(data => setHasMatchSetupAccess(data.hasAccess && !data.isAdmin))
        .catch(() => setHasMatchSetupAccess(false))
    }
  }, [isLoggedIn, isAdmin])

  // Fetch pending bookings status for admin/moderators
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

  const navItems: { href: string; icon: React.ReactNode; label: string; requiresAuth: boolean; slot: number; color?: string }[] = []

  // Slot 1: Konkurranser if module is enabled
  if (competitionsEnabled) {
    navItems.push({ href: "/competitions", icon: <Trophy className="w-5 h-5" />, label: "Konkurranser", requiresAuth: false, slot: 1 })
  }

  // Core navigation items - fixed slots
  navItems.push({ href: "/kalender", icon: <Calendar className="w-5 h-5" />, label: "Kalender", requiresAuth: true, slot: 2 })
  navItems.push({ href: "/resources", icon: <Plus className="w-6 h-6" />, label: "Book", requiresAuth: false, slot: 3 })
  navItems.push({ href: "/my-bookings", icon: <ClipboardList className="w-5 h-5" />, label: "Bookinger", requiresAuth: true, slot: 4 })
  
  // Slot 5: Admin (blue) / Moderator or Match Setup Manager (orange)
  if (isAdmin) {
    navItems.push({ href: "/admin", icon: <Settings className="w-5 h-5" />, label: "Admin", requiresAuth: true, slot: 5, color: "blue" })
  } else if (isModerator) {
    navItems.push({ href: "/admin/bookings", icon: <Shield className="w-5 h-5" />, label: "Moderator", requiresAuth: true, slot: 5, color: "orange" })
  } else if (hasMatchSetupAccess) {
    navItems.push({ href: "/match-admin", icon: <Trophy className="w-5 h-5" />, label: "Kampoppsett", requiresAuth: true, slot: 5, color: "orange" })
  }

  // Filter based on auth
  const visibleItems = navItems.filter(item => !item.requiresAuth || isLoggedIn)

  // Handle Book button click for non-logged-in users
  const handleBookClick = (e: React.MouseEvent) => {
    if (!isLoggedIn) {
      e.preventDefault()
      setShowLoginPrompt(true)
    }
  }

  // Render with fixed slots
  const renderSlot = (slotNum: number) => {
    const item = visibleItems.find(i => i.slot === slotNum)
    if (!item) {
      return <div key={`empty-${slotNum}`} className="flex-1" />
    }
    
    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
    const isBookButton = item.href === "/resources"
    const isAdminSlot = slotNum === 5 && (isAdmin || isModerator)
    
    // Determine colors based on item.color property
    const getIconColor = () => {
      if (item.color === "blue") return "text-blue-600"
      if (item.color === "orange") return "text-orange-500"
      return isActive ? "text-teal-600" : "text-gray-400"
    }
    
    const getLabelColor = () => {
      if (item.color === "blue") return "text-blue-600 font-medium"
      if (item.color === "orange") return "text-orange-500 font-medium"
      return isActive ? "font-medium text-teal-600" : "text-gray-500"
    }
    
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={isBookButton ? handleBookClick : undefined}
        className={`flex flex-col items-center justify-center h-full transition-colors ${
          isBookButton ? "relative" : ""
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
            <div className={`relative ${getIconColor()}`}>
              {item.icon}
              {isAdminSlot && hasPendingBookings && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
            <span className={`text-xs mt-1 text-center whitespace-pre-line leading-tight ${getLabelColor()}`}>{item.label}</span>
          </>
        )}
      </Link>
    )
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="grid grid-cols-5 h-16 px-2">
          {renderSlot(1)}
          {renderSlot(2)}
          {renderSlot(3)}
          {renderSlot(4)}
          {renderSlot(5)}
        </div>
      </nav>

      {/* Login prompt modal */}
      {showLoginPrompt && (
        <div 
          className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowLoginPrompt(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                <LogIn className="w-6 h-6 text-teal-600" />
              </div>
              <button 
                onClick={() => setShowLoginPrompt(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Logg inn for å booke
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Du må være logget inn for å kunne booke fasiliteter. Logg inn eller opprett en konto for å fortsette.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href="/login?callbackUrl=/resources"
                className="w-full py-2.5 bg-teal-600 text-white text-center rounded-lg font-medium hover:bg-teal-700 transition-colors"
                onClick={() => setShowLoginPrompt(false)}
              >
                Logg inn
              </Link>
              <Link
                href="/register?callbackUrl=/resources"
                className="w-full py-2.5 bg-gray-100 text-gray-700 text-center rounded-lg font-medium hover:bg-gray-200 transition-colors"
                onClick={() => setShowLoginPrompt(false)}
              >
                Opprett konto
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
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

