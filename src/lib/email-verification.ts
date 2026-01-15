import { prisma } from "./prisma"
import { sendEmail } from "./email"
import crypto from "crypto"

/**
 * Generate a secure random token for email verification
 */
function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

/**
 * Create an email verification token for a user
 */
export async function createVerificationToken(userId: string): Promise<string> {
  const token = generateVerificationToken()
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 24) // Token expires in 24 hours

  // Delete any existing token for this user
  await prisma.emailVerificationToken.deleteMany({
    where: { userId },
  })

  // Create new token
  await prisma.emailVerificationToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  })

  return token
}

/**
 * Verify an email verification token
 */
export async function verifyEmailToken(token: string): Promise<{ success: boolean; userId?: string; error?: string }> {
  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!verificationToken) {
    return { success: false, error: "Ugyldig verifiseringskode" }
  }

  if (verificationToken.expiresAt < new Date()) {
    // Delete expired token
    await prisma.emailVerificationToken.delete({
      where: { id: verificationToken.id },
    })
    return { success: false, error: "Verifiseringskoden har utløpt. Be om en ny kode." }
  }

  if (verificationToken.user.emailVerified) {
    // Already verified, delete token
    await prisma.emailVerificationToken.delete({
      where: { id: verificationToken.id },
    })
    return { success: false, error: "E-posten er allerede verifisert" }
  }

  // Mark email as verified
  await prisma.user.update({
    where: { id: verificationToken.userId },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  })

  // Delete used token
  await prisma.emailVerificationToken.delete({
    where: { id: verificationToken.id },
  })

  return { success: true, userId: verificationToken.userId }
}

/**
 * Send verification email to user
 */
export async function sendVerificationEmail(userId: string, email: string, organizationName: string): Promise<void> {
  const token = await createVerificationToken(userId)
  
  // Determine base URL - prioritize NEXTAUTH_URL, then VERCEL_URL, then localhost
  let baseUrl = process.env.NEXTAUTH_URL
  if (!baseUrl && process.env.VERCEL_URL) {
    // Vercel provides VERCEL_URL automatically in production
    baseUrl = `https://${process.env.VERCEL_URL}`
  }
  if (!baseUrl) {
    baseUrl = process.env.NODE_ENV === "production" 
      ? "https://kalender.saudail.no" // Fallback for production (Sauda IL)
      : "http://localhost:3000" // Fallback for development
  }
  
  const verificationUrl = `${baseUrl}/verify-email?token=${token}`

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifiser din e-post</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Verifiser din e-post</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hei!</p>
          <p>Takk for at du registrerte deg hos <strong>${organizationName}</strong>.</p>
          <p>For å aktivere kontoen din, må du verifisere e-postadressen din ved å klikke på knappen under:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Verifiser e-post</a>
          </div>
          <p>Eller kopier og lim inn denne lenken i nettleseren din:</p>
          <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">Denne lenken utløper om 24 timer.</p>
          <p style="color: #666; font-size: 14px;">Hvis du ikke registrerte deg, kan du ignorere denne e-posten.</p>
        </div>
      </body>
    </html>
  `

  const userOrg = await prisma.user.findUnique({ 
    where: { id: userId }, 
    select: { organizationId: true } 
  })
  
  if (userOrg) {
    await sendEmail(userOrg.organizationId, {
      to: email,
      subject: `Verifiser din e-post - ${organizationName}`,
      html: emailHtml,
    })
  }
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  })

  if (!user) {
    throw new Error("Bruker ikke funnet")
  }

  if (user.emailVerified) {
    throw new Error("E-posten er allerede verifisert")
  }

  await sendVerificationEmail(userId, user.email, user.organization.name)
}

