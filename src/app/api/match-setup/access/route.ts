import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { canAccessMatchSetup } from "@/lib/roles"
import { isMatchSetupEnabled } from "@/lib/match-setup"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ hasAccess: false })
    }

    // Sjekk om modulen er aktivert
    const moduleEnabled = await isMatchSetupEnabled()
    if (!moduleEnabled) {
      return NextResponse.json({ hasAccess: false })
    }

    // Admin har alltid tilgang
    if (session.user.systemRole === "admin" || session.user.role === "admin") {
      return NextResponse.json({ hasAccess: true, isAdmin: true })
    }

    // Sjekk om brukeren har kampoppsett-tilgang via sin rolle
    const hasAccess = await canAccessMatchSetup(session.user.id)
    
    return NextResponse.json({ hasAccess, isAdmin: false })
  } catch (error) {
    console.error("[MatchSetup] Error checking access:", error)
    return NextResponse.json({ hasAccess: false })
  }
}


