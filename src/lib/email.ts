import nodemailer from "nodemailer"
import { getEmailTemplate, getDefaultEmailTemplates, renderEmailTemplate } from "./email-templates"
import { prisma } from "./prisma"
import { formatInTimeZone } from "date-fns-tz"
import { nb } from "date-fns/locale"

const TIMEZONE = "Europe/Oslo"

// Helper function to format date and time for emails, handling multi-day bookings
export function formatBookingDateTime(startTime: Date, endTime: Date): { date: string; time: string } {
  const startDate = formatInTimeZone(startTime, TIMEZONE, "yyyy-MM-dd")
  const endDate = formatInTimeZone(endTime, TIMEZONE, "yyyy-MM-dd")
  const isSameDay = startDate === endDate

  if (isSameDay) {
    // Same day: "fredag 7. mai 2027" and "18:00 - 20:00"
    return {
      date: formatInTimeZone(startTime, TIMEZONE, "EEEE d. MMMM yyyy", { locale: nb }),
      time: `${formatInTimeZone(startTime, TIMEZONE, "HH:mm")} - ${formatInTimeZone(endTime, TIMEZONE, "HH:mm")}`
    }
  } else {
    // Multi-day: Show full date range with times
    return {
      date: `${formatInTimeZone(startTime, TIMEZONE, "EEEE d. MMMM", { locale: nb })} kl. ${formatInTimeZone(startTime, TIMEZONE, "HH:mm")} → ${formatInTimeZone(endTime, TIMEZONE, "EEEE d. MMMM yyyy", { locale: nb })} kl. ${formatInTimeZone(endTime, TIMEZONE, "HH:mm")}`,
      time: "" // Time is included in the date string for multi-day bookings
    }
  }
}

// Email configuration
// Per-organization SMTP settings are stored in the Organization model
// Falls back to global environment variables if organization doesn't have its own settings:
// - SMTP_HOST (e.g., smtp.gmail.com, smtp.office365.com)
// - SMTP_PORT (e.g., 587)
// - SMTP_USER (your email)
// - SMTP_PASS (your password or app password)
// - SMTP_FROM (sender email address)

interface EmailOptions {
  to: string
  subject: string
  html: string
  attachments?: Array<{
    filename: string
    content: Buffer
    contentType?: string
  }>
}

interface SMTPConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
  from: string
}

// Get SMTP configuration for an organization, with fallback to global env vars
async function getSMTPConfig(organizationId: string): Promise<SMTPConfig | null> {
  try {
    // Try to get organization-specific SMTP settings
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpPass: true,
        smtpFrom: true,
      },
    })

    // If organization has SMTP settings, use them
    if (organization?.smtpHost && organization?.smtpUser && organization?.smtpPass) {
      return {
        host: organization.smtpHost,
        port: organization.smtpPort || 587,
        secure: organization.smtpPort === 465,
        auth: {
          user: organization.smtpUser,
          pass: organization.smtpPass,
        },
        from: organization.smtpFrom || organization.smtpUser,
      }
    }
  } catch (error) {
    console.warn("Error fetching organization SMTP settings, falling back to global:", error)
  }

  // Fallback to global environment variables
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
    }
  }

  return null
}

// Create transporter from SMTP config
function createTransporter(config: SMTPConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  })
}

export async function sendEmail(
  organizationId: string,
  options: EmailOptions
): Promise<boolean> {
  const smtpConfig = await getSMTPConfig(organizationId)
  
  if (!smtpConfig) {
    // Email not configured - log instead
    console.log("=== EMAIL (not configured - logging only) ===")
    console.log("Organization:", organizationId)
    console.log("To:", options.to)
    console.log("Subject:", options.subject)
    console.log("==========================")
    return false
  }

  try {
    const transporter = createTransporter(smtpConfig)
    await transporter.sendMail({
      from: smtpConfig.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments?.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType || "application/pdf",
      })),
    })
    
    console.log("Email sent successfully to:", options.to, "from organization:", organizationId)
    return true
  } catch (error) {
    console.error("Failed to send email:", error)
    return false
  }
}

// Helper to get organization name
async function getOrganizationName(organizationId: string): Promise<string> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    })
    return org?.name || "Sportflow Booking"
  } catch {
    return "Sportflow Booking"
  }
}

// Email templates - now using database templates with fallback to defaults

export async function getBookingCancelledByAdminEmail(
  organizationId: string,
  bookingTitle: string,
  resourceName: string,
  date: string,
  time: string,
  reason?: string
) {
  const customTemplate = await getEmailTemplate(organizationId, "cancelled_by_admin")
  const defaultTemplates = getDefaultEmailTemplates()
  const template = customTemplate || {
    subject: defaultTemplates.cancelled_by_admin.subject,
    htmlBody: defaultTemplates.cancelled_by_admin.htmlBody,
  }
  const organizationName = await getOrganizationName(organizationId)

  return renderEmailTemplate(template, {
    bookingTitle,
    resourceName,
    date,
    time,
    reason,
    organizationName,
  })
}

export async function getBookingCancelledByUserEmail(
  organizationId: string,
  bookingTitle: string,
  resourceName: string,
  date: string,
  time: string,
  userName: string,
  userEmail: string,
  reason?: string
) {
  const customTemplate = await getEmailTemplate(organizationId, "cancelled_by_user")
  const defaultTemplates = getDefaultEmailTemplates()
  const template = customTemplate || {
    subject: defaultTemplates.cancelled_by_user.subject,
    htmlBody: defaultTemplates.cancelled_by_user.htmlBody,
  }
  const organizationName = await getOrganizationName(organizationId)

  return renderEmailTemplate(template, {
    bookingTitle,
    resourceName,
    date,
    time,
    userName,
    userEmail,
    reason: reason || "",
    organizationName,
  })
}

export async function getNewBookingRequestEmail(
  organizationId: string,
  bookingTitle: string,
  resourceName: string,
  date: string,
  time: string,
  userName: string,
  userEmail: string,
  description?: string,
  recurringInfo?: {
    count: number
    endDate: string
  }
) {
  const customTemplate = await getEmailTemplate(organizationId, "new_booking")
  const defaultTemplates = getDefaultEmailTemplates()
  const template = customTemplate || {
    subject: defaultTemplates.new_booking.subject,
    htmlBody: defaultTemplates.new_booking.htmlBody,
  }
  const organizationName = await getOrganizationName(organizationId)

  // Build recurring info text if applicable
  const recurringText = recurringInfo && recurringInfo.count > 1
    ? `🔄 Gjentakende booking: ${recurringInfo.count} datoer (${date} - ${recurringInfo.endDate})`
    : undefined

  return renderEmailTemplate(template, {
    bookingTitle,
    resourceName,
    date: recurringInfo && recurringInfo.count > 1 
      ? `${date} (første av ${recurringInfo.count} datoer)`
      : date,
    time,
    userName,
    userEmail,
    description,
    organizationName,
    recurringInfo: recurringText,
  })
}

export async function getBookingApprovedEmail(
  organizationId: string,
  bookingTitle: string,
  resourceName: string,
  date: string,
  time: string,
  adminNote?: string | null,
  invoiceInfo?: { invoiceNumber: string; dueDate: string; totalAmount: number } | null
) {
  const customTemplate = await getEmailTemplate(organizationId, "approved")
  const defaultTemplates = getDefaultEmailTemplates()
  const template = customTemplate || {
    subject: defaultTemplates.approved.subject,
    htmlBody: defaultTemplates.approved.htmlBody,
  }
  const organizationName = await getOrganizationName(organizationId)

  let result = renderEmailTemplate(template, {
    bookingTitle,
    resourceName,
    date,
    time,
    adminNote: adminNote || "",
    organizationName,
  })

  // Hvis faktura er vedlagt, legg til betalingsinformasjon i e-posten
  if (invoiceInfo) {
    const paymentInfoHtml = `
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 12px 0; font-weight: 600; color: #92400e; font-size: 16px;">💳 Betalingsinformasjon</p>
        <p style="margin: 0 0 8px 0; color: #78350f;">
          <strong>Fakturanummer:</strong> ${invoiceInfo.invoiceNumber}<br/>
          <strong>Beløp:</strong> ${invoiceInfo.totalAmount.toFixed(2)} kr<br/>
          <strong>Forfallsdato:</strong> ${invoiceInfo.dueDate}
        </p>
        <p style="margin: 12px 0 0 0; color: #78350f; font-size: 14px;">
          📎 Faktura er vedlagt denne e-posten. Vennligst betal innen forfallsdatoen.
        </p>
      </div>
    `
    // Inject payment info before the closing content div
    result.html = result.html.replace(
      /<p>Vi gleder oss til å se deg!<\/p>/,
      `${paymentInfoHtml}<p>Vi gleder oss til å se deg!</p>`
    )
  }

  return result
}

export async function getBookingRejectedEmail(
  organizationId: string,
  bookingTitle: string,
  resourceName: string,
  date: string,
  time: string,
  reason?: string
) {
  const customTemplate = await getEmailTemplate(organizationId, "rejected")
  const defaultTemplates = getDefaultEmailTemplates()
  const template = customTemplate || {
    subject: defaultTemplates.rejected.subject,
    htmlBody: defaultTemplates.rejected.htmlBody,
  }
  const organizationName = await getOrganizationName(organizationId)

  return renderEmailTemplate(template, {
    bookingTitle,
    resourceName,
    date,
    time,
    reason,
    organizationName,
  })
}

export async function getBookingPaidEmail(
  organizationId: string,
  bookingTitle: string,
  resourceName: string,
  date: string,
  time: string,
  adminNote?: string | null,
  customMessage?: string | null
) {
  const customTemplate = await getEmailTemplate(organizationId, "paid")
  const defaultTemplates = getDefaultEmailTemplates()
  const template = customTemplate || {
    subject: defaultTemplates.paid.subject,
    htmlBody: defaultTemplates.paid.htmlBody,
  }
  const organizationName = await getOrganizationName(organizationId)

  return renderEmailTemplate(template, {
    bookingTitle,
    resourceName,
    date,
    time,
    adminNote: adminNote || "",
    customMessage: customMessage || "",
    organizationName,
  })
}