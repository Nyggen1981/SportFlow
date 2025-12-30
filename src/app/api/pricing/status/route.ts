import { NextResponse } from "next/server"
import { isPricingEnabled } from "@/lib/pricing"

// Ikke cache denne - alltid fersk data
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const enabled = await isPricingEnabled()
    return NextResponse.json({ enabled }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    })
  } catch (error) {
    console.error("Error checking pricing status:", error)
    return NextResponse.json({ enabled: false }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    })
  }
}
