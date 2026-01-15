"use client"

import { SessionProvider } from "next-auth/react"
import { ReactNode } from "react"
import { CookieBanner } from "./CookieBanner"
import { LicenseGuard } from "./LicenseGuard"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <LicenseGuard>
        {children}
      </LicenseGuard>
      <CookieBanner />
    </SessionProvider>
  )
}

