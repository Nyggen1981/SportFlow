import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getBookingIdsInSameSeries, userHasBookingManageAccess } from "@/lib/booking-access"

function isAppAdmin(session: { user?: { systemRole?: string; role?: string } }) {
  return session.user?.systemRole === "admin" || session.user?.role === "admin"
}

/** Liste medeiere */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: bookingId } = await params

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      coOwners: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!booking) {
    return NextResponse.json({ error: "Booking ikke funnet" }, { status: 404 })
  }

  const sameOrg = booking.organizationId === session.user.organizationId
  const canSee =
    (isAppAdmin(session) && sameOrg) ||
    (sameOrg && (await userHasBookingManageAccess(session.user.id, booking)))

  if (!canSee) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 })
  }

  return NextResponse.json({
    primaryUserId: booking.userId,
    coOwners: booking.coOwners.map((c) => ({
      id: c.id,
      userId: c.userId,
      name: c.user.name,
      email: c.user.email,
      createdAt: c.createdAt,
    })),
  })
}

/** Legg til medeier (e-post må tilhøre bruker i samme organisasjon). Synkroniseres til hele gjentakende serie. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: bookingId } = await params
  const body = await request.json().catch(() => ({}))
  const emailRaw = typeof body.email === "string" ? body.email : ""
  const email = emailRaw.toLowerCase().trim()

  if (!email) {
    return NextResponse.json({ error: "E-post er påkrevd" }, { status: 400 })
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      organizationId: true,
    },
  })

  if (!booking) {
    return NextResponse.json({ error: "Booking ikke funnet" }, { status: 404 })
  }

  if (booking.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 })
  }

  const canManage = await userHasBookingManageAccess(session.user.id, booking)
  if (!canManage && !isAppAdmin(session)) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 })
  }

  const targetUser = await prisma.user.findFirst({
    where: {
      email,
      organizationId: booking.organizationId,
    },
    select: { id: true, email: true, name: true },
  })

  if (!targetUser) {
    return NextResponse.json(
      { error: "Fant ingen bruker med denne e-posten i organisasjonen. Brukeren må registrere seg først." },
      { status: 404 }
    )
  }

  if (targetUser.id === booking.userId) {
    return NextResponse.json(
      { error: "Brukeren er allerede hovedeier for bookingen" },
      { status: 400 }
    )
  }

  const seriesIds = await getBookingIdsInSameSeries(bookingId)

  try {
    await prisma.$transaction(
      seriesIds.map((bid) =>
        prisma.bookingCoOwner.upsert({
          where: {
            bookingId_userId: { bookingId: bid, userId: targetUser.id },
          },
          create: {
            bookingId: bid,
            userId: targetUser.id,
          },
          update: {},
        })
      )
    )
  } catch (e) {
    console.error("[co-owners] POST", e)
    return NextResponse.json({ error: "Kunne ikke legge til medeier" }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    user: { id: targetUser.id, email: targetUser.email, name: targetUser.name },
    syncedBookings: seriesIds.length,
  })
}

/** Fjern medeier. query: userId=… — hovedeier kan fjerne alle; medeier kan fjerne seg selv */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: bookingId } = await params
  const { searchParams } = new URL(request.url)
  const removeUserId = searchParams.get("userId")

  if (!removeUserId) {
    return NextResponse.json({ error: "userId er påkrevd" }, { status: 400 })
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, userId: true, organizationId: true },
  })

  if (!booking) {
    return NextResponse.json({ error: "Booking ikke funnet" }, { status: 404 })
  }

  if (booking.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 })
  }

  const isPrimary = booking.userId === session.user.id
  const isSelfRemove = removeUserId === session.user.id
  const canRemoveOthers = isPrimary || isAppAdmin(session)
  if (!isSelfRemove && !canRemoveOthers) {
    return NextResponse.json({ error: "Bare hovedeier kan fjerne andre medeiere" }, { status: 403 })
  }
  if (isSelfRemove && session.user.id !== removeUserId) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 })
  }

  const seriesIds = await getBookingIdsInSameSeries(bookingId)

  await prisma.bookingCoOwner.deleteMany({
    where: {
      bookingId: { in: seriesIds },
      userId: removeUserId,
    },
  })

  return NextResponse.json({ success: true, syncedBookings: seriesIds.length })
}
