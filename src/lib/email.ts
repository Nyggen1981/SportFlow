import nodemailer from "nodemailer"
import { getEmailTemplate, getDefaultEmailTemplates, renderEmailTemplate } from "./email-templates"
import { prisma } from "./prisma"

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
    })
    
    console.log("Email sent successfully to:", options.to, "from organization:", organizationId)
    return true
  } catch (error) {
    console.error("Failed to send email:", error)
    return false
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

  return renderEmailTemplate(template, {
    bookingTitle,
    resourceName,
    date,
    time,
    reason,
  })
}

export async function getBookingCancelledByUserEmail(
  organizationId: string,
  bookingTitle: string,
  resourceName: string,
  date: string,
  time: string,
  userName: string,
  userEmail: string
) {
  const customTemplate = await getEmailTemplate(organizationId, "cancelled_by_user")
  const defaultTemplates = getDefaultEmailTemplates()
  const template = customTemplate || {
    subject: defaultTemplates.cancelled_by_user.subject,
    htmlBody: defaultTemplates.cancelled_by_user.htmlBody,
  }

  return renderEmailTemplate(template, {
    bookingTitle,
    resourceName,
    date,
    time,
    userName,
    userEmail,
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
  description?: string
) {
  const customTemplate = await getEmailTemplate(organizationId, "new_booking")
  const defaultTemplates = getDefaultEmailTemplates()
  const template = customTemplate || {
    subject: defaultTemplates.new_booking.subject,
    htmlBody: defaultTemplates.new_booking.htmlBody,
  }

  return renderEmailTemplate(template, {
    bookingTitle,
    resourceName,
    date,
    time,
    userName,
    userEmail,
    description,
  })
}

export async function getBookingApprovedEmail(
  organizationId: string,
  bookingTitle: string,
  resourceName: string,
  date: string,
  time: string,
  adminNote?: string | null
) {
  const customTemplate = await getEmailTemplate(organizationId, "approved")
  const defaultTemplates = getDefaultEmailTemplates()
  const template = customTemplate || {
    subject: defaultTemplates.approved.subject,
    htmlBody: defaultTemplates.approved.htmlBody,
  }

  return renderEmailTemplate(template, {
    bookingTitle,
    resourceName,
    date,
    time,
    adminNote: adminNote || "",
  })
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

  return renderEmailTemplate(template, {
    bookingTitle,
    resourceName,
    date,
    time,
    reason,
  })
}
