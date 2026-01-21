import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const isAdmin = session.user.role === "admin"
  const isModerator = session.user.role === "moderator"

  if (!isAdmin && !isModerator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if organizationId exists
  if (!session.user.organizationId) {
    console.error("Missing organizationId in session:", session.user)
    return NextResponse.json(
      { error: "Missing organization ID" },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")

  // Get moderator's assigned resources
  let resourceIds: string[] | undefined
  if (isModerator) {
    const moderatorResources = await prisma.resourceModerator.findMany({
      where: { userId: session.user.id },
      select: { resourceId: true }
    })
    resourceIds = moderatorResources.map(mr => mr.resourceId)
    if (resourceIds.length === 0) {
      return NextResponse.json([])
    }
  }

  try {
    const bookings = await prisma.booking.findMany({
      where: {
        organizationId: session.user.organizationId,
        ...(status === "pending" ? { status: "pending" } : {}),
        ...(isModerator && resourceIds ? { resourceId: { in: resourceIds } } : {})
      },
      select: {
        id: true,
        title: true,
        description: true,
        startTime: true,
        endTime: true,
        status: true,
        statusNote: true,
        // TODO: Re-enable after Vercel cache is cleared
        // adminNote: true, // Internal admin note - NOT shown to users
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        totalAmount: true,
        invoiceId: true,
        // Recurring booking fields for grouping
        isRecurring: true,
        parentBookingId: true,
        invoice: {
          select: {
            id: true,
            status: true,
            invoiceNumber: true
          }
        },
        preferredPaymentMethod: true,
        resource: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        resourcePart: {
          select: {
            id: true,
            name: true
          }
        },
        user: {
          select: { 
            name: true, 
            email: true 
          }
        },
        payments: {
          select: {
            id: true,
            status: true,
            paymentMethod: true,
            amount: true
          }
        }
      },
      orderBy: [
        { status: "asc" },
        { startTime: "asc" }
      ]
    })

    // Serialize bookings to ensure Decimal types are converted to numbers
    const serializedBookings = bookings.map(booking => ({
      ...booking,
      totalAmount: booking.totalAmount ? Number(booking.totalAmount) : null,
      payments: booking.payments.map(payment => ({
        ...payment,
        amount: payment.amount ? Number(payment.amount) : 0
      }))
    }))

    return NextResponse.json(serializedBookings)
  } catch (error: any) {
    console.error("Error fetching admin bookings:", error)
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack
    })
    return NextResponse.json(
      { 
        error: "Failed to fetch bookings",
        details: error?.message || "Unknown error",
        code: error?.code || "UNKNOWN"
      },
      { status: 500 }
    )
  }
}

