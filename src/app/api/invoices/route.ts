import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Get all invoices for the current organization
 * GET /api/invoices
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get("status")

    // Map lowercase filter values to uppercase enum values
    const statusMap: Record<string, string> = {
      "draft": "DRAFT",
      "sent": "SENT",
      "paid": "PAID",
      "overdue": "OVERDUE",
      "cancelled": "CANCELLED",
    }
    const status = statusParam ? (statusMap[statusParam.toLowerCase()] || statusParam.toUpperCase()) : null

    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: session.user.organizationId,
        ...(status && { status: status as any }),
      },
      include: {
        bookings: {
          include: {
            resource: true,
            resourcePart: true,
          },
        },
        payments: {
          select: {
            id: true,
            status: true,
            amount: true,
            paymentMethod: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            bookings: true,
            payments: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ invoices })
  } catch (error: any) {
    console.error("Error fetching invoices:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch invoices" },
      { status: 500 }
    )
  }
}

/**
 * Create a new invoice
 * POST /api/invoices
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can create invoices
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const {
      bookingIds,
      billingName,
      billingEmail,
      billingPhone,
      billingAddress,
      dueDate,
      notes,
      taxRate = 0.25,
    } = body

    if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      return NextResponse.json(
        { error: "At least one booking ID is required" },
        { status: 400 }
      )
    }

    if (!billingName || !billingEmail) {
      return NextResponse.json(
        { error: "Billing name and email are required" },
        { status: 400 }
      )
    }

    // Get bookings
    const bookings = await prisma.booking.findMany({
      where: {
        id: { in: bookingIds },
        organizationId: session.user.organizationId,
      },
      include: {
        resource: true,
        resourcePart: true,
      },
    })

    if (bookings.length !== bookingIds.length) {
      return NextResponse.json(
        { error: "Some bookings were not found" },
        { status: 404 }
      )
    }

    // Calculate subtotal from bookings
    const subtotal = bookings.reduce((sum, booking) => {
      // Calculate price based on duration and resource/part price
      const durationHours =
        (new Date(booking.endTime).getTime() -
          new Date(booking.startTime).getTime()) /
        (1000 * 60 * 60)

      const pricePerHour =
        booking.resourcePart?.pricePerHour ||
        booking.resource.pricePerHour ||
        0

      return sum + Number(pricePerHour) * durationHours
    }, 0)

    const taxAmount = subtotal * taxRate
    const totalAmount = subtotal + taxAmount

    // Generate invoice number
    const year = new Date().getFullYear()
    const lastInvoice = await prisma.invoice.findFirst({
      where: {
        organizationId: session.user.organizationId,
        invoiceNumber: {
          startsWith: `${year}-`,
        },
      },
      orderBy: {
        invoiceNumber: "desc",
      },
    })

    let invoiceNumber = `${year}-001`
    if (lastInvoice) {
      const lastNumber = parseInt(lastInvoice.invoiceNumber.split("-")[1])
      invoiceNumber = `${year}-${String(lastNumber + 1).padStart(3, "0")}`
    }

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: session.user.organizationId,
        invoiceNumber,
        status: "DRAFT",
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Default 14 days
        subtotal,
        taxRate,
        taxAmount,
        totalAmount,
        billingName,
        billingEmail,
        billingPhone,
        billingAddress,
        notes,
        bookings: {
          connect: bookings.map((b) => ({ id: b.id })),
        },
      },
      include: {
        bookings: {
          include: {
            resource: true,
            resourcePart: true,
          },
        },
      },
    })

    return NextResponse.json({ invoice })
  } catch (error: any) {
    console.error("Error creating invoice:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create invoice" },
      { status: 500 }
    )
  }
}


