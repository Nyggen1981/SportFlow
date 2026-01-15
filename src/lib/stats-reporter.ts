// Statistikk-rapportering til lisensserver
// Sender bruksstatistikk en gang i døgnet

import { prisma } from "./prisma"

const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL || "https://sportflow-administration.vercel.app"

interface StatsReport {
  totalUsers: number
  activeUsers: number
  lastUserLogin: string | null
  totalFacilities: number
  totalCategories: number
  totalBookings: number
  bookingsThisMonth: number
  pendingBookings: number
  totalRoles: number
}

/**
 * Henter lisensnøkkel fra database
 */
async function getLicenseKey(): Promise<string | null> {
  try {
    const org = await prisma.organization.findFirst({
      select: { licenseKey: true }
    })
    return org?.licenseKey || process.env.LICENSE_KEY || null
  } catch {
    return process.env.LICENSE_KEY || null
  }
}

/**
 * Samler inn statistikk fra databasen
 */
async function gatherStats(): Promise<StatsReport> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalUsers,
    activeUsers,
    totalFacilities,
    totalCategories,
    totalBookings,
    bookingsThisMonth,
    pendingBookings,
    totalRoles
  ] = await Promise.all([
    // Totalt antall brukere
    prisma.user.count(),
    
    // Aktive brukere (oppdatert siste 30 dager)
    prisma.user.count({
      where: {
        updatedAt: { gte: thirtyDaysAgo }
      }
    }),
    
    // Antall fasiliteter/ressurser
    prisma.resource.count(),
    
    // Antall kategorier
    prisma.resourceCategory.count(),
    
    // Totalt antall bookinger
    prisma.booking.count(),
    
    // Bookinger denne måneden
    prisma.booking.count({
      where: {
        createdAt: { gte: startOfMonth }
      }
    }),
    
    // Ventende bookinger
    prisma.booking.count({
      where: { status: "pending" }
    }),
    
    // Antall roller (egendefinerte + standard)
    prisma.customRole.count()
  ])

  // Hent siste brukeroppdatering (brukes som proxy for siste aktivitet)
  const lastActiveUser = await prisma.user.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true }
  })

  return {
    totalUsers,
    activeUsers,
    lastUserLogin: lastActiveUser?.updatedAt?.toISOString() || null,
    totalFacilities,
    totalCategories,
    totalBookings,
    bookingsThisMonth,
    pendingBookings,
    totalRoles: totalRoles + 2 // +2 for standard roller (admin, user)
  }
}

/**
 * Rapporterer statistikk til lisensserveren
 */
export async function reportStatsToLicenseServer(): Promise<{
  success: boolean
  message: string
  stats?: StatsReport
}> {
  const licenseKey = await getLicenseKey()

  if (!licenseKey) {
    console.log("[Stats] No license key configured - skipping stats report")
    return {
      success: false,
      message: "Ingen lisensnøkkel konfigurert"
    }
  }

  try {
    console.log("[Stats] Gathering statistics...")
    const stats = await gatherStats()
    
    console.log("[Stats] Sending to license server:", {
      totalUsers: stats.totalUsers,
      activeUsers: stats.activeUsers,
      totalBookings: stats.totalBookings,
      bookingsThisMonth: stats.bookingsThisMonth
    })

    const response = await fetch(`${LICENSE_SERVER_URL}/api/stats/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey,
        stats
      }),
      signal: AbortSignal.timeout(15000) // 15 sekunder timeout
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Stats] Report failed:", response.status, errorText)
      return {
        success: false,
        message: `Feil fra server: ${response.status} - ${errorText}`
      }
    }

    const result = await response.json()
    console.log("[Stats] Report successful:", result)
    
    return {
      success: true,
      message: result.message || "Statistikk rapportert",
      stats
    }
  } catch (error) {
    console.error("[Stats] Report error:", error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "Ukjent feil"
    }
  }
}

