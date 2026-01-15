import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"

// Hardkodet lisensserver URL
const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL || "https://sportflow-license.vercel.app"

export async function POST(req: Request) {
  try {
    // Kun admin kan teste lisens
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { licenseKey } = await req.json()

    if (!licenseKey) {
      return NextResponse.json({
        valid: false,
        error: "Lisensnøkkel må fylles ut"
      })
    }

    // Kall lisensserveren med lisensnøkkelen
    const response = await fetch(`${LICENSE_SERVER_URL}/api/license/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: licenseKey,
        appVersion: "1.0.20"
      }),
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      // Prøv å hente feilmelding fra responsen
      let errorMessage = `Lisensserver returnerte feil: ${response.status}`
      try {
        const errorData = await response.json()
        if (errorData.message) {
          errorMessage = errorData.message
        } else if (errorData.error) {
          errorMessage = errorData.error
        }
      } catch {
        // Hvis JSON-parsing feiler, bruk standardmelding
      }
      
      // Spesifikk melding for 404
      if (response.status === 404) {
        errorMessage = `Lisensserver-endpoint ikke funnet (404). Sjekk at URL-en er riktig: ${LICENSE_SERVER_URL}/api/license/validate`
      }
      
      return NextResponse.json({
        valid: false,
        status: "error",
        message: errorMessage
      })
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error("License test error:", error)
    
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({
        valid: false,
        status: "timeout",
        message: "Lisensserveren svarte ikke innen 10 sekunder"
      })
    }

    return NextResponse.json({
      valid: false,
      status: "error",
      message: "Kunne ikke kontakte lisensserveren"
    })
  }
}
