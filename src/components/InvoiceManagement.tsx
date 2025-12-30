"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { nb } from "date-fns/locale"
import { 
  FileText, 
  Download, 
  Mail, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Loader2,
  Eye,
  Trash2
} from "lucide-react"
import Link from "next/link"

interface Invoice {
  id: string
  invoiceNumber: string
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED"
  dueDate: string
  paidAt: string | null
  totalAmount: number
  billingName: string
  billingEmail: string
  createdAt: string
  bookings: Array<{
    id: string
    title: string
    startTime: string
    endTime: string
  }>
}

export function InvoiceManagement() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "draft" | "sent" | "paid" | "overdue">("all")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchInvoices()
  }, [filter])

  const handleDelete = async (invoice: Invoice) => {
    if (!confirm(`Er du sikker på at du vil slette faktura ${invoice.invoiceNumber}?\n\nDenne handlingen kan ikke angres.`)) {
      return
    }

    setDeletingId(invoice.id)
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || "Kunne ikke slette faktura")
        return
      }

      // Fjern fakturaen fra listen
      setInvoices(prev => prev.filter(inv => inv.id !== invoice.id))
    } catch (error) {
      console.error("Error deleting invoice:", error)
      alert("En feil oppstod ved sletting av faktura")
    } finally {
      setDeletingId(null)
    }
  }

  const fetchInvoices = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/invoices?status=${filter === "all" ? "" : filter}`)
      if (response.ok) {
        const data = await response.json()
        // Convert Decimal to number for totalAmount
        const invoices = (data.invoices || []).map((inv: any) => ({
          ...inv,
          totalAmount: typeof inv.totalAmount === 'object' && inv.totalAmount !== null
            ? Number(inv.totalAmount)
            : Number(inv.totalAmount || 0)
        }))
        setInvoices(invoices)
      }
    } catch (error) {
      console.error("Error fetching invoices:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: Invoice["status"]) => {
    switch (status) {
      case "PAID":
        return "bg-green-100 text-green-700"
      case "SENT":
        return "bg-blue-100 text-blue-700"
      case "DRAFT":
        return "bg-gray-100 text-gray-700"
      case "OVERDUE":
        return "bg-red-100 text-red-700"
      case "CANCELLED":
        return "bg-gray-100 text-gray-500"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const getStatusIcon = (status: Invoice["status"]) => {
    switch (status) {
      case "PAID":
        return <CheckCircle2 className="w-4 h-4" />
      case "SENT":
        return <Mail className="w-4 h-4" />
      case "DRAFT":
        return <FileText className="w-4 h-4" />
      case "OVERDUE":
        return <Clock className="w-4 h-4" />
      case "CANCELLED":
        return <XCircle className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  const getStatusLabel = (status: Invoice["status"]) => {
    switch (status) {
      case "PAID":
        return "Betalt"
      case "SENT":
        return "Sendt"
      case "DRAFT":
        return "Kladd"
      case "OVERDUE":
        return "Forfalt"
      case "CANCELLED":
        return "Kansellert"
      default:
        return status
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(["all", "draft", "sent", "paid", "overdue"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === f
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {f === "all" ? "Alle" : f === "draft" ? "Kladder" : f === "sent" ? "Sendt" : f === "paid" ? "Betalt" : "Forfalt"}
          </button>
        ))}
      </div>

      {/* Invoices table */}
      {invoices.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>Ingen fakturaer funnet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Fakturanummer</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Kunde</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Dato</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Forfallsdato</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Beløp</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Handling</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span className="font-medium text-gray-900">{invoice.invoiceNumber}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-sm text-gray-900">{invoice.billingName}</p>
                      <p className="text-xs text-gray-500">{invoice.billingEmail}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {format(new Date(invoice.createdAt), "d. MMM yyyy", { locale: nb })}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {format(new Date(invoice.dueDate), "d. MMM yyyy", { locale: nb })}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-medium text-gray-900">
                      {invoice.totalAmount.toFixed(2)} kr
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        invoice.status
                      )}`}
                    >
                      {getStatusIcon(invoice.status)}
                      {getStatusLabel(invoice.status)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/api/invoices/${invoice.id}/pdf`}
                        download={`Faktura_${invoice.invoiceNumber}.pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Last ned PDF"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDelete(invoice)}
                        disabled={deletingId === invoice.id}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Slett faktura"
                      >
                        {deletingId === invoice.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

