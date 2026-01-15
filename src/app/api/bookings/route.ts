import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { addWeeks, addMonths, format } from "date-fns"
import { nb } from "date-fns/locale"
import { sendEmail, getNewBookingRequestEmail } from "@/lib/email"
import { validateLicense } from "@/lib/license"
import { calculateBookingPrice } from "@/lib/pricing"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Sjekk lisens - blokker booking hvis ugyldig
  const license = await validateLicense()
  if (!license.valid) {
    return NextResponse.json(
      { error: "Lisensen er ikke aktiv. Kontakt administrator." },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const {
      resourceId,
      resourcePartId, // Legacy support
      resourcePartIds, // New: array of part IDs
      title,
      description,
      startTime,
      endTime,
      contactName,
      contactEmail,
      contactPhone,
      isRecurring,
      recurringType,
      recurringEndDate,
      preferredPaymentMethod, // Brukerens foretrukne betalingsmetode (kun hvis pricing er aktivert)
      fixedPricePackageId // ID til fastprispakke hvis bruker har valgt en
    } = body

    // Normalize to array: use resourcePartIds if provided, otherwise use resourcePartId as single-item array
    const partIds: string[] = resourcePartIds || (resourcePartId ? [resourcePartId] : [])

    // Validate required fields
    if (!resourceId || !title || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Mangler påkrevde felt" },
        { status: 400 }
      )
    }

    // Get resource to check settings
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId }
    })

    if (!resource) {
      return NextResponse.json(
        { error: "Ressurs ikke funnet" },
        { status: 404 }
      )
    }

    // Validate booking duration
    const start = new Date(startTime)
    const end = new Date(endTime)
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60)
    const durationHours = durationMinutes / 60

    // Validate minimum hours (uavhengig av lisens)
    // Hopp over validering hvis fastpris-pakke er valgt (pakken har sin egen varighet)
    if (!fixedPricePackageId && resource.minBookingHours !== null && resource.minBookingHours !== undefined) {
      if (durationHours < Number(resource.minBookingHours)) {
        return NextResponse.json(
          { error: `Minimum antall timer er ${Number(resource.minBookingHours)} timer` },
          { status: 400 }
        )
      }
    }

    // Only validate duration if limits are set (0/9999 or null = unlimited)
    const hasMinLimit = resource.minBookingMinutes !== null && resource.minBookingMinutes !== 0
    const hasMaxLimit = resource.maxBookingMinutes !== null && resource.maxBookingMinutes !== 9999

    if (hasMinLimit && durationMinutes < resource.minBookingMinutes!) {
      return NextResponse.json(
        { error: `Minimum varighet er ${resource.minBookingMinutes} minutter` },
        { status: 400 }
      )
    }

    if (hasMaxLimit && durationMinutes > resource.maxBookingMinutes!) {
      return NextResponse.json(
        { error: `Maksimum varighet er ${resource.maxBookingMinutes} minutter` },
        { status: 400 }
      )
    }

    // Generate all booking dates
    const bookingDates: { start: Date; end: Date }[] = [{ start, end }]
    
    if (isRecurring && recurringEndDate) {
      const endDateLimit = new Date(recurringEndDate)
      endDateLimit.setHours(23, 59, 59, 999)
      
      let currentStart = start
      let currentEnd = end
      
      while (true) {
        // Calculate next occurrence
        if (recurringType === "weekly") {
          currentStart = addWeeks(currentStart, 1)
          currentEnd = addWeeks(currentEnd, 1)
        } else if (recurringType === "biweekly") {
          currentStart = addWeeks(currentStart, 2)
          currentEnd = addWeeks(currentEnd, 2)
        } else if (recurringType === "monthly") {
          currentStart = addMonths(currentStart, 1)
          currentEnd = addMonths(currentEnd, 1)
        }
        
        if (currentStart > endDateLimit) break
        
        bookingDates.push({ start: new Date(currentStart), end: new Date(currentEnd) })
        
        // Safety limit to prevent infinite loops
        if (bookingDates.length > 52) break
      }
    }

    // Check for conflicts on all dates
    // Conflict logic:
    // 1. If booking whole facility (resourcePartId = null): conflicts with any part booking
    // 2. If booking a part: conflicts with whole facility booking OR same part booking
    
    const getTimeOverlapConditions = (bookingStart: Date, bookingEnd: Date) => [
      {
        AND: [
          { startTime: { lte: bookingStart } },
          { endTime: { gt: bookingStart } }
        ]
      },
      {
        AND: [
          { startTime: { lt: bookingEnd } },
          { endTime: { gte: bookingEnd } }
        ]
      },
      {
        AND: [
          { startTime: { gte: bookingStart } },
          { endTime: { lte: bookingEnd } }
        ]
      }
    ]

    for (const { start: bookingStart, end: bookingEnd } of bookingDates) {
      // Time overlap conditions
      const timeOverlapConditions = getTimeOverlapConditions(bookingStart, bookingEnd)
      
      // Base filter: same resource, not cancelled/rejected, overlapping time
      const baseFilter = {
        resourceId,
        status: { notIn: ["cancelled", "rejected"] },
        OR: timeOverlapConditions
      }
      
      let conflictingBookings
      
      if (partIds.length === 0) {
        // Booking whole facility - check if ANY part is booked
        conflictingBookings = await prisma.booking.findMany({
          where: baseFilter,
          select: { id: true, status: true, resourcePart: { select: { name: true } } }
        })
      } else {
        // Booking one or more specific parts
        // Get all parts to check their hierarchy
        const bookingParts = await prisma.resourcePart.findMany({
          where: { id: { in: partIds } },
          include: {
            parent: true,
            children: true
          }
        })
        
        if (bookingParts.length !== partIds.length) {
          return NextResponse.json(
            { error: "En eller flere deler ikke funnet" },
            { status: 404 }
          )
        }
        
        // Build list of part IDs to check for conflicts:
        // 1. The parts themselves
        // 2. All children (if booking parent, children are blocked)
        // 3. The parents (if booking child, parent is blocked)
        const partIdsToCheck: string[] = [...partIds]
        
        for (const bookingPart of bookingParts) {
          // If this part has children, add all children IDs
          if (bookingPart.children && bookingPart.children.length > 0) {
            const childIds = bookingPart.children.map(c => c.id)
            partIdsToCheck.push(...childIds)
          }
          
          // If this part has a parent, add parent ID
          if (bookingPart.parentId) {
            partIdsToCheck.push(bookingPart.parentId)
          }
        }
        
        // Check for conflicts: same parts OR whole facility OR parent/children
        conflictingBookings = await prisma.booking.findMany({
          where: {
            resourceId,
            status: { notIn: ["cancelled", "rejected"] },
            OR: [
              {
                resourcePartId: { in: partIdsToCheck },
                AND: { OR: timeOverlapConditions }
              },
              {
                resourcePartId: null,
                AND: { OR: timeOverlapConditions }
              }
            ]
          },
          select: { id: true, status: true, resourcePart: { select: { name: true } } }
        })
      }

      if (conflictingBookings.length > 0) {
        const conflictDate = bookingStart.toLocaleDateString("nb-NO")
        const conflict = conflictingBookings[0]
        const conflictInfo = conflict.resourcePart 
          ? `"${conflict.resourcePart.name}"` 
          : "hele fasiliteten"
        
        return NextResponse.json(
          { error: `Konflikt ${conflictDate}: ${conflictInfo} er allerede booket i dette tidsrommet` },
          { status: 409 }
        )
      }

      // Sjekk også for konkurranser som blokkerer denne fasiliteten (kun hvis kampoppsett-modulen er aktivert)
      const { isMatchSetupEnabled } = await import("@/lib/match-setup")
      const matchSetupEnabled = await isMatchSetupEnabled()
      
      if (matchSetupEnabled) {
        const conflictingCompetitions = await prisma.competition.findMany({
          where: {
            resourceId,
            status: { in: ["DRAFT", "SCHEDULED", "ACTIVE"] },
            OR: [
              // Konkurransen har individuelle kamper som overlapper
              {
                matches: {
                  some: {
                    scheduledTime: { lte: bookingStart }
                  }
                }
              },
              // Konkurransen blokkerer med daglige tidspunkter
              {
                dailyStartTime: { not: null },
                dailyEndTime: { not: null },
                startDate: { lte: bookingEnd },
                OR: [
                  { endDate: { gte: bookingStart } },
                  { endDate: null }
                ]
              }
            ]
          },
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            dailyStartTime: true,
            dailyEndTime: true,
            matchDuration: true,
            matches: {
              select: {
                scheduledTime: true
              }
            }
          }
        })

        // Sjekk om noen av konkurransene faktisk overlapper med booking-tiden
        for (const comp of conflictingCompetitions) {
          // Sjekk individuelle kamper
          for (const match of comp.matches) {
            if (match.scheduledTime) {
              const matchStart = new Date(match.scheduledTime)
              const matchEnd = new Date(matchStart.getTime() + (comp.matchDuration * 60 * 1000))
              
              // Sjekk om kampens tidspunkt overlapper med bookingen
              if (matchStart < bookingEnd && matchEnd > bookingStart) {
                const conflictDate = bookingStart.toLocaleDateString("nb-NO")
                return NextResponse.json(
                  { error: `Konflikt ${conflictDate}: Fasiliteten er reservert for konkurransen "${comp.name}"` },
                  { status: 409 }
                )
              }
            }
          }

          // Sjekk daglige blokkeringer
          if (comp.dailyStartTime && comp.dailyEndTime) {
            const compStart = new Date(comp.startDate)
            const compEnd = comp.endDate ? new Date(comp.endDate) : compStart
            
            // Sjekk om booking-datoen er innenfor konkurranseperioden
            const bookingDate = new Date(bookingStart)
            bookingDate.setHours(0, 0, 0, 0)
            
            if (bookingDate >= compStart && bookingDate <= compEnd) {
              // Sjekk om tidspunktet overlapper med daglig blokkering
              const [startHour, startMin] = comp.dailyStartTime.split(":").map(Number)
              const [endHour, endMin] = comp.dailyEndTime.split(":").map(Number)
              
              const blockStart = new Date(bookingDate)
              blockStart.setHours(startHour, startMin, 0, 0)
              
              const blockEnd = new Date(bookingDate)
              blockEnd.setHours(endHour, endMin, 0, 0)
              
              // Sjekk overlapp
              if (blockStart < bookingEnd && blockEnd > bookingStart) {
                const conflictDate = bookingStart.toLocaleDateString("nb-NO")
                return NextResponse.json(
                  { error: `Konflikt ${conflictDate}: Fasiliteten er reservert for konkurransen "${comp.name}" (${comp.dailyStartTime}-${comp.dailyEndTime})` },
                  { status: 409 }
                )
              }
            }
          }
        }
      }
    }

    // Create all bookings
    // If multiple parts selected, create one booking per part
    // If single part or whole facility, create one booking
    const isRecurringBooking = isRecurring && bookingDates.length > 1
    const partsToBook = partIds.length > 0 ? partIds : [null] // null = whole facility
    
    const allCreatedBookings = []
    
    // If a fixed price package is selected, fetch it for price
    let fixedPricePackage = null
    if (fixedPricePackageId) {
      fixedPricePackage = await prisma.fixedPricePackage.findUnique({
        where: { id: fixedPricePackageId }
      })
    }

    for (const partId of partsToBook) {
      // Beregn pris for booking (kun hvis prising er aktivert)
      // If using a fixed price package, use its price instead
      let priceCalculation
      if (fixedPricePackage) {
        priceCalculation = {
          price: Number(fixedPricePackage.price),
          isFree: Number(fixedPricePackage.price) === 0
        }
      } else {
        priceCalculation = await calculateBookingPrice(
          session.user.id,
          resourceId,
          partId,
          bookingDates[0].start,
          bookingDates[0].end
        )
      }
      
      // Create parent booking for this part
      // Bygg booking data objekt - kun inkluder preferredPaymentMethod hvis det er definert
      const bookingData: any = {
        title,
        description,
        startTime: bookingDates[0].start,
        endTime: bookingDates[0].end,
        status: resource.requiresApproval ? "pending" : "approved",
        approvedAt: resource.requiresApproval ? null : new Date(),
        contactName,
        contactEmail,
        contactPhone,
        organizationId: session.user.organizationId,
        resourceId,
        resourcePartId: partId,
        userId: session.user.id,
        isRecurring: isRecurringBooking,
        recurringPattern: isRecurringBooking ? recurringType : null,
        recurringEndDate: isRecurringBooking ? new Date(recurringEndDate) : null,
        totalAmount: priceCalculation.price > 0 ? priceCalculation.price : null
      }
      
      // Legg til preferredPaymentMethod hvis det er definert (uavhengig av pris)
      if (preferredPaymentMethod) {
        bookingData.preferredPaymentMethod = preferredPaymentMethod
      }
      
      // Legg til fixedPricePackageId hvis det er definert
      if (fixedPricePackageId) {
        bookingData.fixedPricePackageId = fixedPricePackageId
      }
      
      const parentBooking = await prisma.booking.create({
        data: bookingData
      })
      
      allCreatedBookings.push(parentBooking)

      // Then create child bookings if recurring
      if (isRecurringBooking && bookingDates.length > 1) {
        // Beregn pris for hver child booking først
        const childBookingsData = await Promise.all(
          bookingDates.slice(1).map(async ({ start: bookingStart, end: bookingEnd }) => {
            const childPrice = await calculateBookingPrice(
              session.user.id,
              resourceId,
              partId,
              bookingStart,
              bookingEnd
            )
            
            return {
              start: bookingStart,
              end: bookingEnd,
              price: childPrice.price
            }
          })
        )
        
        // Opprett child bookings i en transaksjon
        const childBookings = await prisma.$transaction(
          childBookingsData.map(({ start: bookingStart, end: bookingEnd, price }) => {
            const childBookingData: any = {
              title,
              description,
              startTime: bookingStart,
              endTime: bookingEnd,
              status: resource.requiresApproval ? "pending" : "approved",
              approvedAt: resource.requiresApproval ? null : new Date(),
              contactName,
              contactEmail,
              contactPhone,
              organizationId: session.user.organizationId,
              resourceId,
              resourcePartId: partId,
              userId: session.user.id,
              isRecurring: true,
              recurringPattern: recurringType,
              recurringEndDate: new Date(recurringEndDate),
              parentBookingId: parentBooking.id,
              totalAmount: price > 0 ? price : null
            }
            
            // Legg til preferredPaymentMethod hvis det er definert (uavhengig av pris)
            if (preferredPaymentMethod) {
              childBookingData.preferredPaymentMethod = preferredPaymentMethod
            }
            
            // Legg til fixedPricePackageId hvis det er definert
            if (fixedPricePackageId) {
              childBookingData.fixedPricePackageId = fixedPricePackageId
            }
            
            return prisma.booking.create({
              data: childBookingData
            })
          })
        )
        allCreatedBookings.push(...childBookings)
      }
    }

    const createdBookings = allCreatedBookings

    // Send email notification to admins if booking requires approval (non-blocking)
    if (resource.requiresApproval && createdBookings.length > 0) {
      const firstBooking = createdBookings[0]
      const orgId = session.user.organizationId
      const userName = session.user.name || contactName || "Ukjent"
      const userEmail = session.user.email || contactEmail || ""
      
      // Fire and forget - don't block the response
      const sendEmailsAsync = async () => {
        try {
          // Hent alle admin-brukere
          const admins = await prisma.user.findMany({
            where: { organizationId: orgId, role: "admin" },
            select: { email: true }
          })

          // Hent alle moderatorer som har tilgang til denne ressursen
          const resourceModerators = await prisma.resourceModerator.findMany({
            where: { resourceId: resource.id },
            include: {
              user: {
                select: { email: true, role: true }
              }
            }
          })

          // Kombiner admin og moderator e-poster (unngå duplikater)
          const adminEmails = admins.map(a => a.email)
          const moderatorEmails = resourceModerators
            .filter(rm => rm.user.role === "moderator")
            .map(rm => rm.user.email)
          
          const allRecipients = [...new Set([...adminEmails, ...moderatorEmails])]

          const date = format(new Date(firstBooking.startTime), "EEEE d. MMMM yyyy", { locale: nb })
          const time = `${format(new Date(firstBooking.startTime), "HH:mm")} - ${format(new Date(firstBooking.endTime), "HH:mm")}`
          
          let resourceName = resource.name
          if (resourcePartId) {
            const part = await prisma.resourcePart.findUnique({ 
              where: { id: resourcePartId },
              select: { name: true }
            })
            if (part) resourceName = `${resource.name} → ${part.name}`
          }

          // Send emails in parallel
          await Promise.all(allRecipients.map(async (email) => {
            const emailContent = await getNewBookingRequestEmail(
              orgId, title, resourceName, date, time, userName, userEmail, description
            )
            await sendEmail(orgId, { to: email, ...emailContent })
          }))
        } catch (error) {
          console.error("Failed to send booking notification emails:", error)
        }
      }
      
      void sendEmailsAsync()
    }

    return NextResponse.json(
      { 
        bookings: createdBookings, 
        count: createdBookings.length,
        message: createdBookings.length > 1 
          ? `${createdBookings.length} bookinger opprettet` 
          : "Booking opprettet"
      }, 
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating booking:", error)
    return NextResponse.json(
      { 
        error: "Kunne ikke opprette booking",
        // Midlertidig ekstra info for feilsøking i prod
        details: (error as any)?.message || String(error),
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const bookings = await prisma.booking.findMany({
    where: {
      userId: session.user.id
    },
    select: {
      id: true,
      title: true,
      description: true,
      startTime: true,
      endTime: true,
      status: true,
      statusNote: true,
      totalAmount: true,
      invoiceId: true,
      isRecurring: true,
      parentBookingId: true,
      invoice: {
        select: {
          id: true,
          status: true,
          invoiceNumber: true
        }
      },
      preferredPaymentMethod: true,
      resource: {
        select: {
          id: true,
          name: true,
          location: true,
          color: true,
          category: {
            select: {
              id: true,
              name: true,
              color: true
            }
          }
        }
      },
      resourcePart: {
        select: { 
          id: true,
          name: true 
        }
      },
      payments: {
        select: {
          id: true,
          status: true,
          paymentMethod: true,
          amount: true
        }
      },
      fixedPricePackage: {
        select: {
          id: true,
          name: true,
          durationMinutes: true,
          price: true
        }
      }
    },
    orderBy: { startTime: "desc" }
  })

  return NextResponse.json(bookings)
}

