/**
 * Klient-side sjekk av booking-tilgang (uten Prisma).
 */
export function userManagesBooking(
  sessionUserId: string | undefined | null,
  sessionEmail: string | undefined | null,
  booking: {
    user?: { id?: string | null; email?: string | null }
    coOwners?: { userId: string }[]
  }
): boolean {
  if (sessionUserId && booking.user?.id && booking.user.id === sessionUserId) return true
  if (sessionUserId && booking.coOwners?.some((c) => c.userId === sessionUserId)) return true
  if (sessionEmail && booking.user?.email) {
    if (sessionEmail.toLowerCase() === booking.user.email.toLowerCase()) return true
  }
  return false
}
