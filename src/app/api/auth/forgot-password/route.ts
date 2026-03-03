import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { sendPasswordResetEmail } from "@/lib/password-reset"

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: "E-post er påkrevd" },
        { status: 400 }
      )
    }

    // Always return success to prevent email enumeration
    const successResponse = NextResponse.json({
      success: true,
      message: "Hvis e-postadressen er registrert, vil du motta en e-post med instruksjoner for å tilbakestille passordet ditt.",
    })

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        organization: { select: { name: true } },
      },
    })

    if (!user) {
      return successResponse
    }

    try {
      await sendPasswordResetEmail(user.id, user.email, user.organization.name)
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError)
    }

    return successResponse
  } catch (error) {
    console.error("Forgot password error:", error)
    return NextResponse.json(
      { error: "Noe gikk galt. Prøv igjen senere." },
      { status: 500 }
    )
  }
}
