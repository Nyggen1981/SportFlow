/**
 * Vipps API Client
 * Handles communication with Vipps API for payment processing
 */

interface VippsConfig {
  clientId: string
  clientSecret: string
  subscriptionKey: string
  testMode: boolean
}

interface VippsAccessToken {
  access_token: string
  token_type: string
  expires_in: number
  expires_at: number
}

interface VippsPaymentRequest {
  amount: number // Amount in øre (e.g., 10000 = 100 NOK)
  currency: string // "NOK"
  reference: string // Unique reference for this payment
  userFlow: "WEB_REDIRECT" | "NATIVE_REDIRECT"
  returnUrl: string
  cancelUrl: string
  consentRemovalPrefix?: string
  shippingDetailsPrefix?: string
  paymentDescription: string
  userDetails?: {
    userId?: string
    phoneNumber?: string
    email?: string
  }
}

interface VippsPaymentResponse {
  orderId: string
  url: string
}

class VippsClient {
  private config: VippsConfig
  private accessToken: VippsAccessToken | null = null

  constructor(config: VippsConfig) {
    this.config = config
  }

  /**
   * Get base URL for Vipps API
   */
  private getBaseUrl(): string {
    if (this.config.testMode) {
      return "https://apitest.vipps.no"
    }
    return "https://api.vipps.no"
  }

  /**
   * Get access token from Vipps OAuth endpoint
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (
      this.accessToken &&
      Date.now() < this.accessToken.expires_at - 60000 // Refresh 1 minute before expiry
    ) {
      return this.accessToken.access_token
    }

    const auth = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString("base64")

    const response = await fetch(`${this.getBaseUrl()}/accessToken/get`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to get Vipps access token: ${error}`)
    }

    const data = await response.json()
    const accessToken = {
      ...data,
      expires_at: Date.now() + data.expires_in * 1000,
    }
    this.accessToken = accessToken

    return accessToken.access_token
  }

  /**
   * Create a payment request
   */
  async createPayment(
    request: VippsPaymentRequest
  ): Promise<VippsPaymentResponse> {
    const token = await this.getAccessToken()

    const response = await fetch(
      `${this.getBaseUrl()}/ecomm/v2/payments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
          "Content-Type": "application/json",
          "X-Request-Id": crypto.randomUUID(),
        },
        body: JSON.stringify({
          merchantInfo: {
            merchantSerialNumber: this.config.clientId,
            callbackPrefix: process.env.VIPPS_CALLBACK_URL || `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/payment/webhook`,
            fallBack: request.returnUrl,
            consentRemovalPrefix: request.consentRemovalPrefix,
            shippingDetailsPrefix: request.shippingDetailsPrefix,
            isApp: false,
          },
          transaction: {
            orderId: request.reference,
            amount: request.amount,
            transactionText: request.paymentDescription,
          },
          customerInfo: request.userDetails,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to create Vipps payment: ${error}`)
    }

    const data = await response.json()
    return {
      orderId: data.orderId,
      url: data.url,
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(orderId: string): Promise<any> {
    const token = await this.getAccessToken()

    const response = await fetch(
      `${this.getBaseUrl()}/ecomm/v2/payments/${orderId}/status`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
          "X-Request-Id": crypto.randomUUID(),
        },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to get Vipps payment status: ${error}`)
    }

    return await response.json()
  }

  /**
   * Cancel a payment
   */
  async cancelPayment(orderId: string): Promise<void> {
    const token = await this.getAccessToken()

    const response = await fetch(
      `${this.getBaseUrl()}/ecomm/v2/payments/${orderId}/cancel`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
          "Content-Type": "application/json",
          "X-Request-Id": crypto.randomUUID(),
        },
        body: JSON.stringify({
          merchantInfo: {
            merchantSerialNumber: this.config.clientId,
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to cancel Vipps payment: ${error}`)
    }
  }

  /**
   * Capture a payment (for reserved payments)
   */
  async capturePayment(orderId: string, amount: number): Promise<void> {
    const token = await this.getAccessToken()

    const response = await fetch(
      `${this.getBaseUrl()}/ecomm/v2/payments/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
          "Content-Type": "application/json",
          "X-Request-Id": crypto.randomUUID(),
        },
        body: JSON.stringify({
          merchantInfo: {
            merchantSerialNumber: this.config.clientId,
          },
          transaction: {
            amount: amount,
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to capture Vipps payment: ${error}`)
    }
  }
}

/**
 * Get Vipps client for an organization
 */
export async function getVippsClient(organizationId: string) {
  const { prisma } = await import("./prisma")
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      vippsClientId: true,
      vippsClientSecret: true,
      vippsSubscriptionKey: true,
      vippsTestMode: true,
    },
  })

  if (
    !org?.vippsClientId ||
    !org?.vippsClientSecret ||
    !org?.vippsSubscriptionKey
  ) {
    throw new Error("Vipps is not configured for this organization")
  }

  return new VippsClient({
    clientId: org.vippsClientId,
    clientSecret: org.vippsClientSecret,
    subscriptionKey: org.vippsSubscriptionKey,
    testMode: org.vippsTestMode ?? true,
  })
}

export type { VippsPaymentRequest, VippsPaymentResponse }

/**
 * Send Vipps payment link to customer via email
 */
export async function sendVippsPaymentEmail(
  paymentId: string,
  vippsUrl: string,
  organizationId: string
): Promise<boolean> {
  const { prisma } = await import("./prisma")
  const { sendEmail } = await import("./email")
  const { format } = await import("date-fns")
  const { nb } = await import("date-fns/locale")
  const { formatInTimeZone } = await import("date-fns-tz")
  const TIMEZONE = "Europe/Oslo"

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      booking: {
        include: {
          resource: true,
          resourcePart: true,
          user: true
        }
      },
      organization: {
        select: {
          name: true
        }
      }
    }
  })

  if (!payment || !payment.booking) {
    throw new Error("Payment or booking not found")
  }

  const booking = payment.booking
  const resourceName = booking.resourcePart 
    ? `${booking.resource.name} → ${booking.resourcePart.name}`
    : booking.resource.name

  const date = formatInTimeZone(new Date(booking.startTime), TIMEZONE, "EEEE d. MMMM yyyy", { locale: nb })
  const time = `${formatInTimeZone(new Date(booking.startTime), TIMEZONE, "HH:mm")} - ${formatInTimeZone(new Date(booking.endTime), TIMEZONE, "HH:mm")}`

  const billingEmail = booking.contactEmail || booking.user.email
  if (!billingEmail) {
    throw new Error("No email address found for booking")
  }

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
            <p><strong>Beløp:</strong> ${Number(payment.amount).toFixed(2)} kr</p>
          </div>

          <div class="payment-box">
            <p style="margin-top: 0; font-size: 18px; font-weight: 600; color: #1f2937;">
              Betal ${Number(payment.amount).toFixed(2)} kr med Vipps
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
          <p>Med vennlig hilsen,<br/>${payment.organization.name}</p>
        </div>
      </div>
    </body>
    </html>
  `

  return await sendEmail(organizationId, {
    to: billingEmail,
    subject: `Betal booking: ${booking.title}`,
    html
  })
}


