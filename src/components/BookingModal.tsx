"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { format, isSameDay } from "date-fns"
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
  Eye,
  FileText,
  AlertCircle
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
  onViewInvoice,
  isProcessing = false
}: BookingModalProps) {
  const { data: session } = useSession()
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  
  // Invoice preview modal state
  const [showInvoicePreview, setShowInvoicePreview] = useState(false)
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState<string | null>(null)
  const [isLoadingInvoicePreview, setIsLoadingInvoicePreview] = useState(false)
  const [invoicePreviewError, setInvoicePreviewError] = useState<string | null>(null)
  
  // Combined loading state
  const isAnyLoading = isProcessing || isApproving || isRejecting || isCancelling || isLoadingInvoicePreview
  
  // Check if user is logged in
  const isLoggedIn = !!session?.user?.email
  
  const isAdmin = userRole === "admin" || userRole === "moderator"
  // Check if current user owns this booking (must be logged in)
  const isOwner = isLoggedIn && session?.user?.email === booking.user.email
  
  // Users can only edit/cancel their own bookings, admins can edit/cancel any
  // Must be logged in to do anything
  const isNotPastBooking = new Date(booking.startTime) > new Date()
  const isEditableStatus = booking.status === "approved" || booking.status === "pending"
  const canEdit = isLoggedIn && (isAdmin || isOwner) && isEditableStatus && isNotPastBooking
  const canCancel = isLoggedIn && (isAdmin || isOwner) && isEditableStatus && isNotPastBooking
  
  // Only admin can approve/reject
  const canApproveReject = isAdmin && booking.status === "pending"
  // Payment info only visible to admin or booking owner
  const canSeePaymentInfo = pricingEnabled && (isAdmin || isOwner)
  
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

  const handleViewInvoice = async () => {
    if (!booking.invoiceId || !onViewInvoice) return
    setIsLoadingPreview(true)
    try {
      onViewInvoice(booking.invoiceId)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  // Check if booking has a price that requires invoice preview
  const bookingHasPrice = pricingEnabled && booking.totalAmount && booking.totalAmount > 0
  
  // Open invoice preview before approval
  const handleApproveWithPreview = async () => {
    if (!bookingHasPrice) {
      // No price, approve directly
      setIsApproving(true)
      try {
        await onApprove?.(booking.id)
      } finally {
        setIsApproving(false)
      }
      return
    }
    
    // Load invoice preview
    setIsLoadingInvoicePreview(true)
    setInvoicePreviewError(null)
    
    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}/invoice-preview`)
      if (!response.ok) {
        throw new Error("Kunne ikke laste faktura-forhåndsvisning")
      }
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      setInvoicePreviewUrl(url)
      setShowInvoicePreview(true)
    } catch (error) {
      console.error("Error loading invoice preview:", error)
      setInvoicePreviewError(error instanceof Error ? error.message : "Kunne ikke laste forhåndsvisning")
      // Still allow approval even if preview fails
      setShowInvoicePreview(true)
    } finally {
      setIsLoadingInvoicePreview(false)
    }
  }
  
  // Confirm approval after preview
  const handleConfirmApproval = async () => {
    setIsApproving(true)
    try {
      await onApprove?.(booking.id)
      // Close preview modal
      if (invoicePreviewUrl) {
        URL.revokeObjectURL(invoicePreviewUrl)
        setInvoicePreviewUrl(null)
      }
      setShowInvoicePreview(false)
    } finally {
      setIsApproving(false)
    }
  }
  
  // Close invoice preview modal
  const closeInvoicePreview = () => {
    if (invoicePreviewUrl) {
      URL.revokeObjectURL(invoicePreviewUrl)
      setInvoicePreviewUrl(null)
    }
    setShowInvoicePreview(false)
    setInvoicePreviewError(null)
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
          {(() => {
            const start = new Date(booking.startTime)
            const end = new Date(booking.endTime)
            const sameDay = isSameDay(start, end)
            
            if (sameDay) {
              // Same day - show date once with time range
              return (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Tidspunkt</h4>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>
                      {format(start, "EEEE d. MMMM yyyy", { locale: nb })}
                    </span>
                  </div>
                  <p className="text-lg font-medium text-gray-900 mt-1">
                    {format(start, "HH:mm")} - {format(end, "HH:mm")}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{getDuration()}</p>
                </div>
              )
            } else {
              // Different days - show Fra and Til
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Fra</h4>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>
                        {format(start, "EEEE d. MMMM yyyy", { locale: nb })}
                        {" kl. "}
                        {format(start, "HH:mm")}
                      </span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Til</h4>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>
                        {format(end, "EEEE d. MMMM yyyy", { locale: nb })}
                        {" kl. "}
                        {format(end, "HH:mm")}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{getDuration()}</p>
                  </div>
                </div>
              )
            }
          })()}

          {/* User info - only for admin/moderator or booking owner */}
          {(isAdmin || isOwner) && (
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

          {/* Contact info - only visible to admin or booking owner */}
          {(isAdmin || isOwner) && (booking.contactName || booking.contactEmail || booking.contactPhone) && (
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

          {/* Price and payment info - only visible to admin or booking owner */}
          {canSeePaymentInfo && (
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
              {/* Show hint about invoice preview if booking has price */}
              {bookingHasPrice && (
                <p className="text-xs text-blue-600 mb-2 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  Faktura vil vises for gjennomgang før godkjenning
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleApproveWithPreview}
                  disabled={isAnyLoading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isApproving || isLoadingInvoicePreview ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isLoadingInvoicePreview ? "Laster faktura..." : "Godkjenner..."}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {bookingHasPrice ? "Se faktura og godkjenn" : "Godkjenn"}
                    </>
                  )}
                </button>
                <button
                  onClick={async () => {
                    setIsRejecting(true)
                    try {
                      await onReject(booking.id)
                    } finally {
                      setIsRejecting(false)
                    }
                  }}
                  disabled={isAnyLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isRejecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Avslår...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Avslå
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Invoice button for approved bookings with invoice */}
          {booking.status === "approved" && 
           booking.preferredPaymentMethod === "INVOICE" && 
           booking.invoice && 
           onViewInvoice && (
            <div className="border-t pt-4">
              <button
                onClick={handleViewInvoice}
                disabled={isAnyLoading || isLoadingPreview}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
            </div>
          )}

          {/* Edit and Cancel buttons - only for owner or admin/moderator */}
          {((canEdit && onEdit) || (canCancel && onCancel)) && (
            <div className="border-t pt-4 space-y-2">
              <div className="flex gap-2">
                {canEdit && onEdit && (
                  <button
                    onClick={() => onEdit(booking)}
                    disabled={isAnyLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Rediger
                  </button>
                )}
                {canCancel && onCancel && (
                  <button
                    onClick={async () => {
                      setIsCancelling(true)
                      try {
                        await onCancel(booking.id)
                      } finally {
                        setIsCancelling(false)
                      }
                    }}
                    disabled={isAnyLoading}
                    className="flex-1 px-4 py-2 bg-white border border-gray-300 text-red-600 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {isCancelling ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Kansellerer...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Kanseller
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Invoice Preview Modal */}
      {showInvoicePreview && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4"
          onClick={closeInvoicePreview}
        >
          <div 
            className="bg-white rounded-xl max-w-4xl w-full shadow-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200 bg-amber-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-600" />
                    Forhåndsvisning av faktura
                  </h3>
                  <p className="text-sm text-amber-700 mt-1">
                    Kontroller at fakturaen er korrekt før du godkjenner bookingen
                  </p>
                </div>
                <button
                  onClick={closeInvoicePreview}
                  className="p-1 rounded-full hover:bg-amber-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* PDF Preview */}
            <div className="flex-1 overflow-auto p-6 bg-gray-50">
              {isLoadingInvoicePreview ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : invoicePreviewError ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-2" />
                  <p className="text-amber-600 mb-2">{invoicePreviewError}</p>
                  <p className="text-sm text-gray-500">Du kan fortsatt godkjenne bookingen, men fakturaen kunne ikke forhåndsvises.</p>
                </div>
              ) : invoicePreviewUrl ? (
                <iframe
                  src={invoicePreviewUrl}
                  className="w-full h-full min-h-[500px] border border-gray-200 rounded-lg bg-white"
                  title="Faktura forhåndsvisning"
                />
              ) : null}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex items-center justify-between bg-white">
              <button
                onClick={closeInvoicePreview}
                disabled={isApproving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Avbryt
              </button>
              <button
                onClick={handleConfirmApproval}
                disabled={isApproving}
                className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isApproving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Godkjenner og sender...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Godkjenn og send faktura
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
