"use client"

import { useIsMobile } from "@/hooks/useDevice"
import { MobileNavbar } from "./mobile/MobileNavbar"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

interface ClientLayoutProps {
  children: React.ReactNode
}

// Pages where we should hide the mobile navbar
const HIDE_NAVBAR_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]

// Pages that are already mobile-optimized or have their own layout
const SKIP_MOBILE_LAYOUT_PATHS = [
  "/admin",
]

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

  // Check if we should hide navbar on this page
  const hideNavbar = HIDE_NAVBAR_PATHS.some(path => pathname.startsWith(path))
  const skipMobileLayout = SKIP_MOBILE_LAYOUT_PATHS.some(path => pathname.startsWith(path))

  // Desktop view - just render children
  if (!isMobile) {
    return <>{children}</>
  }

  // Mobile view with bottom navbar
  if (skipMobileLayout || hideNavbar) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 pb-16">
        {children}
      </main>
      <MobileNavbar />
    </div>
  )
}

