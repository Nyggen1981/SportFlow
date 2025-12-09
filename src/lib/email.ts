import nodemailer from "nodemailer"

// Email configuration
// Set these environment variables in Vercel:
// - SMTP_HOST (e.g., smtp.gmail.com, smtp.office365.com)
// - SMTP_PORT (e.g., 587)
// - SMTP_USER (your email)
// - SMTP_PASS (your password or app password)
// - SMTP_FROM (sender email address)

interface EmailOptions {
  to: string
  subject: string
  html: string
}

// Create reusable transporter
const createTransporter = () => {
  // Check if email is configured
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465", // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const transporter = createTransporter()
  
  if (!transporter) {
    // Email not configured - log instead
    console.log("=== EMAIL (not configured - logging only) ===")
    console.log("To:", options.to)
    console.log("Subject:", options.subject)
    console.log("==========================")
    return false
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: options.to,
      subject: options.subject,
      html: options.html,
    })
    
    console.log("Email sent successfully to:", options.to)
    return true
  } catch (error) {
    console.error("Failed to send email:", error)
    return false
  }
}

// Email templates

export function getBookingCancelledByAdminEmail(bookingTitle: string, resourceName: string, date: string, time: string, reason?: string) {
  return {
    subject: `Booking kansellert: ${bookingTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
          .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
          .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Booking kansellert</h1>
          </div>
          <div class="content">
            <p>Vi må dessverre informere deg om at følgende booking har blitt kansellert:</p>
            
            <div class="info-box">
              <p><strong>Arrangement:</strong> ${bookingTitle}</p>
              <p><strong>Fasilitet:</strong> ${resourceName}</p>
              <p><strong>Dato:</strong> ${date}</p>
              <p><strong>Tid:</strong> ${time}</p>
              ${reason ? `<p><strong>Årsak:</strong> ${reason}</p>` : ''}
            </div>
            
            <p>Ta kontakt hvis du har spørsmål.</p>
          </div>
          <div class="footer">
            <p>Med vennlig hilsen,<br/>Arena Booking</p>
          </div>
        </div>
      </body>
      </html>
    `
  }
}

export function getBookingCancelledByUserEmail(bookingTitle: string, resourceName: string, date: string, time: string, userName: string, userEmail: string) {
  return {
    subject: `Booking kansellert av bruker: ${bookingTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
          .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
          .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Booking kansellert</h1>
          </div>
          <div class="content">
            <p>En booking har blitt kansellert av brukeren:</p>
            
            <div class="info-box">
              <p><strong>Arrangement:</strong> ${bookingTitle}</p>
              <p><strong>Fasilitet:</strong> ${resourceName}</p>
              <p><strong>Dato:</strong> ${date}</p>
              <p><strong>Tid:</strong> ${time}</p>
              <p><strong>Bruker:</strong> ${userName} (${userEmail})</p>
            </div>
          </div>
          <div class="footer">
            <p>Med vennlig hilsen,<br/>Arena Booking</p>
          </div>
        </div>
      </body>
      </html>
    `
  }
}

export function getNewBookingRequestEmail(bookingTitle: string, resourceName: string, date: string, time: string, userName: string, userEmail: string, description?: string) {
  return {
    subject: `Ny bookingforespørsel: ${bookingTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
          .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px; }
          .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Ny bookingforespørsel</h1>
          </div>
          <div class="content">
            <p>En ny booking venter på godkjenning:</p>
            
            <div class="info-box">
              <p><strong>Arrangement:</strong> ${bookingTitle}</p>
              <p><strong>Fasilitet:</strong> ${resourceName}</p>
              <p><strong>Dato:</strong> ${date}</p>
              <p><strong>Tid:</strong> ${time}</p>
              <p><strong>Booket av:</strong> ${userName} (${userEmail})</p>
              ${description ? `<p><strong>Beskrivelse:</strong> ${description}</p>` : ''}
            </div>
            
            <p>Logg inn i admin-panelet for å godkjenne eller avslå bookingen.</p>
          </div>
          <div class="footer">
            <p>Med vennlig hilsen,<br/>Arena Booking</p>
          </div>
        </div>
      </body>
      </html>
    `
  }
}

export function getBookingApprovedEmail(bookingTitle: string, resourceName: string, date: string, time: string) {
  return {
    subject: `Booking godkjent: ${bookingTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
          .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e; }
          .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">✓ Booking godkjent!</h1>
          </div>
          <div class="content">
            <p>Gode nyheter! Din booking har blitt godkjent:</p>
            
            <div class="info-box">
              <p><strong>Arrangement:</strong> ${bookingTitle}</p>
              <p><strong>Fasilitet:</strong> ${resourceName}</p>
              <p><strong>Dato:</strong> ${date}</p>
              <p><strong>Tid:</strong> ${time}</p>
            </div>
            
            <p>Vi gleder oss til å se deg!</p>
          </div>
          <div class="footer">
            <p>Med vennlig hilsen,<br/>Arena Booking</p>
          </div>
        </div>
      </body>
      </html>
    `
  }
}

export function getBookingRejectedEmail(bookingTitle: string, resourceName: string, date: string, time: string, reason?: string) {
  return {
    subject: `Booking avslått: ${bookingTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
          .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
          .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Booking avslått</h1>
          </div>
          <div class="content">
            <p>Vi beklager, men din booking har blitt avslått:</p>
            
            <div class="info-box">
              <p><strong>Arrangement:</strong> ${bookingTitle}</p>
              <p><strong>Fasilitet:</strong> ${resourceName}</p>
              <p><strong>Dato:</strong> ${date}</p>
              <p><strong>Tid:</strong> ${time}</p>
              ${reason ? `<p><strong>Årsak:</strong> ${reason}</p>` : ''}
            </div>
            
            <p>Ta kontakt hvis du har spørsmål eller ønsker å booke en annen tid.</p>
          </div>
          <div class="footer">
            <p>Med vennlig hilsen,<br/>Arena Booking</p>
          </div>
        </div>
      </body>
      </html>
    `
  }
}
