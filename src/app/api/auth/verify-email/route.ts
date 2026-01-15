import { NextRequest, NextResponse } from "next/server"
import { verifyEmailToken } from "@/lib/email-verification"

/**
 * Verify email address using token
 * GET /api/auth/verify-email?token=...
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json(
        { error: "Verifiseringskode mangler" },
        { status: 400 }
      )
    }

    const result = await verifyEmailToken(token)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Kunne ikke verifisere e-post" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "E-postadressen er nå verifisert! Du kan nå logge inn.",
    })
  } catch (error: any) {
    console.error("Email verification error:", error)
    return NextResponse.json(
      { error: error.message || "Kunne ikke verifisere e-post" },
      { status: 500 }
    )
  }
}


