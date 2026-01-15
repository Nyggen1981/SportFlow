import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// Hardkodet lisensserver URL
const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL || "https://sportflow-license.vercel.app"

/**
 * Henter detaljert prisinformasjon fra lisensserveren
 * GET /api/license/pricing
 */
export async function GET() {
  try {
    // Kun admin kan se prisinformasjon
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user.role !== "admin" && session.user.systemRole !== "admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Hent lisensnøkkel fra database eller env
    let licenseKey: string | null = null
    
    try {
      const org = await prisma.organization.findFirst({
        select: { licenseKey: true }
      })
      licenseKey = org?.licenseKey || null
    } catch (error) {
      console.log("[License] Could not read config from database, falling back to env")
    }

    if (!licenseKey) {
      licenseKey = process.env.LICENSE_KEY || null
    }

    if (!licenseKey) {
      return NextResponse.json({
        error: "Ingen lisensnøkkel konfigurert"
      }, { status: 400 })
    }

    // Hent prisinformasjon fra lisensserveren
    const response = await fetch(
      `${LICENSE_SERVER_URL}/api/license/pricing?licenseKey=${encodeURIComponent(licenseKey)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000)
      }
    )

    if (!response.ok) {
      throw new Error(`License server returned ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error("[License] Pricing fetch error:", error)
    
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({
        error: "Lisensserveren svarte ikke innen 10 sekunder"
      }, { status: 504 })
    }

    return NextResponse.json({
      error: "Kunne ikke hente prisinformasjon fra lisensserveren"
    }, { status: 500 })
  }
}

