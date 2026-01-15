"use client"

import { MobileNavbar } from "./MobileNavbar"
import { MobileHeader } from "./MobileHeader"

interface MobileLayoutProps {
  children: React.ReactNode
  title?: string
  showBackButton?: boolean
  backHref?: string
  rightAction?: React.ReactNode
  hideNavbar?: boolean
  className?: string
}

export function MobileLayout({
  children,
  title,
  showBackButton = false,
  backHref,
  rightAction,
  hideNavbar = false,
  className = "",
}: MobileLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      {title && (
        <MobileHeader
          title={title}
          showBackButton={showBackButton}
          backHref={backHref}
          rightAction={rightAction}
        />
      )}

      {/* Main content - with padding for navbar */}
      <main className={`flex-1 ${!hideNavbar ? "pb-20" : ""} ${className}`}>
        {children}
      </main>

      {/* Bottom navigation */}
      {!hideNavbar && <MobileNavbar />}
    </div>
  )
}

