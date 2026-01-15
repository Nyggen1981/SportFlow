import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Vipps webhook handler
 * POST /api/payment/webhook
 * 
 * This endpoint receives callbacks from Vipps when payment status changes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Vipps webhook structure
    const {
      orderId,
      transactionInfo,
      userDetails,
    }: {
      orderId: string
      transactionInfo: {
        status: string
        transactionId: string
        amount: number
        timeStamp: string
      }
      userDetails?: {
        userId?: string
        phoneNumber?: string
        email?: string
      }
    } = body

    if (!orderId || !transactionInfo) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Find payment by Vipps order ID
    const payment = await prisma.payment.findFirst({
      where: { vippsOrderId: orderId },
      include: {
        booking: true,
        invoice: true,
      },
    })

    if (!payment) {
      console.error(`Payment not found for Vipps order ID: ${orderId}`)
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    // Update payment status based on Vipps response
    let paymentStatus: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" =
      "PENDING"

    switch (transactionInfo.status) {
      case "RESERVED":
        paymentStatus = "PROCESSING"
        break
      case "CAPTURED":
      case "SALE":
        paymentStatus = "COMPLETED"
        break
      case "CANCELLED":
      case "VOIDED":
        paymentStatus = "FAILED"
        break
      default:
        paymentStatus = "PENDING"
    }

    // Update payment record
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: paymentStatus,
        vippsTransactionId: transactionInfo.transactionId,
        completedAt:
          paymentStatus === "COMPLETED" ? new Date() : payment.completedAt,
        metadata: {
          ...((payment.metadata as any) || {}),
          lastWebhook: {
            timestamp: transactionInfo.timeStamp,
            status: transactionInfo.status,
            transactionId: transactionInfo.transactionId,
          },
        },
      },
    })

    // If payment is completed, update booking
    if (paymentStatus === "COMPLETED" && payment.booking) {
      // Booking er allerede knyttet til payment, så vi trenger ikke oppdatere totalAmount
      // Payment status er det viktige som vises i UI
      console.log(`[Vipps Webhook] Payment ${payment.id} completed for booking ${payment.booking.id}`)
    }

    // If payment is completed and linked to invoice, update invoice
    if (paymentStatus === "COMPLETED" && payment.invoice) {
      // Check if invoice is fully paid
      const totalPaid = await prisma.payment.aggregate({
        where: {
          invoiceId: payment.invoice.id,
          status: "COMPLETED",
        },
        _sum: {
          amount: true,
        },
      })

      const paidAmount = totalPaid._sum.amount || 0

      if (paidAmount >= payment.invoice.totalAmount) {
        await prisma.invoice.update({
          where: { id: payment.invoice.id },
          data: {
            status: "PAID",
            paidAt: new Date(),
          },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error processing Vipps webhook:", error)
    return NextResponse.json(
      { error: error.message || "Failed to process webhook" },
      { status: 500 }
    )
  }
}


