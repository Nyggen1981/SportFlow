import { NextResponse } from "next/server"
import { getLicenseInfo } from "@/lib/license"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // Kun innloggede brukere kan se lisensstatus
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ showWarning: false })
    }

    const licenseInfo = await getLicenseInfo()
    
    return NextResponse.json(licenseInfo)
  } catch (error) {
    console.error("Error getting license status:", error)
    return NextResponse.json({ showWarning: false })
  }
}

