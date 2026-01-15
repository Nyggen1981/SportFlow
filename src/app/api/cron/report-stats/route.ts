import { NextRequest, NextResponse } from "next/server"
import { reportStatsToLicenseServer } from "@/lib/stats-reporter"

// This endpoint should be called daily by Vercel Cron
// It reports usage statistics to the license server

export const dynamic = "force-dynamic"

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel sends this header automatically for cron jobs)
    const authHeader = request.headers.get("authorization")
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      console.log("[Stats Cron] Unauthorized request")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[Stats Cron] Starting stats report...")
    const result = await reportStatsToLicenseServer()

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        stats: result.stats
      })
    } else {
      return NextResponse.json({
        success: false,
        message: result.message
      }, { status: 500 })
    }
  } catch (error) {
    console.error("[Stats Cron] Error:", error)
    return NextResponse.json(
      { error: "Failed to report stats", details: String(error) },
      { status: 500 }
    )
  }
}

