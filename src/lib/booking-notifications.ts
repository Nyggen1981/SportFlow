import { prisma } from "@/lib/prisma"

/**
 * Unike e-postadresser som skal få brukervarsler om denne bookingen
 * (hovedeier, kontakt-e-post hvis satt, medeiere).
 */
export async function getBookingNotificationEmails(bookingId: string): Promise<string[]> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: { select: { email: true } },
      coOwners: { include: { user: { select: { email: true } } } },
    },
  })
  if (!booking) return []
  const set = new Set<string>()
  const add = (e: string | null | undefined) => {
    const t = e?.trim().toLowerCase()
    if (t) set.add(t)
  }
  add(booking.user.email)
  add(booking.contactEmail)
  for (const row of booking.coOwners) {
    add(row.user.email)
  }
  return [...set]
}
