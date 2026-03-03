import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { verifyPasswordResetToken, consumePasswordResetToken } from "@/lib/password-reset"

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token og nytt passord er påkrevd" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Passordet må være minst 6 tegn" },
        { status: 400 }
      )
    }

    const result = await verifyPasswordResetToken(token)

    if (!result.success || !result.userId) {
      return NextResponse.json(
        { error: result.error || "Ugyldig token" },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await prisma.user.update({
      where: { id: result.userId },
      data: { password: hashedPassword },
    })

    await consumePasswordResetToken(token)

    return NextResponse.json({
      success: true,
      message: "Passordet er oppdatert. Du kan nå logge inn med det nye passordet ditt.",
    })
  } catch (error) {
    console.error("Reset password error:", error)
    return NextResponse.json(
      { error: "Noe gikk galt. Prøv igjen senere." },
      { status: 500 }
    )
  }
}
