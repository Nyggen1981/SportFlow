"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { nb } from "date-fns/locale"
import {
  X,
  Calendar,
  User,
  Loader2,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  Eye
} from "lucide-react"

// Booking type that matches the data structure used across the app
export interface BookingModalData {
  id: string
  title: string
  description: string | null
  startTime: string
  endTime: string
  status: string
  statusNote: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  totalAmount: number | null
  invoiceId: string | null
  invoice?: { id: string; status: string; invoiceNumber: string } | null
  preferredPaymentMethod: string | null
  isRecurring?: boolean
  parentBookingId?: string | null
  resource: {
    id: string
    name: string
    color?: string | null
  }
  resourcePart?: {
    id: string
    name: string
  } | null
  user: {
    name: string | null
    email: string
  }
  payments?: Array<{ id: string; status: string; paymentMethod: string; amount: number }>
}

interface BookingModalProps {
  booking: BookingModalData
  isOpen: boolean
  onClose: () => void
  userRole: "admin" | "moderator" | "user"
  pricingEnabled?: boolean
  onEdit?: (booking: BookingModalData) => void
  onApprove?: (bookingId: string) => Promise<void>
  onReject?: (bookingId: string, reason?: string) => void
  onCancel?: (bookingId: string) => Promise<void>
  onMarkAsPaid?: (bookingId: string) => Promise<void>
  onViewInvoice?: (invoiceId: string) => void
  isProcessing?: boolean
}

// Admin note component that fetches and saves notes
function AdminNoteSection({ bookingId }: { bookingId: string }) {
  const [note, setNote] = useState("")
  const [originalNote, setOriginalNote] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  useEffect(() => {
    const fetchNote = async () => {
      try {
        const res = await fetch(`/api/admin/bookings/${bookingId}/note`)
        if (res.ok) {
          const data = await res.json()
          setNote(data.adminNote || "")
          setOriginalNote(data.adminNote || "")
        }
      } catch (error) {
        console.error("Failed to fetch admin note:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchNote()
  }, [bookingId])

  const saveNote = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNote: note })
      })
      if (res.ok) {
        setOriginalNote(note)
        setIsSaved(true)
        setTimeout(() => setIsSaved(false), 2000)
      }
    } catch (error) {
      console.error('Failed to save admin note:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanges = note !== originalNote

  return (
    <div className="border-t pt-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
        <span>📝</span>
        Admin-notat
        <span className="text-xs font-normal text-gray-400">(kun synlig for admin)</span>
      </h4>
      {isLoading ? (
        <div className="h-16 flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              setIsSaved(false)
            }}
            placeholder="Skriv intern info her (f.eks. 'Konfirmasjon - ikke vis navn')"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={2}
          />
          <div className="flex items-center justify-end gap-2 mt-1">
            {isSaved && (
              <span className="text-[10px] text-green-600">✓ Lagret</span>
            )}
            <button
              onClick={saveNote}
              disabled={!hasChanges || isSaving}
              className="px-2 py-0.5 text-xs rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-blue-600 text-white hover:bg-blue-700"
            >
              {isSaving ? "..." : "Lagre"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function BookingModal({
  booking,
  isOpen,
  onClose,
  userRole,
  pricingEnabled = false,
  onEdit,
  onApprove,
  onReject,
  onCancel,
  onMarkAsPaid,
  onViewInvoice,
  isProcessing = false
}: BookingModalProps) {
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  
  const isAdmin = userRole === "admin" || userRole === "moderator"
  const canEdit = (booking.status === "approved" || booking.status === "pending") && 
                  new Date(booking.startTime) > new Date()
  const canApproveReject = isAdmin && booking.status === "pending"
  const canCancel = canEdit
  const canMarkAsPaid = isAdmin && pricingEnabled && booking.status === "approved" && 
                        booking.totalAmount && booking.totalAmount > 0
  
  if (!isOpen) return null

  // Calculate duration
  const getDuration = () => {
    const start = new Date(booking.startTime)
    const end = new Date(booking.endTime)
    let durationMs = end.getTime() - start.getTime()
    
    if (durationMs < 0) {
      durationMs += 24 * 60 * 60 * 1000
    }
    
    const durationHours = Math.round((durationMs / (1000 * 60 * 60)) * 10) / 10
    return `${durationHours} timer`
  }

  // Get payment status
  const getPaymentStatus = () => {
    if (booking.payments && booking.payments.some(p => p.status === "COMPLETED")) {
      return "paid"
    }
    if (booking.invoice?.status === "PAID") {
      return "paid"
    }
    return "unpaid"
  }

  const handleViewInvoice = async () => {
    if (!booking.invoiceId || !onViewInvoice) return
    setIsLoadingPreview(true)
    try {
      onViewInvoice(booking.invoiceId)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="p-6 rounded-t-xl"
          style={{ 
            backgroundColor: booking.resource.color || "#3b82f6" 
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-white/80 text-sm font-medium">
                {booking.resource.name}
                {booking.resourcePart && ` • ${booking.resourcePart.name}`}
              </p>
              <h3 className="text-2xl font-bold text-white mt-1">
                {booking.title}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status */}
          <div className="flex items-center gap-2 flex-wrap">
            {booking.status === "pending" && (
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-amber-100 text-amber-700">
                Venter på godkjenning
              </span>
            )}
            {booking.status === "approved" && (
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-700">
                Godkjent
              </span>
            )}
            {booking.status === "rejected" && (
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-red-100 text-red-700">
                Avslått
              </span>
            )}
            {booking.status === "cancelled" && (
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-600">
                Kansellert
              </span>
            )}
          </div>

          {/* Description */}
          {booking.description && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Beskrivelse</h4>
              <p className="text-gray-600 whitespace-pre-wrap">{booking.description}</p>
            </div>
          )}

          {/* Date and time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Fra</h4>
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>
                  {format(new Date(booking.startTime), "EEEE d. MMMM yyyy", { locale: nb })}
                  {" kl. "}
                  {format(new Date(booking.startTime), "HH:mm")}
                </span>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Til</h4>
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>
                  {format(new Date(booking.endTime), "EEEE d. MMMM yyyy", { locale: nb })}
                  {" kl. "}
                  {format(new Date(booking.endTime), "HH:mm")}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{getDuration()}</p>
            </div>
          </div>

          {/* User info - only for admin/moderator */}
          {isAdmin && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Bruker</h4>
              <div className="flex items-center gap-2 text-gray-600">
                <User className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="font-medium">{booking.user.name || "—"}</p>
                  <p className="text-sm text-gray-500">{booking.user.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Contact info */}
          {(booking.contactName || booking.contactEmail || booking.contactPhone) && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Kontaktinfo</h4>
              <div className="space-y-1 text-sm text-gray-600">
                {booking.contactName && (
                  <p><span className="font-medium">Navn:</span> {booking.contactName}</p>
                )}
                {booking.contactEmail && (
                  <p><span className="font-medium">E-post:</span> {booking.contactEmail}</p>
                )}
                {booking.contactPhone && (
                  <p><span className="font-medium">Telefon:</span> {booking.contactPhone}</p>
                )}
              </div>
            </div>
          )}

          {/* Admin note - only visible to admin/moderator */}
          {isAdmin && <AdminNoteSection bookingId={booking.id} />}

          {/* Price and payment info */}
          {pricingEnabled && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Betaling</h4>
              {booking.totalAmount && booking.totalAmount > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-sm font-medium text-gray-900">Totalpris:</span>
                    <span className="text-lg font-bold text-gray-900">
                      {Math.round(Number(booking.totalAmount))} kr
                    </span>
                  </div>
                  {booking.preferredPaymentMethod && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Foretrukket betalingsmetode:</p>
                      <span className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-700">
                        {booking.preferredPaymentMethod === "INVOICE" && "Faktura"}
                        {booking.preferredPaymentMethod === "VIPPS" && "Vipps"}
                        {booking.preferredPaymentMethod === "CARD" && "Kort"}
                      </span>
                    </div>
                  )}
                  {booking.payments && booking.payments.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Betalinger:</p>
                      <div className="space-y-2">
                        {booking.payments.map((payment) => (
                          <div key={payment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {payment.paymentMethod === "VIPPS" && "Vipps"}
                                {payment.paymentMethod === "CARD" && "Kort"}
                                {payment.paymentMethod === "BANK_TRANSFER" && "Bankoverføring"}
                                {payment.paymentMethod === "INVOICE" && "Faktura"}
                              </p>
                              <p className="text-xs text-gray-500">{Math.round(Number(payment.amount))} kr</p>
                            </div>
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                              payment.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                              payment.status === "PENDING" ? "bg-amber-100 text-amber-700" :
                              payment.status === "FAILED" ? "bg-red-100 text-red-700" :
                              "bg-gray-100 text-gray-700"
                            }`}>
                              {payment.status === "COMPLETED" && "Betalt"}
                              {payment.status === "PENDING" && "Venter"}
                              {payment.status === "PROCESSING" && "Behandler"}
                              {payment.status === "FAILED" && "Feilet"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-600">Gratis booking</p>
              )}
            </div>
          )}

          {/* Status note */}
          {booking.statusNote && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Statusnotat</h4>
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{booking.statusNote}</p>
            </div>
          )}

          {/* Action buttons based on status and role */}
          
          {/* Approve/Reject for admin on pending bookings */}
          {canApproveReject && onApprove && onReject && (
            <div className="border-t pt-4">
              <div className="flex gap-2">
                <button
                  onClick={() => onApprove(booking.id)}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Behandler...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Godkjenn
                    </>
                  )}
                </button>
                <button
                  onClick={() => onReject(booking.id)}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Avslå
                </button>
              </div>
            </div>
          )}

          {/* Invoice button for approved bookings with invoice */}
          {booking.status === "approved" && 
           booking.preferredPaymentMethod === "INVOICE" && 
           booking.invoice && 
           onViewInvoice && (
            <div className="border-t pt-4 space-y-2">
              <button
                onClick={handleViewInvoice}
                disabled={isLoadingPreview}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoadingPreview ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Laster...
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Se faktura
                  </>
                )}
              </button>
              {/* Mark as paid button - only for admin when invoice is sent */}
              {isAdmin && booking.invoice.status === "SENT" && onMarkAsPaid && (
                <button
                  onClick={() => onMarkAsPaid(booking.id)}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Marker som betalt
                </button>
              )}
            </div>
          )}

          {/* Mark as paid for non-invoice bookings (admin only) */}
          {isAdmin && 
           booking.status === "approved" && 
           booking.preferredPaymentMethod !== "INVOICE" &&
           canMarkAsPaid && 
           getPaymentStatus() !== "paid" &&
           onMarkAsPaid && (
            <div className="border-t pt-4">
              <button
                onClick={() => onMarkAsPaid(booking.id)}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Marker som betalt
              </button>
            </div>
          )}

          {/* Edit and Cancel buttons for approved/pending bookings that aren't past */}
          {canEdit && (onEdit || onCancel) && (
            <div className="border-t pt-4 space-y-2">
              <div className="flex gap-2">
                {onEdit && (
                  <button
                    onClick={() => onEdit(booking)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Rediger
                  </button>
                )}
                {onCancel && (
                  <button
                    onClick={() => onCancel(booking.id)}
                    disabled={isProcessing}
                    className="flex-1 px-4 py-2 bg-white border border-gray-300 text-red-600 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Kanseller
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
