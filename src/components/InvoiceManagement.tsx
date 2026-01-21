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
  Trash2,
  RotateCcw,
  MoreVertical,
  X,
  AlertCircle
} from "lucide-react"
import Link from "next/link"

interface Invoice {
  id: string
  invoiceNumber: string
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED" | "REFUNDED"
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
  const [filter, setFilter] = useState<"all" | "draft" | "sent" | "paid" | "overdue" | "refunded">("all")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  
  // Preview modal state
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null)

  useEffect(() => {
    fetchInvoices()
  }, [filter])

  const handleMarkAsRefunded = async (invoice: Invoice) => {
    if (!confirm(`Er du sikker på at du vil markere faktura ${invoice.invoiceNumber} som refundert?`)) {
      return
    }

    setUpdatingId(invoice.id)
    setOpenMenuId(null)
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REFUNDED" })
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || "Kunne ikke oppdatere faktura")
        return
      }

      // Oppdater fakturaen i listen
      setInvoices(prev => prev.map(inv => 
        inv.id === invoice.id ? { ...inv, status: "REFUNDED" as const } : inv
      ))
    } catch (error) {
      console.error("Error updating invoice:", error)
      alert("En feil oppstod ved oppdatering av faktura")
    } finally {
      setUpdatingId(null)
    }
  }

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

  const handlePreview = async (invoice: Invoice) => {
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewInvoice(invoice)
    setPreviewModalOpen(true)
    
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/pdf`)
      if (!response.ok) {
        throw new Error("Kunne ikke laste forhåndsvisning")
      }
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
    } catch (error) {
      console.error("Error loading preview:", error)
      setPreviewError(error instanceof Error ? error.message : "Kunne ikke laste forhåndsvisning")
    } finally {
      setPreviewLoading(false)
    }
  }

  const closePreviewModal = () => {
    setPreviewModalOpen(false)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setPreviewInvoice(null)
    setPreviewError(null)
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
      case "REFUNDED":
        return "bg-purple-100 text-purple-700"
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
      case "REFUNDED":
        return <RotateCcw className="w-4 h-4" />
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
      case "REFUNDED":
        return "Refundert"
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
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {(["all", "draft", "sent", "paid", "overdue", "refunded"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              filter === f
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {f === "all" ? "Alle" : f === "draft" ? "Kladder" : f === "sent" ? "Sendt" : f === "paid" ? "Betalt" : f === "overdue" ? "Forfalt" : "Refundert"}
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
        <div className="overflow-x-auto overflow-y-visible">
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
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handlePreview(invoice)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Forhåndsvis PDF"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <a
                        href={`/api/invoices/${invoice.id}/pdf`}
                        download={`Faktura_${invoice.invoiceNumber}.pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Last ned PDF"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      
                      {/* Dropdown menu for actions */}
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === invoice.id ? null : invoice.id)}
                          disabled={deletingId === invoice.id || updatingId === invoice.id}
                          className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                          title="Flere handlinger"
                        >
                          {(deletingId === invoice.id || updatingId === invoice.id) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <MoreVertical className="w-4 h-4" />
                          )}
                        </button>
                        
                        {openMenuId === invoice.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-[100]" 
                              onClick={() => setOpenMenuId(null)} 
                            />
                            <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-lg z-[101] min-w-[160px] py-1">
                              {invoice.status === "PAID" && (
                                <button
                                  onClick={() => handleMarkAsRefunded(invoice)}
                                  className="w-full px-4 py-2 text-left text-sm text-purple-600 hover:bg-purple-50 flex items-center gap-2"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                  Marker som refundert
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setOpenMenuId(null)
                                  handleDelete(invoice)
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Slett faktura
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview Modal */}
      {previewModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full shadow-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Forhåndsvisning av faktura</h3>
                  {previewInvoice && (
                    <p className="text-sm text-gray-500 mt-1">
                      Faktura {previewInvoice.invoiceNumber} - {previewInvoice.billingName}
                    </p>
                  )}
                </div>
                <button
                  onClick={closePreviewModal}
                  className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* PDF Preview */}
            <div className="flex-1 overflow-auto p-6 bg-gray-50">
              {previewLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : previewError ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
                  <p className="text-red-600">{previewError}</p>
                </div>
              ) : previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full min-h-[600px] border border-gray-200 rounded-lg"
                  title="Faktura forhåndsvisning"
                />
              ) : null}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex items-center justify-between">
              <a
                href={previewInvoice ? `/api/invoices/${previewInvoice.id}/pdf` : "#"}
                download={previewInvoice ? `Faktura_${previewInvoice.invoiceNumber}.pdf` : "faktura.pdf"}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Last ned PDF
              </a>
              <button
                onClick={closePreviewModal}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Lukk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

