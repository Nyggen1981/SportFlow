import nodemailer from "nodemailer"
import { getEmailTemplate, getDefaultEmailTemplates, renderEmailTemplate } from "./email-templates"

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
  time: string
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
