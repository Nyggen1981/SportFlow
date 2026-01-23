import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { generateInvoicePDF } from "@/lib/invoice-pdf"
import { formatInTimeZone } from "date-fns-tz"
import { nb } from "date-fns/locale"

const TIMEZONE = "Europe/Oslo"

/**
 * Generate a preview invoice PDF for a booking (before approval)
 * GET /api/admin/bookings/[id]/invoice-preview
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const isAdmin = session.user.role === "admin"
  const isModerator = session.user.role === "moderator"
  
  if (!isAdmin && !isModerator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Fetch booking with all necessary data
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      user: true,
      resource: true,
      resourcePart: true,
      organization: {
        select: {
          id: true,
          name: true,
          logo: true,
          isMvaRegistered: true,
          invoiceAddress: true,
          invoicePhone: true,
          invoiceEmail: true,
          invoiceOrgNumber: true,
          invoiceBankAccount: true,
          invoiceNotes: true,
        }
      }
    }
  })

  if (!booking || booking.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  if (!booking.totalAmount || Number(booking.totalAmount) <= 0) {
    return NextResponse.json({ error: "Booking has no amount to invoice" }, { status: 400 })
  }

  // Generate preview invoice number
  const year = new Date().getFullYear()
  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      organizationId: booking.organizationId,
      invoiceNumber: {
        startsWith: `${year}-`
      }
    },
    orderBy: {
      invoiceNumber: "desc"
    }
  })

  let invoiceNumber: string
  if (lastInvoice) {
    const lastNumber = parseInt(lastInvoice.invoiceNumber.split("-")[1] || "0")
    invoiceNumber = `${year}-${String(lastNumber + 1).padStart(4, "0")}`
  } else {
    invoiceNumber = `${year}-0001`
  }

  // Calculate amounts
  const isMvaRegistered = booking.organization?.isMvaRegistered ?? false
  const taxRate = isMvaRegistered ? 0.25 : 0
  const totalAmount = Number(booking.totalAmount)
  const subtotal = isMvaRegistered ? totalAmount / (1 + taxRate) : totalAmount
  const taxAmount = isMvaRegistered ? totalAmount - subtotal : 0

  // Due date (14 days from now)
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 14)

  // Clean title
  const cleanTitle = booking.title
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "")
    .replace(/\s+/g, " ")
    .trim()

  const resourceName = booking.resourcePart 
    ? `${booking.resource.name} - ${booking.resourcePart.name}` 
    : booking.resource.name

  const startDate = formatInTimeZone(new Date(booking.startTime), TIMEZONE, "d. MMM yyyy", { locale: nb })
  const endDate = formatInTimeZone(new Date(booking.endTime), TIMEZONE, "d. MMM yyyy", { locale: nb })
  const startTime = formatInTimeZone(new Date(booking.startTime), TIMEZONE, "HH:mm", { locale: nb })
  const endTime = formatInTimeZone(new Date(booking.endTime), TIMEZONE, "HH:mm", { locale: nb })
  
  const dateTime = startDate === endDate 
    ? `${startDate} ${startTime} - ${endTime}`
    : `${startDate} ${startTime} - ${endDate} ${endTime}`

  // Generate PDF
  const pdfBuffer = await generateInvoicePDF({
    invoiceNumber: `${invoiceNumber} (FORHÅNDSVISNING)`,
    invoiceDate: new Date(),
    dueDate,
    organization: {
      name: booking.organization?.name || "",
      logo: booking.organization?.logo,
      invoiceAddress: booking.organization?.invoiceAddress,
      invoicePhone: booking.organization?.invoicePhone,
      invoiceEmail: booking.organization?.invoiceEmail,
      invoiceOrgNumber: booking.organization?.invoiceOrgNumber,
      invoiceBankAccount: booking.organization?.invoiceBankAccount,
      invoiceNotes: booking.organization?.invoiceNotes,
    },
    billing: {
      name: booking.contactName || booking.user.name || "",
      email: booking.contactEmail || booking.user.email || "",
      phone: booking.contactPhone || booking.user.phone || null,
      address: null,
    },
    items: [{
      description: cleanTitle,
      resourceName: resourceName,
      dateTime: dateTime,
      quantity: 1,
      unitPrice: subtotal,
      total: subtotal,
    }],
    subtotal,
    taxRate,
    taxAmount,
    totalAmount,
    notes: null,
  })

  // Convert Buffer to Uint8Array for NextResponse
  const uint8Array = new Uint8Array(pdfBuffer)
  return new NextResponse(uint8Array, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Faktura_Forhandsvisning_${invoiceNumber}.pdf"`,
      "Content-Length": uint8Array.length.toString(),
    },
  })
}
