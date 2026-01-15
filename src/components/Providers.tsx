"use client"

import { SessionProvider } from "next-auth/react"
import { ReactNode } from "react"
import { CookieBanner } from "./CookieBanner"
import { LicenseGuard } from "./LicenseGuard"
import { ClientLayout } from "./ClientLayout"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <LicenseGuard>
        <ClientLayout>
          {children}
        </ClientLayout>
      </LicenseGuard>
      <CookieBanner />
    </SessionProvider>
  )
}

