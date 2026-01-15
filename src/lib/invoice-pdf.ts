import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { format } from "date-fns"
import { nb } from "date-fns/locale"

interface InvoiceData {
  invoiceNumber: string
  invoiceDate: Date
  dueDate: Date
  organization: {
    name: string
    logo?: string | null
    invoiceAddress?: string | null
    invoicePhone?: string | null
    invoiceEmail?: string | null
    invoiceOrgNumber?: string | null
    invoiceBankAccount?: string | null
    invoiceNotes?: string | null
  }
  billing: {
    name: string
    email: string
    phone?: string | null
    address?: string | null
  }
  items: Array<{
    description: string
    resourceName?: string
    dateTime?: string
    quantity: number
    unitPrice: number
    total: number
  }>
  subtotal: number
  taxRate: number
  taxAmount: number
  totalAmount: number
  notes?: string | null
}

/**
 * Renser tekst for HTML-entities og uønskede tegn
 */
function cleanText(text: string): string {
  if (!text) return "";
  
  let clean = text;
  
  // Decode HTML entities
  clean = clean
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  
  // Remove ALL & characters - they seem to be corrupting the text
  clean = clean.replace(/&/g, "");
  
  // Clean up whitespace
  clean = clean.replace(/\s+/g, " ").trim();
  
  return clean;
}

/**
 * Genererer en PDF-faktura
 */
export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - 2 * margin

  // Colors
  const primaryColor: [number, number, number] = [37, 99, 235]
  const darkGray: [number, number, number] = [31, 41, 55]
  const lightGray: [number, number, number] = [107, 114, 128]
  const bgGray: [number, number, number] = [249, 250, 251]

  let yPos = margin

  // === HEADER SECTION ===
  
  // Title "FAKTURA" on left
  doc.setFontSize(28)
  doc.setTextColor(...primaryColor)
  doc.setFont("helvetica", "bold")
  doc.text("FAKTURA", margin, yPos + 8)

  // Logo on right (if available)
  let logoEndY = yPos
  if (data.organization.logo && data.organization.logo.startsWith("data:image")) {
    try {
      const imgData = data.organization.logo
      const imgFormat = imgData.includes("image/png") ? "PNG" : "JPEG"
      
      // Fixed logo size
      const logoWidth = 25
      const logoHeight = 25
      const logoX = pageWidth - margin - logoWidth
      
      doc.addImage(imgData, imgFormat, logoX, yPos, logoWidth, logoHeight, undefined, "FAST")
      logoEndY = yPos + logoHeight
    } catch (error) {
      console.error("Error adding logo:", error)
    }
  }

  // Organization name below logo
  yPos = Math.max(yPos + 15, logoEndY + 5)
  doc.setFontSize(12)
  doc.setTextColor(...darkGray)
  doc.setFont("helvetica", "bold")
  doc.text(data.organization.name, pageWidth - margin, yPos, { align: "right" })

  // === INVOICE INFO BAR ===
  yPos += 15
  
  // Light gray background bar
  doc.setFillColor(...bgGray)
  doc.rect(margin, yPos - 5, contentWidth, 20, "F")
  
  doc.setFontSize(10)
  doc.setTextColor(...darkGray)
  doc.setFont("helvetica", "normal")
  
  const invoiceDateStr = format(data.invoiceDate, "d. MMM yyyy", { locale: nb })
  const dueDateStr = format(data.dueDate, "d. MMM yyyy", { locale: nb })
  
  // Left: Invoice number
  doc.setFont("helvetica", "bold")
  doc.text("Fakturanr:", margin + 5, yPos + 3)
  doc.setFont("helvetica", "normal")
  doc.text(data.invoiceNumber, margin + 28, yPos + 3)
  
  // Center: Invoice date
  doc.setFont("helvetica", "bold")
  doc.text("Dato:", pageWidth / 2 - 20, yPos + 3)
  doc.setFont("helvetica", "normal")
  doc.text(invoiceDateStr, pageWidth / 2 + 2, yPos + 3)
  
  // Right: Due date
  doc.setFont("helvetica", "bold")
  doc.text("Forfall:", pageWidth - margin - 55, yPos + 3)
  doc.setFont("helvetica", "normal")
  doc.text(dueDateStr, pageWidth - margin - 32, yPos + 3)

  // === BILLING INFO ===
  yPos += 30
  
  const col1X = margin
  const col2X = pageWidth / 2 + 10

  // Headers on same line
  doc.setFontSize(11)
  doc.setTextColor(...primaryColor)
  doc.setFont("helvetica", "bold")
  doc.text("Faktureres til", col1X, yPos)
  doc.text("Fra", col2X, yPos)
  
  // Underlines
  doc.setDrawColor(...primaryColor)
  doc.setLineWidth(0.5)
  doc.line(col1X, yPos + 2, col1X + 35, yPos + 2)
  doc.line(col2X, yPos + 2, col2X + 15, yPos + 2)

  yPos += 8
  doc.setFontSize(10)
  doc.setTextColor(...darkGray)
  doc.setFont("helvetica", "normal")
  
  // Save starting position for both columns
  const contentStartY = yPos
  
  // Left column - Bill to
  let leftY = contentStartY
  doc.text(data.billing.name, col1X, leftY)
  leftY += 5
  doc.text(data.billing.email, col1X, leftY)
  if (data.billing.phone) {
    leftY += 5
    doc.text(data.billing.phone, col1X, leftY)
  }
  if (data.billing.address) {
    leftY += 5
    doc.text(data.billing.address, col1X, leftY)
  }

  // Right column - From (same starting yPos as left column)
  let rightY = contentStartY
  doc.text(data.organization.name, col2X, rightY)
  rightY += 5
  if (data.organization.invoiceAddress) {
    doc.text(data.organization.invoiceAddress, col2X, rightY)
    rightY += 5
  }
  if (data.organization.invoiceOrgNumber) {
    doc.text(`Org.nr: ${data.organization.invoiceOrgNumber}`, col2X, rightY)
    rightY += 5
  }
  if (data.organization.invoicePhone) {
    doc.text(`Tlf: ${data.organization.invoicePhone}`, col2X, rightY)
    rightY += 5
  }
  if (data.organization.invoiceEmail) {
    doc.text(data.organization.invoiceEmail, col2X, rightY)
  }
  
  // Update yPos to the maximum of both columns
  yPos = Math.max(leftY, rightY) + 15

  // === ITEMS TABLE ===

  const tableData = data.items.map((item) => {
    const cleanDescription = cleanText(item.description);
    const resourceName = item.resourceName ? cleanText(item.resourceName) : "";
    const dateTime = item.dateTime || "";
    
    // Combine description, resource, and date on separate lines
    const descriptionLines: string[] = [];
    if (cleanDescription) {
      descriptionLines.push(cleanDescription);
    }
    if (resourceName) {
      descriptionLines.push(resourceName);
    }
    if (dateTime) {
      descriptionLines.push(dateTime);
    }
    
    return [
      descriptionLines.join("\n"),
      item.quantity.toString(),
      `${item.unitPrice.toFixed(2)} kr`,
      `${item.total.toFixed(2)} kr`,
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [["Beskrivelse", "Antall", "Pris", "Sum"]],
    body: tableData,
    theme: "plain",
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 3,
    },
    didParseCell: function (data: any) {
      // Enable multi-line text in description column
      if (data.column.index === 0) {
        data.cell.styles.cellPadding = { top: 3, right: 4, bottom: 3, left: 4 };
        // Ensure multiline text is properly handled
        if (typeof data.cell.text === 'string' && data.cell.text.includes('\n')) {
          data.cell.text = data.cell.text.split('\n');
        }
      }
    },
    alternateRowStyles: {
      fillColor: bgGray,
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center", cellWidth: 20 },
      2: { halign: "right", cellWidth: 35 },
      3: { halign: "right", cellWidth: 35 },
    },
    margin: { left: margin, right: margin },
  })

  // === TOTALS ===
  const finalY = (doc as any).lastAutoTable?.finalY || yPos + 50
  let totalsY = finalY + 15
  const totalsLabelX = pageWidth - margin - 70
  const totalsValueX = pageWidth - margin

  // Subtotal
  doc.setFontSize(10)
  doc.setTextColor(...darkGray)
  doc.setFont("helvetica", "normal")
  
  // Vis MVA-detaljer kun hvis MVA er satt
  if (data.taxRate > 0) {
    doc.text("Sum eks. mva:", totalsLabelX, totalsY)
    doc.text(`${data.subtotal.toFixed(2)} kr`, totalsValueX, totalsY, { align: "right" })

    // Tax
    totalsY += 6
    doc.text(`MVA (${(data.taxRate * 100).toFixed(0)}%):`, totalsLabelX, totalsY)
    doc.text(`${data.taxAmount.toFixed(2)} kr`, totalsValueX, totalsY, { align: "right" })

    // Total line
    totalsY += 4
    doc.setDrawColor(...lightGray)
    doc.setLineWidth(0.3)
    doc.line(totalsLabelX, totalsY, totalsValueX, totalsY)

    // Total amount
    totalsY += 8
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...primaryColor)
    doc.text("Å betale (inkl. MVA):", totalsLabelX, totalsY)
    doc.text(`${data.totalAmount.toFixed(2)} kr`, totalsValueX, totalsY, { align: "right" })
  } else {
    // Ingen MVA - vis bare totalen
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...primaryColor)
    doc.text("Å betale:", totalsLabelX, totalsY)
    doc.text(`${data.totalAmount.toFixed(2)} kr`, totalsValueX, totalsY, { align: "right" })
  }

  // === PAYMENT INFO ===
  if (data.organization.invoiceBankAccount) {
    totalsY += 25
    
    // Box for payment info
    doc.setFillColor(...bgGray)
    doc.roundedRect(margin, totalsY - 5, contentWidth / 2 - 10, 35, 3, 3, "F")
    
    doc.setFontSize(10)
    doc.setTextColor(...darkGray)
    doc.setFont("helvetica", "bold")
    doc.text("Betalingsinformasjon", margin + 5, totalsY + 3)
    
    totalsY += 10
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.text(`Kontonummer: ${data.organization.invoiceBankAccount}`, margin + 5, totalsY)
    totalsY += 5
    doc.text(`KID/Referanse: ${data.invoiceNumber}`, margin + 5, totalsY)
    totalsY += 5
    doc.text(`Beløp: ${data.totalAmount.toFixed(2)} kr`, margin + 5, totalsY)
  }

  // === NOTES ===
  if (data.notes || data.organization.invoiceNotes) {
    totalsY += 20
    doc.setFontSize(9)
    doc.setTextColor(...lightGray)
    doc.setFont("helvetica", "italic")
    const notes = data.notes || data.organization.invoiceNotes || ""
    const splitNotes = doc.splitTextToSize(notes, contentWidth)
    doc.text(splitNotes, margin, totalsY)
  }

  // === FOOTER ===
  const footerY = pageHeight - 15
  doc.setFontSize(8)
  doc.setTextColor(...lightGray)
  doc.setFont("helvetica", "normal")
  doc.text(
    `Generert ${format(new Date(), "d. MMMM yyyy 'kl.' HH:mm", { locale: nb })}`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  )

  // Convert to buffer
  const pdfOutput = doc.output("arraybuffer")
  return Buffer.from(pdfOutput)
}
