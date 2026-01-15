import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { isPricingEnabled, getPricingConfig, findPricingRuleForUser } from "@/lib/pricing"

// GET - Check what pricing access the current user has for a resource/part
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const pricingEnabled = await isPricingEnabled()
    if (!pricingEnabled) {
      return NextResponse.json({
        enabled: false,
        hasHourlyAccess: true, // No pricing = free access
        hasDailyAccess: true,
        hasFixedDurationAccess: true,
        isFree: true
      })
    }

    const { searchParams } = new URL(request.url)
    const resourceId = searchParams.get("resourceId")
    const resourcePartId = searchParams.get("resourcePartId")

    if (!resourceId) {
      return NextResponse.json({ error: "resourceId is required" }, { status: 400 })
    }

    // Get pricing config for the resource or part
    const config = await getPricingConfig(resourceId, resourcePartId || null)

    if (!config || config.rules.length === 0) {
      // No pricing rules = no access through hourly pricing
      return NextResponse.json({
        enabled: true,
        hasHourlyAccess: false,
        hasDailyAccess: false,
        hasFixedDurationAccess: false,
        isFree: false,
        rule: null
      })
    }

    // Find the rule that applies to this user
    const ruleMatch = await findPricingRuleForUser(session.user.id, config.rules)

    if (!ruleMatch.rule) {
      // No matching rule = no access
      return NextResponse.json({
        enabled: true,
        hasHourlyAccess: false,
        hasDailyAccess: false,
        hasFixedDurationAccess: false,
        isFree: false,
        rule: null
      })
    }

    const rule = ruleMatch.rule

    return NextResponse.json({
      enabled: true,
      hasHourlyAccess: rule.model === "HOURLY" || rule.model === "FREE",
      hasDailyAccess: rule.model === "DAILY" || rule.model === "FREE",
      hasFixedDurationAccess: rule.model === "FIXED_DURATION" || rule.model === "FREE",
      isFree: rule.model === "FREE",
      rule: {
        model: rule.model,
        pricePerHour: rule.pricePerHour ?? rule.memberPricePerHour ?? rule.nonMemberPricePerHour,
        pricePerDay: rule.pricePerDay ?? rule.memberPricePerDay ?? rule.nonMemberPricePerDay,
        fixedPrice: rule.fixedPrice ?? rule.memberFixedPrice ?? rule.nonMemberFixedPrice,
        fixedPriceDuration: rule.fixedPriceDuration
      }
    })
  } catch (error) {
    console.error("Error checking pricing access:", error)
    return NextResponse.json(
      { error: "Failed to check pricing access" },
      { status: 500 }
    )
  }
}

