"use client"

import { ReactNode, useEffect, useState } from "react"

// Inline hook to avoid import issues
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

interface ResponsiveViewProps {
  mobile: ReactNode
  desktop: ReactNode
}

export function ResponsiveView({ mobile, desktop }: ResponsiveViewProps) {
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // During SSR, render desktop to prevent hydration issues
  if (!mounted) {
    return <>{desktop}</>
  }

  return <>{isMobile ? mobile : desktop}</>
}

