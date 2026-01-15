import { Navbar } from "./Navbar"
import { Footer } from "./Footer"
import { LicenseWarningBanner } from "./LicenseWarningBanner"

interface PageLayoutProps {
  children: React.ReactNode
  /** Use full width layout (for data-intensive views like Calendar, Timeline) */
  fullWidth?: boolean
  /** Custom max-width class (e.g., "max-w-5xl", "max-w-6xl"). Ignored if fullWidth is true */
  maxWidth?: "max-w-3xl" | "max-w-4xl" | "max-w-5xl" | "max-w-6xl" | "max-w-7xl"
}

export function PageLayout({ children, fullWidth = false, maxWidth = "max-w-7xl" }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <LicenseWarningBanner />
      <Navbar />
      
      <main className="flex-1">
        {fullWidth ? (
          <div className="w-full">
            {children}
          </div>
        ) : (
          <div className={`${maxWidth} mx-auto px-4 sm:px-6 lg:px-8`}>
            {children}
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  )
}
