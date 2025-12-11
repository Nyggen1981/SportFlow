import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!start || !end) {
      return NextResponse.json(
        { error: "Start og slutt dato er påkrevd" },
        { status: 400 }
      )
    }

    const startDate = new Date(start)
    const endDate = new Date(end)
    endDate.setHours(23, 59, 59, 999)

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
      include: {
        resource: true,
        resourcePart: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
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

