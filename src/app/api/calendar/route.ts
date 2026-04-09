import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { validateLicense } from "@/lib/license"
import { fromZonedTime } from "date-fns-tz"

const TIMEZONE = "Europe/Oslo"

export async function GET(request: Request) {
  try {
    // Sjekk lisens - returner tom liste hvis ugyldig
    const license = await validateLicense()
    if (!license.valid) {
      return NextResponse.json({ 
        bookings: [],
        licenseError: true,
        message: "Lisensen er ikke aktiv"
      })
    }

    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!start || !end) {
      return NextResponse.json(
        { error: "Start og slutt dato er påkrevd" },
        { status: 400 }
      )
    }

    const startDate = fromZonedTime(`${start}T00:00:00`, TIMEZONE)
    const endDate = fromZonedTime(`${end}T23:59:59.999`, TIMEZONE)

    const bookings = await prisma.booking.findMany({
      where: {
        startTime: {
          gte: startDate,
        },
        endTime: {
          lte: endDate,
        },
        status: {
          in: ['approved', 'pending'],
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        startTime: true,
        endTime: true,
        status: true,
        isRecurring: true,
        resource: {
          select: {
            id: true,
            name: true,
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
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        coOwners: {
          select: { userId: true },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    })

    return NextResponse.json({ bookings })
  } catch (error) {
    console.error("Error fetching calendar bookings:", error)
    return NextResponse.json(
      { error: "Kunne ikke hente bookinger" },
      { status: 500 }
    )
  }
}

