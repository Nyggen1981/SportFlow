import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateLicense } from "@/lib/license"

// This endpoint should be called daily by a cron job (e.g., Vercel Cron)
// It checks license expiry and sends email notifications to admins

export const dynamic = "force-dynamic"

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET

export async function GET(req: Request) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get("authorization")
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get license info
    const license = await validateLicense(true) // Force refresh

    // If license is not valid or not active, skip email
    if (!license.valid || !license.daysRemaining) {
      return NextResponse.json({ 
        message: "License not active or no expiry date",
        status: license.status
      })
    }

    // Check if we should send warning email (5 days before expiry)
    const daysRemaining = license.daysRemaining
    const shouldSendWarning = daysRemaining === 5 || daysRemaining === 3 || daysRemaining === 1

    if (!shouldSendWarning) {
      return NextResponse.json({ 
        message: `License has ${daysRemaining} days remaining. No notification needed.`,
        daysRemaining
      })
    }

    // Get admin users to notify
    const admins = await prisma.user.findMany({
      where: {
        role: "admin",
        isApproved: true
      },
      select: {
        email: true,
        name: true
      }
    })

    if (admins.length === 0) {
      return NextResponse.json({ 
        message: "No admin users found to notify",
        daysRemaining
      })
    }

    // Get organization info
    const org = await prisma.organization.findFirst({
      select: {
        name: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpPass: true,
        smtpFrom: true
      }
    })

    // Send email to each admin
    const results = []
    for (const admin of admins) {
      try {
        await sendLicenseExpiryEmail({
          to: admin.email,
          name: admin.name || "Administrator",
          orgName: org?.name || "din organisasjon",
          daysRemaining,
          expiresAt: license.expiresAt || "",
          smtp: org ? {
            host: org.smtpHost,
            port: org.smtpPort,
            user: org.smtpUser,
            pass: org.smtpPass,
            from: org.smtpFrom
          } : null
        })
        results.push({ email: admin.email, sent: true })
      } catch (error) {
        console.error(`Failed to send email to ${admin.email}:`, error)
        results.push({ email: admin.email, sent: false, error: String(error) })
      }
    }

    return NextResponse.json({ 
      message: `License expiry warning sent`,
      daysRemaining,
      notified: results
    })

  } catch (error) {
    console.error("License expiry check error:", error)
    return NextResponse.json(
      { error: "Failed to check license expiry" },
      { status: 500 }
    )
  }
}

interface EmailParams {
  to: string
  name: string
  orgName: string
  daysRemaining: number
  expiresAt: string
  smtp: {
    host: string | null
    port: number | null
    user: string | null
    pass: string | null
    from: string | null
  } | null
}

async function sendLicenseExpiryEmail(params: EmailParams) {
  const { to, name, orgName, daysRemaining, expiresAt } = params

  const expiryDate = new Date(expiresAt).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric"
  })

  const subject = daysRemaining === 1 
    ? `⚠️ Sportflow Booking-lisensen utløper I MORGEN`
    : `⚠️ Sportflow Booking-lisensen utløper om ${daysRemaining} dager`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Lisens utløper snart</h1>
      </div>
      
      <div style="background: #fffbeb; padding: 30px; border: 1px solid #fcd34d; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="margin-top: 0;">Hei ${name},</p>
        
        <p>Sportflow Booking-lisensen for <strong>${orgName}</strong> utløper om <strong>${daysRemaining} ${daysRemaining === 1 ? 'dag' : 'dager'}</strong>.</p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #fcd34d; margin: 20px 0;">
          <p style="margin: 0; color: #92400e;">
            <strong>Utløpsdato:</strong> ${expiryDate}
          </p>
        </div>
        
        <p>Etter denne datoen vil brukere ikke kunne logge inn og systemet vil være utilgjengelig.</p>
        
        <p><strong>Hva bør du gjøre?</strong></p>
        <ul style="padding-left: 20px;">
          <li>Kontakt din Sportflow Booking-leverandør for å fornye lisensen</li>
          <li>Sørg for at fornyelsen er på plass før utløpsdatoen</li>
        </ul>
        
        <p style="margin-bottom: 0; color: #666; font-size: 14px;">
          Med vennlig hilsen,<br>
          Sportflow Booking
        </p>
      </div>
    </body>
    </html>
  `

  // Try to send email using configured SMTP or fallback to Resend
  if (params.smtp?.host && params.smtp?.user && params.smtp?.pass) {
    // Use nodemailer with org SMTP
    const nodemailer = await import("nodemailer")
    const transporter = nodemailer.createTransport({
      host: params.smtp.host,
      port: params.smtp.port || 587,
      secure: params.smtp.port === 465,
      auth: {
        user: params.smtp.user,
        pass: params.smtp.pass
      }
    })

    await transporter.sendMail({
      from: params.smtp.from || params.smtp.user,
      to,
      subject,
      html
    })
  } else if (process.env.RESEND_API_KEY) {
    // Use Resend
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "noreply@sportflow.no",
        to,
        subject,
        html
      })
    })

    if (!response.ok) {
      throw new Error(`Resend API error: ${response.status}`)
    }
  } else {
    console.log(`[License Expiry] Would send email to ${to}: ${subject}`)
    // In development, just log
  }
}

