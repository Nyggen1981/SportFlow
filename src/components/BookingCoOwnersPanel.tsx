"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { Users } from "lucide-react"

type CoOwnerRow = { userId: string; name: string | null; email: string }

export type BookingCoOwnersPanelProps = {
  bookingId: string
  /** Når false rendres ingenting */
  enabled: boolean
  /** Admin eller moderator (kan fjerne andre uten å være hovedeier) */
  isModeratorOrAdmin?: boolean
  /** Ekstra forklaring under tittel (f.eks. gjentakende serie) */
  seriesNote?: string
  className?: string
  /** Kalles med medeiernes userId-er etter hver vellykket GET (for forelders tilgangssjekk) */
  onRosterUserIdsChange?: (userIds: string[]) => void
}

export function BookingCoOwnersPanel({
  bookingId,
  enabled,
  isModeratorOrAdmin = false,
  seriesNote,
  className = "",
  onRosterUserIdsChange,
}: BookingCoOwnersPanelProps) {
  const { data: session } = useSession()
  const rosterCb = useRef(onRosterUserIdsChange)
  rosterCb.current = onRosterUserIdsChange

  const [coOwnerRows, setCoOwnerRows] = useState<CoOwnerRow[]>([])
  const [primaryUserId, setPrimaryUserId] = useState<string | null>(null)
  const [addCoEmail, setAddCoEmail] = useState("")
  const [coOwnerBusy, setCoOwnerBusy] = useState(false)
  const [coOwnerErr, setCoOwnerErr] = useState<string | null>(null)
  const [accessChecked, setAccessChecked] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)

  const refreshCoOwners = useCallback(async () => {
    if (!bookingId) return
    try {
      const r = await fetch(`/api/bookings/${bookingId}/co-owners`)
      if (r.status === 403) {
        setHasAccess(false)
        setAccessChecked(true)
        rosterCb.current?.([])
        return
      }
      if (!r.ok) {
        setAccessChecked(true)
        return
      }
      setHasAccess(true)
      setAccessChecked(true)
      const d = await r.json()
      setPrimaryUserId(d.primaryUserId ?? null)
      const rows: CoOwnerRow[] = (d.coOwners || []).map(
        (c: { userId: string; name: string | null; email: string }) => ({
          userId: c.userId,
          name: c.name,
          email: c.email,
        })
      )
      setCoOwnerRows(rows)
      rosterCb.current?.(rows.map((row) => row.userId))
    } catch {
      setAccessChecked(true)
    }
  }, [bookingId])

  useEffect(() => {
    if (!enabled) {
      setCoOwnerRows([])
      setPrimaryUserId(null)
      setAccessChecked(false)
      setHasAccess(false)
      rosterCb.current?.([])
      return
    }
    void refreshCoOwners()
  }, [enabled, bookingId, refreshCoOwners])

  if (!enabled || !accessChecked || !hasAccess) return null

  return (
    <div className={`border-t pt-4 ${className}`}>
      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
        <Users className="w-4 h-4 text-gray-500" />
        Medeiere
      </h4>
      <p className="text-xs text-gray-500 mb-3">
        {seriesNote ??
          "Medeiere ser bookingen under «Mine bookinger», kan redigere/kansellere og mottar e-postvarsler."}
      </p>
      {coOwnerErr && <p className="text-xs text-red-600 mb-2">{coOwnerErr}</p>}
      <ul className="space-y-2 mb-3">
        {coOwnerRows.map((row) => {
          const uid = session?.user?.id
          const isPrimary = primaryUserId && uid === primaryUserId
          const isSelf = uid === row.userId
          const canRemove = isPrimary || isModeratorOrAdmin || isSelf
          return (
            <li
              key={row.userId}
              className="flex items-center justify-between gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2"
            >
              <div>
                <span className="font-medium text-gray-900">{row.name || row.email}</span>
                <span className="text-gray-500 ml-1">({row.email})</span>
                <span className="ml-2 text-[10px] uppercase tracking-wide text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                  Medeier
                </span>
              </div>
              {canRemove && (
                <button
                  type="button"
                  disabled={coOwnerBusy}
                  onClick={async () => {
                    setCoOwnerErr(null)
                    setCoOwnerBusy(true)
                    try {
                      const r = await fetch(
                        `/api/bookings/${bookingId}/co-owners?userId=${encodeURIComponent(row.userId)}`,
                        { method: "DELETE" }
                      )
                      if (!r.ok) {
                        const e = await r.json().catch(() => ({}))
                        setCoOwnerErr((e as { error?: string }).error || "Kunne ikke fjerne")
                        return
                      }
                      await refreshCoOwners()
                    } finally {
                      setCoOwnerBusy(false)
                    }
                  }}
                  className="text-xs text-red-600 hover:underline disabled:opacity-50"
                >
                  Fjern
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          placeholder="E-post (må være bruker i organisasjonen)"
          value={addCoEmail}
          onChange={(e) => setAddCoEmail(e.target.value)}
          className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
          disabled={coOwnerBusy}
        />
        <button
          type="button"
          disabled={coOwnerBusy || !addCoEmail.trim()}
          onClick={async () => {
            setCoOwnerErr(null)
            setCoOwnerBusy(true)
            try {
              const r = await fetch(`/api/bookings/${bookingId}/co-owners`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: addCoEmail.trim() }),
              })
              const data = await r.json().catch(() => ({}))
              if (!r.ok) {
                setCoOwnerErr((data as { error?: string }).error || "Kunne ikke legge til")
                return
              }
              setAddCoEmail("")
              await refreshCoOwners()
            } finally {
              setCoOwnerBusy(false)
            }
          }}
          className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          Legg til
        </button>
      </div>
    </div>
  )
}
