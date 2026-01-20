import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { validateLicense } from "@/lib/license"

export async function GET() {
  try {
    // Sjekk lisens - returner tom liste hvis ugyldig
    const license = await validateLicense()
    if (!license.valid) {
      return NextResponse.json([])
    }

    const resources = await prisma.resource.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        location: true,
        image: true,
        color: true,
        isActive: true,
        showOnPublicCalendar: true,
        minBookingMinutes: true,
        maxBookingMinutes: true,
        requiresApproval: true,
        advanceBookingDays: true,
        allowWholeBooking: true,
        prisInfo: true,
        visPrisInfo: true,
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            description: true,
            icon: true
          }
        },
        parts: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            description: true,
            capacity: true,
            isActive: true
          },
          orderBy: {
            name: 'asc',
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json(resources)
  } catch (error) {
    console.error("Error fetching resources:", error)
    return NextResponse.json(
      { error: "Kunne ikke hente fasiliteter" },
      { status: 500 }
    )
  }
}

