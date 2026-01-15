import { prisma } from "./prisma"
import { format } from "date-fns"
import { nb } from "date-fns/locale"
import { formatInTimeZone } from "date-fns-tz"
import { sendVippsPaymentEmail } from "./vipps"

const TIMEZONE = "Europe/Oslo"

/**
 * Generer preview av faktura e-post (uten å sende)
 */
export async function getInvoiceEmailPreview(
  invoiceId: string,
  organizationId: string
): Promise<{ subject: string; html: string }> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      organization: {
        select: {
          name: true
        }
      },
      bookings: {
        include: {
          resource: true,
          resourcePart: true
        }
      }
    }
  })

  if (!invoice) {
    throw new Error("Invoice not found")
  }

  const booking = invoice.bookings[0]
  if (!booking) {
    throw new Error("Invoice has no bookings")
  }

  const resourceName = booking.resourcePart 
    ? `${booking.resource.name} → ${booking.resourcePart.name}`
    : booking.resource.name

  const date = formatInTimeZone(new Date(booking.startTime), TIMEZONE, "EEEE d. MMMM yyyy", { locale: nb })
  const time = `${formatInTimeZone(new Date(booking.startTime), TIMEZONE, "HH:mm")} - ${formatInTimeZone(new Date(booking.endTime), TIMEZONE, "HH:mm")}`
  const dueDateFormatted = format(new Date(invoice.dueDate), "d. MMMM yyyy", { locale: nb })

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
        .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
        .invoice-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .invoice-details table { width: 100%; border-collapse: collapse; }
        .invoice-details td { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .invoice-details td:last-child { text-align: right; font-weight: 600; }
        .total-row { font-size: 18px; font-weight: 700; color: #1f2937; }
        .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">Faktura ${invoice.invoiceNumber}</h1>
        </div>
        <div class="content">
          <p>Hei ${invoice.billingName},</p>
          
          <p>Takk for din booking! Vedlagt finner du faktura for følgende booking:</p>
          
          <div class="info-box">
            <p><strong>Arrangement:</strong> ${booking.title}</p>
            <p><strong>Fasilitet:</strong> ${resourceName}</p>
            <p><strong>Dato:</strong> ${date}</p>
            <p><strong>Tid:</strong> ${time}</p>
          </div>

          <div class="invoice-details">
            <h3 style="margin-top: 0;">Fakturaoversikt</h3>
            <table>
              ${Number(invoice.taxRate) > 0 ? `
              <tr>
                <td>Beløp eks. MVA:</td>
                <td>${Number(invoice.subtotal).toFixed(2)} kr</td>
              </tr>
              <tr>
                <td>MVA (${(Number(invoice.taxRate) * 100).toFixed(0)}%):</td>
                <td>${Number(invoice.taxAmount).toFixed(2)} kr</td>
              </tr>
              <tr class="total-row">
                <td>Totalt inkl. MVA:</td>
                <td>${Number(invoice.totalAmount).toFixed(2)} kr</td>
              </tr>
              ` : `
              <tr class="total-row">
                <td>Totalt:</td>
                <td>${Number(invoice.totalAmount).toFixed(2)} kr</td>
              </tr>
              `}
            </table>
            <p style="margin-top: 20px; color: #64748b; font-size: 14px;">
              <strong>Forfallsdato:</strong> ${dueDateFormatted}
            </p>
          </div>

          <p>Vennligst betal innen forfallsdatoen.</p>
        </div>
        <div class="footer">
          <p>Med vennlig hilsen,<br/>${invoice.organization.name}</p>
        </div>
      </div>
    </body>
    </html>
  `

  return {
    subject: `Faktura ${invoice.invoiceNumber} - ${booking.title}`,
    html
  }
}

/**
 * Generer preview av Vipps betalingslink e-post (uten å opprette faktisk betaling)
 */
export async function getVippsPaymentEmailPreview(
  bookingId: string,
  organizationId: string,
  amount: number
): Promise<{ subject: string; html: string }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      resource: true,
      resourcePart: true,
      user: true,
      organization: {
        select: {
          name: true
        }
      }
    }
  })

  if (!booking) {
    throw new Error("Booking not found")
  }

  const resourceName = booking.resourcePart 
    ? `${booking.resource.name} → ${booking.resourcePart.name}`
    : booking.resource.name

  const date = formatInTimeZone(new Date(booking.startTime), TIMEZONE, "EEEE d. MMMM yyyy", { locale: nb })
  const time = `${formatInTimeZone(new Date(booking.startTime), TIMEZONE, "HH:mm")} - ${formatInTimeZone(new Date(booking.endTime), TIMEZONE, "HH:mm")}`

  const billingEmail = booking.contactEmail || booking.user.email
  if (!billingEmail) {
    throw new Error("No email address found for booking")
  }

  // Bruk en placeholder URL for preview
  const vippsUrl = "https://vipps.no/payment/placeholder"

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); color: #1f2937; padding: 30px; border-radius: 12px 12px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
        .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffd700; }
        .payment-box { background: white; padding: 30px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid #ffd700; }
        .payment-button { display: inline-block; background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); color: #1f2937; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 18px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">💰 Betal med Vipps</h1>
        </div>
        <div class="content">
          <p>Hei ${booking.contactName || booking.user.name || "Kunde"},</p>
          
          <p>Din booking har blitt godkjent! Klikk på knappen under for å betale med Vipps:</p>
          
          <div class="info-box">
            <p><strong>Arrangement:</strong> ${booking.title}</p>
            <p><strong>Fasilitet:</strong> ${resourceName}</p>
            <p><strong>Dato:</strong> ${date}</p>
            <p><strong>Tid:</strong> ${time}</p>
            <p><strong>Beløp:</strong> ${amount.toFixed(2)} kr</p>
          </div>

          <div class="payment-box">
            <p style="margin-top: 0; font-size: 18px; font-weight: 600; color: #1f2937;">
              Betal ${amount.toFixed(2)} kr med Vipps
            </p>
            <a href="${vippsUrl}" class="payment-button">Betal med Vipps</a>
            <p style="margin-bottom: 0; color: #64748b; font-size: 14px;">
              Eller kopier denne lenken: <br/>
              <a href="${vippsUrl}" style="color: #3b82f6; word-break: break-all;">${vippsUrl}</a>
            </p>
          </div>

          <p style="color: #64748b; font-size: 14px;">
            <strong>Merk:</strong> Du kan også betale senere ved å gå til "Mine bookinger" i appen.
          </p>
        </div>
        <div class="footer">
          <p>Med vennlig hilsen,<br/>${booking.organization.name}</p>
        </div>
      </div>
    </body>
    </html>
  `

  return {
    subject: `Betal booking: ${booking.title}`,
    html
  }
}

