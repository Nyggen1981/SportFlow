import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { startOfDay, endOfDay, addDays } from "date-fns"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const daysParam = searchParams.get("days") || "14"
    const days = parseInt(daysParam, 10)

    const now = new Date()
    const startDate = startOfDay(now)
    const endDate = endOfDay(addDays(now, days))

    const bookings = await prisma.booking.findMany({
      where: {
        resourceId: id,
        status: { in: ["APPROVED", "PENDING"] },
        startTime: { gte: startDate },
        endTime: { lte: endDate }
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        title: true,
        resourcePart: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { startTime: "asc" }
    })

    return NextResponse.json({ bookings })
  } catch (error) {
    console.error("Error fetching bookings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
