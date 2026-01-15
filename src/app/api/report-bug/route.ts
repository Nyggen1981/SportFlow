import { NextResponse } from "next/server"
import nodemailer from "nodemailer"

// Destination email for bug reports
const BUG_REPORT_EMAIL = "kjetilnygard@hotmail.com"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { description, screenshot, userEmail, userName, currentUrl, userAgent } = body

    if (!description) {
      return NextResponse.json({ error: "Beskrivelse er påkrevd" }, { status: 400 })
    }

    // Get SMTP config from environment
    const smtpHost = process.env.SMTP_HOST
    const smtpPort = parseInt(process.env.SMTP_PORT || "587")
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const smtpFrom = process.env.SMTP_FROM || smtpUser

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error("[Bug Report] SMTP not configured")
      // Log the bug report instead
      console.log("=== BUG REPORT ===")
      console.log("Description:", description)
      console.log("User:", userName, userEmail)
      console.log("URL:", currentUrl)
      console.log("==================")
      return NextResponse.json({ success: true, message: "Rapport lagret (e-post ikke konfigurert)" })
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })

    // Build email HTML
    const timestamp = new Date().toLocaleString("no-NO", { timeZone: "Europe/Oslo" })
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; }
          .info-box { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #dc2626; }
          .label { font-weight: 600; color: #64748b; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; }
          .value { color: #1e293b; }
          .description { white-space: pre-wrap; background: white; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
          .meta { font-size: 12px; color: #64748b; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🐛 Feilrapport</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">${timestamp}</p>
          </div>
          <div class="content">
            <div class="info-box">
              <div class="label">Rapportert av</div>
              <div class="value">${userName} (${userEmail})</div>
            </div>
            
            <div class="info-box">
              <div class="label">Side</div>
              <div class="value"><a href="${currentUrl}">${currentUrl}</a></div>
            </div>
            
            <div class="label" style="margin-top: 20px;">Beskrivelse</div>
            <div class="description">${description}</div>
            
            ${screenshot ? '<p style="margin-top: 20px; color: #64748b;"><strong>📎 Skjermbilde vedlagt</strong></p>' : ''}
            
            <div class="meta">
              <div class="label">User Agent</div>
              <div style="word-break: break-all; font-size: 11px;">${userAgent}</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `

    // Prepare attachments
    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = []
    
    if (screenshot) {
      // Extract base64 data from data URL
      const matches = screenshot.match(/^data:image\/(\w+);base64,(.+)$/)
      if (matches) {
        const ext = matches[1]
        const base64Data = matches[2]
        attachments.push({
          filename: `screenshot.${ext}`,
          content: Buffer.from(base64Data, "base64"),
          contentType: `image/${ext}`,
        })
      }
    }

    // Send email
    try {
      await transporter.sendMail({
        from: smtpFrom,
        to: BUG_REPORT_EMAIL,
        subject: `🐛 Feilrapport: ${description.substring(0, 50)}${description.length > 50 ? "..." : ""}`,
        html,
        attachments,
      })
      console.log("[Bug Report] Email sent successfully to", BUG_REPORT_EMAIL)
    } catch (emailError) {
      // Log email error but don't fail the request - we still want to accept the report
      console.error("[Bug Report] Failed to send email:", emailError)
      console.log("=== BUG REPORT (email failed) ===")
      console.log("Description:", description)
      console.log("User:", userName, userEmail)
      console.log("URL:", currentUrl)
      console.log("================================")
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Bug Report] Error:", error)
    // Still return success to user - we don't want them to be frustrated
    // The error is logged server-side
    console.log("=== BUG REPORT (error occurred) ===")
    console.log("Error:", error)
    console.log("===================================")
    return NextResponse.json({ success: true })
  }
}

