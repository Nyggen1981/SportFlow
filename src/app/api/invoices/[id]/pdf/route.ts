import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateInvoicePDF } from "@/lib/invoice-pdf"
import { formatInTimeZone } from "date-fns-tz"
import { nb } from "date-fns/locale"

const TIMEZONE = "Europe/Oslo"

/**
 * Download invoice as PDF
 * GET /api/invoices/[id]/pdf
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

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            name: true,
            logo: true,
            invoiceAddress: true,
            invoicePhone: true,
            invoiceEmail: true,
            invoiceOrgNumber: true,
            invoiceBankAccount: true,
            invoiceNotes: true,
          },
        },
        bookings: {
          include: {
            resource: true,
            resourcePart: true,
            user: true,
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Check if user has access (admin or invoice owner)
    const isAdmin = session.user.role === "admin"
    const isOwner = invoice.billingEmail === session.user.email

    if (!isAdmin && !isOwner) {
      if (invoice.organizationId !== session.user.organizationId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Generate PDF
    const resourceName = invoice.bookings[0]?.resourcePart
      ? `${invoice.bookings[0].resource.name} → ${invoice.bookings[0].resourcePart.name}`
      : invoice.bookings[0]?.resource.name || "Ukjent fasilitet"

    const invoiceDate = invoice.createdAt
    const pdfBuffer = await generateInvoicePDF({
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate,
      dueDate: invoice.dueDate,
      organization: {
        name: invoice.organization.name,
        logo: invoice.organization.logo,
        invoiceAddress: invoice.organization.invoiceAddress,
        invoicePhone: invoice.organization.invoicePhone,
        invoiceEmail: invoice.organization.invoiceEmail,
        invoiceOrgNumber: invoice.organization.invoiceOrgNumber,
        invoiceBankAccount: invoice.organization.invoiceBankAccount,
        invoiceNotes: invoice.organization.invoiceNotes,
      },
      billing: {
        name: invoice.billingName,
        email: invoice.billingEmail,
        phone: invoice.billingPhone,
        address: invoice.billingAddress,
      },
      items: invoice.bookings.map((b) => {
        // Clean up title - remove ALL & characters
        let cleanTitle = b.title
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
          .trim();
        
        const resourceName = b.resourcePart 
          ? `${b.resource.name} - ${b.resourcePart.name}` 
          : b.resource.name;
        
        // Sjekk om bookingen går over flere dager
        const startDate = formatInTimeZone(new Date(b.startTime), TIMEZONE, "d. MMM yyyy", { locale: nb });
        const endDate = formatInTimeZone(new Date(b.endTime), TIMEZONE, "d. MMM yyyy", { locale: nb });
        const startTime = formatInTimeZone(new Date(b.startTime), TIMEZONE, "HH:mm", { locale: nb });
        const endTime = formatInTimeZone(new Date(b.endTime), TIMEZONE, "HH:mm", { locale: nb });
        
        // Hvis samme dag, vis bare én dato. Ellers vis begge datoer.
        const dateTime = startDate === endDate 
          ? `${startDate} ${startTime} - ${endTime}`
          : `${startDate} ${startTime} - ${endDate} ${endTime}`;
        
        return {
          description: cleanTitle,
          resourceName: resourceName,
          dateTime: dateTime,
          quantity: 1,
          unitPrice: Number(b.totalAmount || 0) / (1 + Number(invoice.taxRate)),
          total: Number(b.totalAmount || 0) / (1 + Number(invoice.taxRate)),
        };
      }),
      subtotal: Number(invoice.subtotal),
      taxRate: Number(invoice.taxRate),
      taxAmount: Number(invoice.taxAmount),
      totalAmount: Number(invoice.totalAmount),
      notes: invoice.notes,
    })

    // Return PDF - convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(pdfBuffer)
    return new NextResponse(uint8Array, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Faktura_${invoice.invoiceNumber}.pdf"`,
        "Content-Length": uint8Array.length.toString(),
      },
    })
  } catch (error: any) {
    console.error("Error generating invoice PDF:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate invoice PDF" },
      { status: 500 }
    )
  }
}

