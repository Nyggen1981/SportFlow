"use client"

import { SessionProvider } from "next-auth/react"
import { ReactNode } from "react"
import { CookieBanner } from "./CookieBanner"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <CookieBanner />
    </SessionProvider>
  )
}

