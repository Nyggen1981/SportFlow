import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getVippsClient } from "@/lib/vipps"

/**
 * Get payment status
 * GET /api/payment/[id]/status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            user: true,
          },
        },
        invoice: true,
        organization: true,
      },
    })

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    // Check if user has access to this payment
    if (
      payment.booking?.userId !== session.user.id &&
      payment.organizationId !== session.user.organizationId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // If payment has Vipps order ID, get latest status from Vipps
    let vippsStatus = null
    if (payment.vippsOrderId) {
      try {
        const vippsClient = await getVippsClient(payment.organizationId)
        vippsStatus = await vippsClient.getPaymentStatus(payment.vippsOrderId)
      } catch (error) {
        console.error("Error fetching Vipps status:", error)
        // Continue without Vipps status
      }
    }

    return NextResponse.json({
      payment: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        createdAt: payment.createdAt,
        completedAt: payment.completedAt,
        vippsOrderId: payment.vippsOrderId,
        vippsStatus,
      },
    })
  } catch (error: any) {
    console.error("Error getting payment status:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get payment status" },
      { status: 500 }
    )
  }
}


