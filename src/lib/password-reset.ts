import { prisma } from "./prisma"
import { sendEmail } from "./email"
import crypto from "crypto"

function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = generateResetToken()
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 1)

  await prisma.passwordResetToken.deleteMany({
    where: { userId },
  })

  await prisma.passwordResetToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  })

  return token
}

export async function verifyPasswordResetToken(token: string): Promise<{ success: boolean; userId?: string; error?: string }> {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
  })

  if (!resetToken) {
    return { success: false, error: "Ugyldig eller utløpt lenke for tilbakestilling av passord." }
  }

  if (resetToken.expiresAt < new Date()) {
    await prisma.passwordResetToken.delete({
      where: { id: resetToken.id },
    })
    return { success: false, error: "Lenken har utløpt. Be om en ny tilbakestilling." }
  }

  return { success: true, userId: resetToken.userId }
}

export async function consumePasswordResetToken(token: string): Promise<void> {
  await prisma.passwordResetToken.deleteMany({
    where: { token },
  })
}

export async function sendPasswordResetEmail(userId: string, email: string, organizationName: string): Promise<void> {
  const token = await createPasswordResetToken(userId)

  let baseUrl = process.env.NEXTAUTH_URL
  if (!baseUrl && process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`
  }
  if (!baseUrl) {
    baseUrl = process.env.NODE_ENV === "production"
      ? "https://kalender.saudail.no"
      : "http://localhost:3000"
  }

  const resetUrl = `${baseUrl}/reset-password?token=${token}`

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tilbakestill passord</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Tilbakestill passord</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hei!</p>
          <p>Vi har mottatt en forespørsel om å tilbakestille passordet ditt hos <strong>${organizationName}</strong>.</p>
          <p>Klikk på knappen under for å velge et nytt passord:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: #4f46e5; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Tilbakestill passord</a>
          </div>
          <p>Eller kopier og lim inn denne lenken i nettleseren din:</p>
          <p style="word-break: break-all; color: #4f46e5;">${resetUrl}</p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">Denne lenken utløper om 1 time.</p>
          <p style="color: #666; font-size: 14px;">Hvis du ikke ba om å tilbakestille passordet ditt, kan du trygt ignorere denne e-posten.</p>
        </div>
      </body>
    </html>
  `

  const userOrg = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  })

  if (userOrg) {
    await sendEmail(userOrg.organizationId, {
      to: email,
      subject: `Tilbakestill passord - ${organizationName}`,
      html: emailHtml,
    })
  }
}
