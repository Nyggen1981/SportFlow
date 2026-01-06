import { NextResponse } from "next/server"
import { isMatchSetupEnabled } from "@/lib/match-setup"

export async function GET() {
  try {
    const enabled = await isMatchSetupEnabled()
    
    return NextResponse.json({
      enabled,
      module: "matchSetup",
      message: enabled 
        ? "Kampoppsett-modulen er aktivert" 
        : "Kampoppsett-modulen er ikke aktivert for denne lisensen"
    })
  } catch (error) {
    console.error("[MatchSetup Status] Error:", error)
    return NextResponse.json(
      { enabled: false, error: "Kunne ikke sjekke modulstatus" },
      { status: 500 }
    )
  }
}


