"use client"

import { useState, useEffect } from "react"
import { X, Calendar, Clock, User, Repeat, CheckCircle2, XCircle, Loader2, Pencil, Trash2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { nb } from "date-fns/locale"

interface Payment {
  id: string
  amount: number
  status: string
  paymentMethod: string
}

interface Booking {
  id: string
  title: string
  description?: string | null
  startTime: string
  endTime: string
  status: string
  statusNote?: string | null
  adminNote?: string | null
  isRecurring?: boolean
  recurringGroupId?: string | null
  userId?: string
  user?: {
    id?: string
    name?: string | null
    email?: string | null
  } | null
  resource: {
    id: string
    name: string
    color?: string | null
    category?: {
      id: string
      name: string
      color?: string | null
    } | null
  }
  resourcePart?: {
    id: string
    name: string
  } | null
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  // Payment fields (optional)
  totalAmount?: number | null
  preferredPaymentMethod?: string | null
  payments?: Payment[]
}

export type { Booking as BookingForModal }

interface BookingDetailModalProps {
  booking: Booking
  onClose: () => void
  canManageBookings: boolean
  isOwner: boolean
  isLoggedIn: boolean
  onApprove?: (bookingId: string, applyToAll: boolean) => void
  onReject?: (bookingId: string) => void
  onEdit?: (booking: Booking) => void
  onCancel?: (bookingId: string) => void
  isProcessing?: boolean
  showPaymentInfo?: boolean
}

// Admin note section component
function AdminNoteSection({ bookingId, initialAdminNote, onNoteSaved }: { 
  bookingId: string
  initialAdminNote?: string | null
  onNoteSaved?: (note: string | null) => void 
}) {
  const [adminNote, setAdminNote] = useState(initialAdminNote || "")
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle")
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setAdminNote(initialAdminNote || "")
    setHasChanges(false)
    setSaveStatus("idle")
  }, [initialAdminNote, bookingId])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveStatus("idle")
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNote: adminNote || null })
      })
      if (res.ok) {
        setSaveStatus("saved")
        setHasChanges(false)
        onNoteSaved?.(adminNote || null)
        setTimeout(() => setSaveStatus("idle"), 2000)
      } else {
        setSaveStatus("error")
      }
    } catch {
      setSaveStatus("error")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="border-t pt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <span>📝</span>
          Admin-notat
          <span className="text-xs font-normal text-gray-400">(kun synlig for admin)</span>
        </h4>
        {saveStatus === "saved" && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Lagret
          </span>
        )}
        {saveStatus === "error" && (
          <span className="text-xs text-red-600 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Feil
          </span>
        )}
      </div>
      <textarea
        value={adminNote}
        onChange={(e) => {
          setAdminNote(e.target.value)
          setHasChanges(true)
          setSaveStatus("idle")
        }}
        placeholder="Skriv intern info her..."
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        rows={2}
      />
      {hasChanges && (
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="mt-2 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Lagre
        </button>
      )}
    </div>
  )
}

export function BookingDetailModal({
  booking,
  onClose,
  canManageBookings,
  isOwner,
  isLoggedIn,
  onApprove,
  onReject,
  onEdit,
  onCancel,
  isProcessing = false,
  showPaymentInfo = false
}: BookingDetailModalProps) {
  const [applyToAll, setApplyToAll] = useState(false)
  const [adminNote, setAdminNote] = useState(booking.adminNote || null)

  const start = parseISO(booking.startTime)
  const end = parseISO(booking.endTime)
  const sameDay = format(start, "yyyy-MM-dd") === format(end, "yyyy-MM-dd")
  const isPast = new Date(booking.startTime) < new Date()
  const canEdit = (isOwner || canManageBookings) && (booking.status === "pending" || booking.status === "approved") && !isPast
  const canCancelBooking = isOwner && (booking.status === "pending" || booking.status === "approved") && !isPast

  // Calculate duration
  const durationMs = end.getTime() - start.getTime()
  const durationHours = Math.round((durationMs / (1000 * 60 * 60)) * 10) / 10

  const resourceColor = booking.resource.color || booking.resource.category?.color || "#3b82f6"

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <p className="text-sm text-green-100">
              {booking.resource.name}
              {booking.resourcePart && ` • ${booking.resourcePart.name}`}
            </p>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <h3 className="text-xl font-bold mt-1">{booking.title}</h3>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Status badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
              booking.status === "pending" 
                ? "bg-amber-100 text-amber-700" 
                : booking.status === "rejected"
                ? "bg-red-100 text-red-700"
                : booking.status === "cancelled"
                ? "bg-gray-100 text-gray-700"
                : "bg-green-100 text-green-700"
            }`}>
              {booking.status === "pending" ? "Venter på godkjenning" : 
               booking.status === "rejected" ? "Avslått" :
               booking.status === "cancelled" ? "Kansellert" : "Godkjent"}
            </span>
            {booking.isRecurring && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                <Repeat className="w-3 h-3" />
                Gjentakende
              </span>
            )}
          </div>
          
          {/* Date and time - always show Fra/Til */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Fra</h4>
              <div className="flex items-center gap-2 text-gray-700">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>{format(start, sameDay ? "EEEE d. MMM" : "d. MMM yyyy", { locale: nb })}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 mt-1">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>kl. {format(start, "HH:mm")}</span>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Til</h4>
              <div className="flex items-center gap-2 text-gray-700">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>{format(end, sameDay ? "EEEE d. MMM" : "d. MMM yyyy", { locale: nb })}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 mt-1">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>kl. {format(end, "HH:mm")}</span>
              </div>
            </div>
            {!sameDay && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500">{durationHours} timer totalt</p>
              </div>
            )}
          </div>
          
          {/* User info - GDPR: Only show to admin/moderator or owner */}
          {(canManageBookings || isOwner) && booking.user?.name && (
            <div className="space-y-2 text-sm border-t pt-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase">Bruker</h4>
              <div className="flex items-center gap-2 text-gray-600">
                <User className="w-4 h-4 text-gray-400" />
                <span>{booking.user.name}</span>
              </div>
              {canManageBookings && booking.user.email && (
                <p className="text-gray-500 ml-6">{booking.user.email}</p>
              )}
            </div>
          )}
          
          {/* Contact info - only for admin */}
          {canManageBookings && (booking.contactName || booking.contactEmail || booking.contactPhone) && (
            <div className="space-y-1 text-sm border-t pt-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Kontaktinfo</h4>
              {booking.contactName && <p className="text-gray-600">Navn: {booking.contactName}</p>}
              {booking.contactEmail && <p className="text-gray-600">E-post: {booking.contactEmail}</p>}
              {booking.contactPhone && <p className="text-gray-600">Telefon: {booking.contactPhone}</p>}
            </div>
          )}
          
          {/* Description */}
          {booking.description && (
            <div className="border-t pt-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Beskrivelse</h4>
              <p className="text-gray-600 text-sm whitespace-pre-wrap">{booking.description}</p>
            </div>
          )}
          
          {/* Status note (rejection reason) */}
          {booking.statusNote && (
            <div className="border-t pt-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                {booking.status === "rejected" ? "Årsak til avslag" : "Merknad"}
              </h4>
              <p className="text-gray-600 text-sm">{booking.statusNote}</p>
            </div>
          )}
          
          {/* Payment info - only when enabled and for admins */}
          {showPaymentInfo && canManageBookings && (
            <div className="border-t pt-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Betaling</h4>
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
                      <p className="text-xs text-gray-500 mb-1">Betalingsmetode:</p>
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
          
          {/* Admin note - only for admin/moderator */}
          {canManageBookings && (
            <AdminNoteSection 
              bookingId={booking.id} 
              initialAdminNote={adminNote}
              onNoteSaved={setAdminNote}
            />
          )}
        </div>

        {/* Actions */}
        {isLoggedIn && (canManageBookings || canEdit || canCancelBooking) && (
          <div className="p-4 border-t bg-gray-50 rounded-b-xl space-y-3">
            {/* Recurring booking checkbox */}
            {canManageBookings && booking.isRecurring && booking.status === "pending" && (
              <label className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyToAll}
                  onChange={(e) => setApplyToAll(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-blue-800">
                  Behandle alle gjentakende bookinger
                </span>
              </label>
            )}
            
            {/* Approve/Reject buttons for admin */}
            {canManageBookings && booking.status === "pending" && onApprove && onReject && (
              <div className="flex gap-2">
                <button
                  onClick={() => onApprove(booking.id, applyToAll)}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {booking.isRecurring && applyToAll ? "Godkjenn alle" : "Godkjenn"}
                </button>
                <button
                  onClick={() => onReject(booking.id)}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  {booking.isRecurring && applyToAll ? "Avslå alle" : "Avslå"}
                </button>
              </div>
            )}
            
            {/* Edit and Cancel buttons */}
            <div className="flex gap-2">
              {canEdit && onEdit && (
                <button
                  onClick={() => onEdit(booking)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Rediger
                </button>
              )}
              {canCancelBooking && onCancel && (
                <button
                  onClick={() => onCancel(booking.id)}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 border-2 border-red-500 text-red-600 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Kanseller
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
