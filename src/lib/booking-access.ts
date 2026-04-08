import { prisma } from "@/lib/prisma"

/** Alle booking-ID-er i samme serie (forelder + barn) eller kun denne bookingen */
export async function getBookingIdsInSameSeries(bookingId: string): Promise<string[]> {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, parentBookingId: true },
  })
  if (!b) return []
  const rootId = b.parentBookingId ?? b.id
  const rows = await prisma.booking.findMany({
    where: {
      OR: [{ id: rootId }, { parentBookingId: rootId }],
    },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

export async function userHasBookingManageAccess(
  sessionUserId: string,
  booking: { id: string; userId: string }
): Promise<boolean> {
  if (booking.userId === sessionUserId) return true
  const co = await prisma.bookingCoOwner.findUnique({
    where: {
      bookingId_userId: { bookingId: booking.id, userId: sessionUserId },
    },
  })
  return !!co
}

/** Synk med database (bruk når du kun har userId og bookingId) */
export async function userHasBookingManageAccessById(
  sessionUserId: string,
  bookingId: string
): Promise<boolean> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, userId: true },
  })
  if (!booking) return false
  return userHasBookingManageAccess(sessionUserId, booking)
}
