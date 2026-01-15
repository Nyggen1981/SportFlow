import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendInvoiceEmail } from "@/lib/invoice"

/**
 * Send invoice email
 * POST /api/invoices/[id]/send
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAdmin = session.user.role === "admin"
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    if (invoice.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Send invoice email
    const success = await sendInvoiceEmail(invoice.id, invoice.organizationId)

    if (!success) {
      return NextResponse.json(
        { error: "Kunne ikke sende faktura. Sjekk e-postinnstillinger." },
        { status: 500 }
      )
    }

    // Update invoice status to SENT if it was DRAFT
    if (invoice.status === "DRAFT") {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: "SENT" }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error sending invoice:", error)
    return NextResponse.json(
      { error: error.message || "Failed to send invoice" },
      { status: 500 }
    )
  }
}

