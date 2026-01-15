import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getVippsClient } from "@/lib/vipps"

/**
 * Create a payment for a booking
 * POST /api/payment/create
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { bookingId, amount, description } = body

    if (!bookingId || !amount) {
      return NextResponse.json(
        { error: "Missing bookingId or amount" },
        { status: 400 }
      )
    }

    // Get booking with organization
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        organization: true,
        user: true,
        resource: true,
        resourcePart: true,
      },
    })

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    // Check if user owns the booking
    if (booking.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Check if organization has Vipps configured
    if (
      !booking.organization.vippsClientId ||
      !booking.organization.vippsClientSecret ||
      !booking.organization.vippsSubscriptionKey
    ) {
      return NextResponse.json(
        { error: "Vipps is not configured for this organization" },
        { status: 400 }
      )
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        organizationId: booking.organizationId,
        bookingId: booking.id,
        paymentType: "BOOKING",
        amount: amount,
        currency: "NOK",
        status: "PENDING",
        paymentMethod: "VIPPS",
        description:
          description ||
          `Betaling for booking: ${booking.title} - ${booking.resource.name}`,
      },
    })

    // Create Vipps payment
    const vippsClient = await getVippsClient(booking.organizationId)
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"

    const vippsPayment = await vippsClient.createPayment({
      amount: Math.round(amount * 100), // Convert to øre
      currency: "NOK",
      reference: payment.id,
      userFlow: "WEB_REDIRECT",
      returnUrl: `${baseUrl}/payment/success?paymentId=${payment.id}`,
      cancelUrl: `${baseUrl}/payment/cancel?paymentId=${payment.id}`,
      paymentDescription:
        description ||
        `Betaling for booking: ${booking.title} - ${booking.resource.name}`,
      userDetails: {
        userId: booking.user.email,
        phoneNumber: booking.user.phone || undefined,
        email: booking.user.email,
      },
    })

    // Update payment with Vipps order ID
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        vippsOrderId: vippsPayment.orderId,
      },
    })

    return NextResponse.json({
      paymentId: payment.id,
      vippsOrderId: vippsPayment.orderId,
      redirectUrl: vippsPayment.url,
    })
  } catch (error: any) {
    console.error("Error creating payment:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create payment" },
      { status: 500 }
    )
  }
}


