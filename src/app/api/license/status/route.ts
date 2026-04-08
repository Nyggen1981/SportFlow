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
    // Ikke returner tomt svar — da tolker klienten det som ugyldig lisens og låser alle ute
    return NextResponse.json({
      valid: true,
      status: "error" as const,
      organization: "Ukjent",
      expiresAt: null,
      daysRemaining: null,
      licenseType: null,
      licenseTypeName: null,
      modules: undefined,
      pricing: undefined,
      showWarning: true,
      warningMessage: "Kunne ikke hente lisensstatus. Prøv igjen om litt.",
      limits: undefined,
    })
  }
}

