import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { sendEmail } from "@/lib/email"

// Test endpoint for email - only accessible by admin
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Kun admin kan teste e-post" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const testEmail = body.email || session.user.email

    // Check if SMTP is configured
    const isConfigured = !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    )

    if (!isConfigured) {
      return NextResponse.json({
        success: false,
        configured: false,
        message: "E-post er ikke konfigurert. Mangler SMTP-variabler i Vercel.",
        missing: {
          SMTP_HOST: !process.env.SMTP_HOST,
          SMTP_USER: !process.env.SMTP_USER,
          SMTP_PASS: !process.env.SMTP_PASS,
          SMTP_PORT: !process.env.SMTP_PORT,
          SMTP_FROM: !process.env.SMTP_FROM
        }
      })
    }

    // Try to send test email
    const result = await sendEmail(session.user.organizationId, {
      to: testEmail,
      subject: "Test fra Sportflow Booking",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✓ E-post fungerer!</h1>
            </div>
            <div class="content">
              <p>Gratulerer! Din e-postkonfigurasjon er korrekt.</p>
              <p>Sportflow Booking kan nå sende varsler om bookinger.</p>
              <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
                Sendt: ${new Date().toLocaleString("nb-NO")}
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    })

    if (result) {
      return NextResponse.json({
        success: true,
        configured: true,
        message: `Test-e-post sendt til ${testEmail}!`
      })
    } else {
      return NextResponse.json({
        success: false,
        configured: true,
        message: "Kunne ikke sende e-post. Sjekk SMTP-innstillingene.",
        hint: "Mulige årsaker: Feil passord, SMTP AUTH ikke aktivert, eller MFA krever app-passord."
      })
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      configured: true,
      message: "Feil ved sending av e-post",
      error: error.message
    }, { status: 500 })
  }
}

// GET to check configuration status
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Kun admin" }, { status: 403 })
  }

  const isConfigured = !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  )

  return NextResponse.json({
    configured: isConfigured,
    settings: {
      host: process.env.SMTP_HOST ? "✓ Satt" : "✗ Mangler",
      port: process.env.SMTP_PORT || "587 (standard)",
      user: process.env.SMTP_USER ? `✓ ${process.env.SMTP_USER}` : "✗ Mangler",
      pass: process.env.SMTP_PASS ? "✓ Satt (skjult)" : "✗ Mangler",
      from: process.env.SMTP_FROM || process.env.SMTP_USER || "Ikke satt"
    }
  })
}

