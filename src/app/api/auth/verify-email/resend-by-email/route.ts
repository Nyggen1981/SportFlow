import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendVerificationEmail } from "@/lib/email-verification"

/**
 * Resend verification email by email address (no auth required)
 * POST /api/auth/verify-email/resend-by-email
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: "E-postadresse er påkrevd" },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    })

    // Always return success message for security (don't reveal if email exists)
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "Hvis e-postadressen er registrert og ikke verifisert, vil du motta en verifiseringsmail.",
      })
    }

    // If email is already verified, don't send
    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: "E-postadressen er allerede verifisert.",
      })
    }

    // Send verification email
    try {
      await sendVerificationEmail(user.id, user.email, user.organization.name)
      return NextResponse.json({
        success: true,
        message: "Verifiseringsmail er sendt. Sjekk e-posten din.",
      })
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError)
      return NextResponse.json(
        { error: "Kunne ikke sende verifiseringsmail. Prøv igjen senere." },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("Resend verification email error:", error)
    return NextResponse.json(
      { error: error.message || "Kunne ikke sende verifiseringsmail" },
      { status: 500 }
    )
  }
}

