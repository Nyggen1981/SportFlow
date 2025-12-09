import { Navbar } from "./Navbar"
import { Footer } from "./Footer"

interface PageLayoutProps {
  children: React.ReactNode
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      
      <main className="flex-1">
        {children}
      </main>
      
      <Footer />
    </div>
  )
}
