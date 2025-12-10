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

// Get email template from database or return null
export async function getEmailTemplate(
  organizationId: string,
  templateType: "new_booking" | "approved" | "rejected" | "cancelled_by_admin" | "cancelled_by_user"
) {
  try {
    const template = await prisma.emailTemplate.findUnique({
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
    if (error?.code === "P2021" || error?.code === "P2001" || error?.message?.includes("does not exist")) {
      console.warn(`EmailTemplate table not found, using default templates. Error: ${error.message}`)
      return null
    }
    console.error("Error fetching email template:", error)
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
              <p>Med vennlig hilsen,<br/>Arena Booking</p>
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
              
              <p>Vi gleder oss til å se deg!</p>
            </div>
            <div class="footer">
              <p>Med vennlig hilsen,<br/>Arena Booking</p>
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
              <p>Med vennlig hilsen,<br/>Arena Booking</p>
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
              <p>Med vennlig hilsen,<br/>Arena Booking</p>
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
            </div>
            <div class="footer">
              <p>Med vennlig hilsen,<br/>Arena Booking</p>
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

