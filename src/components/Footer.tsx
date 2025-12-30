"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import packageJson from "../../package.json"

const VERSION = packageJson.version

interface Organization {
  name: string
  invoiceOrgNumber: string | null
  invoiceAddress: string | null
  invoicePhone: string | null
  invoiceEmail: string | null
}

export function Footer() {
  const [pricingEnabled, setPricingEnabled] = useState(false)

  useEffect(() => {
    // Sjekk om pricing er aktivert (no-cache for fersk data)
    fetch("/api/pricing/status", { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setPricingEnabled(data.enabled || false))
      .catch(() => setPricingEnabled(false))
  }, [])

  return (
    <footer className="bg-slate-900 text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col sm:flex-row items-end justify-between gap-4 relative">
          {/* SportFlow Brand - Left */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-slate-900 flex items-center justify-center">
              <Image 
                src="/kvadratisk-logo.png" 
                alt="SF Logo" 
                width={56} 
                height={56} 
                className="object-contain"
              />
            </div>
            <div>
              <h3 className="font-bold text-base">SportFlow</h3>
              <p className="text-slate-400 text-xs">Smartere klubbdrift</p>
            </div>
          </div>

          {/* Version - Center (absolute positioned) */}
          <div className="absolute left-1/2 transform -translate-x-1/2 hidden sm:flex flex-col items-center" style={{ bottom: 0 }}>
            <div className="h-4 opacity-0 pointer-events-none">Personvernpolicy</div>
            <p className="text-xs text-slate-600 mt-1">
              v{VERSION}
            </p>
          </div>

          {/* Links and Copyright - Right */}
          <div className="text-center sm:text-right flex flex-col items-end gap-1">
            <div className="flex flex-col sm:flex-row items-end gap-2 sm:gap-4">
              <Link 
                href="/personvern" 
                className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
              >
                Personvernpolicy
              </Link>
              {pricingEnabled && (
                <Link 
                  href="/salgsvilkaar" 
                  className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
                >
                  Salgsvilkår
                </Link>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              &copy; {new Date().getFullYear()} SportFlow. Alle rettigheter reservert.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
