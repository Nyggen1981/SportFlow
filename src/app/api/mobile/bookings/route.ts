import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { sendEmail, getNewBookingRequestEmail, formatBookingDateTime } from "@/lib/email"

// GET - Fetch user's bookings
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: "userId er påkrevd" },
        { status: 400 }
      )
    }

    const bookings = await prisma.booking.findMany({
      where: {
        userId: userId,
      },
      include: {
        resource: true,
        resourcePart: true,
        payments: {
          select: {
            id: true,
            status: true,
            paymentMethod: true,
            amount: true
          }
        }
      },
      orderBy: {
        startTime: 'desc',
      },
    })

    return NextResponse.json(bookings)
  } catch (error) {
    console.error("Error fetching bookings:", error)
    return NextResponse.json(
      { error: "Kunne ikke hente bookinger" },
      { status: 500 }
    )
  }
}

// POST - Create new booking
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      userId,
      resourceId,
      resourcePartId,
      title,
      description,
      startTime,
      endTime,
      contactName,
      contactEmail,
      contactPhone,
    } = body

    if (!userId || !resourceId || !title || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Mangler påkrevde felt" },
        { status: 400 }
      )
    }

    // Get resource to check settings
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      select: {
        organizationId: true,
        requiresApproval: true,
      }
    })

    if (!resource) {
      return NextResponse.json(
        { error: "Ressurs ikke funnet" },
        { status: 404 }
      )
    }

    // Check for conflicts - optimized query using time range overlap
    // Time ranges overlap if: start1 < end2 && start2 < end1
    const bookingStart = new Date(startTime)
    const bookingEnd = new Date(endTime)
    
    const conflictingBookings = await prisma.booking.findMany({
      where: {
        resourceId,
        status: { in: ['approved', 'pending'] },
        // Optimized overlap check: bookings that start before our end AND end after our start
        startTime: { lt: bookingEnd },
        endTime: { gt: bookingStart },
      },
      select: { id: true } // Only need to know if conflict exists
    })

    if (conflictingBookings.length > 0) {
      return NextResponse.json(
        { error: "Det finnes allerede en booking i dette tidsrommet" },
        { status: 409 }
      )
    }

    // Beregn pris for booking (kun hvis prising er aktivert)
    let totalAmount: number | null = null
    const { isPricingEnabled, calculateBookingPrice } = await import("@/lib/pricing")
    const pricingEnabled = await isPricingEnabled()
    if (pricingEnabled) {
      const priceCalculation = await calculateBookingPrice(
        userId,
        resourceId,
        resourcePartId || null,
        new Date(startTime),
        new Date(endTime)
      )
      totalAmount = priceCalculation.price > 0 ? priceCalculation.price : null
    }

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        title,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status: resource.requiresApproval ? 'pending' : 'approved',
        contactName,
        contactEmail,
        contactPhone,
        organizationId: resource.organizationId,
        resourceId,
        resourcePartId: resourcePartId || null,
        userId,
        totalAmount,
      },
      include: {
        resource: true,
        resourcePart: true,
        payments: {
          select: {
            id: true,
            status: true,
            paymentMethod: true,
            amount: true
          }
        }
      },
    })

    // Send email notification to admins when booking requires approval (same as web API)
    if (resource.requiresApproval) {
      const orgId = resource.organizationId
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true }
      })
      const userName = user?.name || contactName || "Ukjent"
      const userEmail = user?.email || contactEmail || ""

      const sendEmailsAsync = async () => {
        try {
          const admins = await prisma.user.findMany({
            where: { organizationId: orgId, role: "admin" },
            select: { email: true }
          })
          const resourceModerators = await prisma.resourceModerator.findMany({
            where: { resourceId },
            include: {
              user: {
                select: { email: true, role: true }
              }
            }
          })
          const adminEmails = admins.map(a => a.email)
          const moderatorEmails = resourceModerators
            .filter(rm => rm.user.role === "moderator")
            .map(rm => rm.user.email)
          const allRecipients = [...new Set([...adminEmails, ...moderatorEmails])]

          if (allRecipients.length === 0) {
            console.warn("[Mobile booking] No admin/moderator emails to notify for org:", orgId)
            return
          }

          const { date, time } = formatBookingDateTime(new Date(booking.startTime), new Date(booking.endTime))
          const resourceName = booking.resourcePart
            ? `${booking.resource.name} → ${booking.resourcePart.name}`
            : booking.resource.name

          await Promise.all(allRecipients.map(async (email) => {
            const emailContent = await getNewBookingRequestEmail(
              orgId, title, resourceName, date, time, userName, userEmail, description, undefined
            )
            await sendEmail(orgId, { to: email, ...emailContent })
          }))
        } catch (error) {
          console.error("[Mobile booking] Failed to send admin notification emails:", error)
        }
      }

      await sendEmailsAsync()
    }

    return NextResponse.json({
      bookings: [booking],
      count: 1,
      message: resource.requiresApproval
        ? 'Booking sendt til godkjenning'
        : 'Booking opprettet',
    })
  } catch (error) {
    console.error("Error creating booking:", error)
    return NextResponse.json(
      { error: "Kunne ikke opprette booking" },
      { status: 500 }
    )
  }
}

