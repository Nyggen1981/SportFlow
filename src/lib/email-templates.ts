import { prisma } from "./prisma"

// Variable replacement function
function replaceVariables(template: string, variables: Record<string, string | undefined>): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g")
    result = result.replace(regex, value || "")
  }
  return result
}

// Check if EmailTemplate model is available in Prisma Client
function isEmailTemplateAvailable(): boolean {
  try {
    // Check if prisma.emailTemplate exists and is a function/object
    const emailTemplate = (prisma as any).emailTemplate
    if (typeof emailTemplate === 'undefined' || emailTemplate === null) {
      return false
    }
    if (typeof emailTemplate.findUnique !== 'function') {
      return false
    }
    return true
  } catch (error) {
    console.warn('Error checking EmailTemplate availability:', error)
    return false
  }
}

// Get email template from database or return null
export async function getEmailTemplate(
  organizationId: string,
  templateType: "new_booking" | "approved" | "rejected" | "cancelled_by_admin" | "cancelled_by_user" | "paid"
) {
  // First check if the model is available
  if (!isEmailTemplateAvailable()) {
    return null
  }

  try {
    const template = await (prisma as any).emailTemplate.findUnique({
      where: {
        organizationId_templateType: {
          organizationId,
          templateType,
        },
      },
    })
    return template
  } catch (error: any) {
    // If table doesn't exist yet (P2021) or other Prisma errors, return null to use defaults
    const errorMessage = error?.message || String(error)
    const errorCode = error?.code
    
    if (
      errorCode === "P2021" || 
      errorCode === "P2001" || 
      errorCode === "P2025" ||
      errorMessage?.includes("does not exist") ||
      errorMessage?.includes("Unknown arg") ||
      errorMessage?.includes("emailTemplate") ||
      errorMessage?.includes("Cannot read property") ||
      errorMessage?.includes("is not a function") ||
      errorMessage?.includes("Cannot find module") ||
      error?.name === "TypeError"
    ) {
      // Silently use defaults - this is expected if table doesn't exist yet
      return null
    }
    // Log unexpected errors
    console.error("Unexpected error fetching email template:", {
      code: errorCode,
      message: errorMessage,
      name: error?.name,
      stack: error?.stack
    })
    return null
  }
}

// Get default email templates (fallback)
export function getDefaultEmailTemplates() {
  return {
    new_booking: {
      subject: "Ny bookingforespørsel: {{bookingTitle}}",
      htmlBody: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
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
                <p><strong>Arrangement:</strong> {{bookingTitle}}</p>
                <p><strong>Fasilitet:</strong> {{resourceName}}</p>
                <p><strong>Dato:</strong> {{date}}</p>
                <p><strong>Tid:</strong> {{time}}</p>
                <p><strong>Booket av:</strong> {{userName}} ({{userEmail}})</p>
                {{#if description}}<p><strong>Beskrivelse:</strong> {{description}}</p>{{/if}}
              </div>
              
              <p>Logg inn i admin-panelet for å godkjenne eller avslå bookingen.</p>
            </div>
            <div class="footer">
              <p>Med vennlig hilsen,<br/>{{organizationName}}</p>
            </div>
          </div>
        </body>
        </html>
      `,
    },
    approved: {
      subject: "Booking godkjent: {{bookingTitle}}",
      htmlBody: `
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
                <p><strong>Arrangement:</strong> {{bookingTitle}}</p>
                <p><strong>Fasilitet:</strong> {{resourceName}}</p>
                <p><strong>Dato:</strong> {{date}}</p>
                <p><strong>Tid:</strong> {{time}}</p>
              </div>
              
              {{#if adminNote}}
              <div class="info-box" style="background: #fef3c7; border-left-color: #f59e0b;">
                <p style="margin: 0; font-weight: 600; color: #92400e; margin-bottom: 8px;">📋 Viktig informasjon:</p>
                <p style="margin: 0; color: #78350f;">{{adminNote}}</p>
              </div>
              {{/if}}
              
              <p>Vi gleder oss til å se deg!</p>
            </div>
            <div class="footer">
              <p>Med vennlig hilsen,<br/>{{organizationName}}</p>
            </div>
          </div>
        </body>
        </html>
      `,
    },
    rejected: {
      subject: "Booking avslått: {{bookingTitle}}",
      htmlBody: `
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
                <p><strong>Arrangement:</strong> {{bookingTitle}}</p>
                <p><strong>Fasilitet:</strong> {{resourceName}}</p>
                <p><strong>Dato:</strong> {{date}}</p>
                <p><strong>Tid:</strong> {{time}}</p>
                {{#if reason}}<p><strong>Årsak:</strong> {{reason}}</p>{{/if}}
              </div>
              
              <p>Ta kontakt hvis du har spørsmål eller ønsker å booke en annen tid.</p>
            </div>
            <div class="footer">
              <p>Med vennlig hilsen,<br/>{{organizationName}}</p>
            </div>
          </div>
        </body>
        </html>
      `,
    },
    cancelled_by_admin: {
      subject: "Booking kansellert: {{bookingTitle}}",
      htmlBody: `
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
                <p><strong>Arrangement:</strong> {{bookingTitle}}</p>
                <p><strong>Fasilitet:</strong> {{resourceName}}</p>
                <p><strong>Dato:</strong> {{date}}</p>
                <p><strong>Tid:</strong> {{time}}</p>
                {{#if reason}}<p><strong>Årsak:</strong> {{reason}}</p>{{/if}}
              </div>
              
              <p>Ta kontakt hvis du har spørsmål.</p>
            </div>
            <div class="footer">
              <p>Med vennlig hilsen,<br/>{{organizationName}}</p>
            </div>
          </div>
        </body>
        </html>
      `,
    },
    cancelled_by_user: {
      subject: "Booking kansellert av bruker: {{bookingTitle}}",
      htmlBody: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
            .reason-box { background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
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
                <p><strong>Arrangement:</strong> {{bookingTitle}}</p>
                <p><strong>Fasilitet:</strong> {{resourceName}}</p>
                <p><strong>Dato:</strong> {{date}}</p>
                <p><strong>Tid:</strong> {{time}}</p>
                <p><strong>Bruker:</strong> {{userName}} ({{userEmail}})</p>
              </div>
              
              {{#if reason}}
              <div class="reason-box">
                <p style="margin: 0; font-weight: 600; color: #92400e; margin-bottom: 8px;">Grunn for kansellering:</p>
                <p style="margin: 0; color: #78350f; white-space: pre-wrap;">{{reason}}</p>
              </div>
              {{/if}}
            </div>
            <div class="footer">
              <p>Med vennlig hilsen,<br/>{{organizationName}}</p>
            </div>
          </div>
        </body>
        </html>
      `,
    },
    paid: {
      subject: "Betaling registrert: {{bookingTitle}}",
      htmlBody: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
            .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">✓ Betaling registrert</h1>
            </div>
            <div class="content">
              <p>Hei! Vi har registrert betalingen for din booking:</p>
              
              <div class="info-box">
                <p><strong>Arrangement:</strong> {{bookingTitle}}</p>
                <p><strong>Fasilitet:</strong> {{resourceName}}</p>
                <p><strong>Dato:</strong> {{date}}</p>
                <p><strong>Tid:</strong> {{time}}</p>
              </div>
              
              {{#if adminNote}}
              <div class="info-box" style="background: #fef3c7; border-left-color: #f59e0b;">
                <p style="margin: 0; font-weight: 600; color: #92400e; margin-bottom: 8px;">📋 Viktig informasjon:</p>
                <p style="margin: 0; color: #78350f;">{{adminNote}}</p>
              </div>
              {{/if}}
              
              {{#if customMessage}}
              <div class="info-box" style="background: #eff6ff; border-left-color: #3b82f6;">
                <p style="margin: 0; color: #1e40af;">{{customMessage}}</p>
              </div>
              {{/if}}
              
              <p>Takk for betalingen! Vi gleder oss til å se deg.</p>
            </div>
            <div class="footer">
              <p>Med vennlig hilsen,<br/>{{organizationName}}</p>
            </div>
          </div>
        </body>
        </html>
      `,
    },
  }
}

// Render email template with variables
export function renderEmailTemplate(
  template: { subject: string; htmlBody: string },
  variables: Record<string, string | undefined>
): { subject: string; html: string } {
  // Simple variable replacement (remove Handlebars-style conditionals for now)
  let htmlBody = template.htmlBody
  htmlBody = htmlBody.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, varName, content) => {
    return variables[varName] ? content : ""
  })

  return {
    subject: replaceVariables(template.subject, variables),
    html: replaceVariables(htmlBody, variables),
  }
}

