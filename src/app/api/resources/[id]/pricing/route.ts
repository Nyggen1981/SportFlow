import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isPricingEnabled } from "@/lib/pricing"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const pricingEnabled = await isPricingEnabled()
    
    if (!pricingEnabled) {
      return NextResponse.json({ hasPricing: false, pricingEnabled: false })
    }

    const resource = await prisma.resource.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        pricingModel: true,
        pricePerHour: true,
        fixedPricePackages: {
          select: {
            id: true,
            name: true,
            price: true,
            durationMinutes: true,
            description: true
          }
        },
        parts: {
          select: {
            id: true,
            name: true,
            pricingModel: true,
            pricePerHour: true
          }
        }
      }
    })

    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 })
    }

    const hasPricing = resource.pricingModel === "HOURLY" || resource.pricingModel === "FIXED" || 
                       (resource.fixedPricePackages && resource.fixedPricePackages.length > 0)

    return NextResponse.json({
      hasPricing,
      pricingEnabled: true,
      pricingModel: resource.pricingModel,
      pricePerHour: resource.pricePerHour,
      fixedPricePackages: resource.fixedPricePackages,
      parts: resource.parts?.map(part => ({
        id: part.id,
        name: part.name,
        hasPricing: part.pricingModel === "HOURLY" || part.pricingModel === "FIXED",
        pricingModel: part.pricingModel,
        pricePerHour: part.pricePerHour
      }))
    })
  } catch (error) {
    console.error("Error fetching pricing:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
