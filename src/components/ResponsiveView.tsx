"use client"

import { useIsMobile } from "@/hooks/useDevice"
import { ReactNode, useEffect, useState } from "react"

interface ResponsiveViewProps {
  mobile: ReactNode
  desktop: ReactNode
}

export function ResponsiveView({ mobile, desktop }: ResponsiveViewProps) {
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // During SSR and initial hydration, render desktop (prevents layout shift on desktop)
  // After mount, render based on actual screen size
  if (!mounted) {
    return <>{desktop}</>
  }

  return <>{isMobile ? mobile : desktop}</>
}

