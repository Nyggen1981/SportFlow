import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { resendVerificationEmail } from "@/lib/email-verification"

/**
 * Resend verification email
 * POST /api/auth/verify-email/resend
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    await resendVerificationEmail(session.user.id)

    return NextResponse.json({
      success: true,
      message: "Verifiseringsmail er sendt på nytt. Sjekk e-posten din.",
    })
  } catch (error: any) {
    console.error("Resend verification email error:", error)
    return NextResponse.json(
      { error: error.message || "Kunne ikke sende verifiseringsmail" },
      { status: 500 }
    )
  }
}

