import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { calculateBookingPrice, isPricingEnabled } from "@/lib/pricing"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Sjekk om pricing er aktivert
  const pricingEnabled = await isPricingEnabled()
  if (!pricingEnabled) {
    return NextResponse.json({
      price: 0,
      isFree: true,
      reason: "Prislogikk er ikke aktivert",
      pricingModel: "FREE"
    })
  }

  try {
    const body = await request.json()
    const { resourceId, resourcePartId, startTime, endTime } = body

    if (!resourceId || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const priceCalculation = await calculateBookingPrice(
      session.user.id,
      resourceId,
      resourcePartId || null,
      new Date(startTime),
      new Date(endTime)
    )

    return NextResponse.json(priceCalculation)
  } catch (error) {
    console.error("Error calculating price:", error)
    return NextResponse.json(
      { error: "Failed to calculate price" },
      { status: 500 }
    )
  }
}



