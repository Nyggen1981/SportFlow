import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { isPricingEnabled, getPricingConfig, findPricingRuleForUser, findMemberPricingRule } from "@/lib/pricing"

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
    
    // Check if user is non-member to show member savings
    const memberRule = findMemberPricingRule(config.rules)
    const userPrice = rule.pricePerHour ?? rule.memberPricePerHour ?? rule.nonMemberPricePerHour ?? 0
    const memberPrice = memberRule?.pricePerHour ?? memberRule?.memberPricePerHour ?? null
    const isNonMember = rule.forRoles.includes("user") && !rule.forRoles.includes("member")
    
    // Check if prices are actually set (not just model type)
    const hasActualHourlyPrice = (rule.pricePerHour ?? rule.memberPricePerHour ?? rule.nonMemberPricePerHour) != null
    const hasActualDailyPrice = (rule.pricePerDay ?? rule.memberPricePerDay ?? rule.nonMemberPricePerDay) != null
    const hasActualFixedPrice = (rule.fixedPrice ?? rule.memberFixedPrice ?? rule.nonMemberFixedPrice) != null

    return NextResponse.json({
      enabled: true,
      // Only grant access if FREE or if the model matches AND has actual price set
      hasHourlyAccess: rule.model === "FREE" || (rule.model === "HOURLY" && hasActualHourlyPrice),
      hasDailyAccess: rule.model === "FREE" || (rule.model === "DAILY" && hasActualDailyPrice),
      hasFixedDurationAccess: rule.model === "FREE" || (rule.model === "FIXED_DURATION" && hasActualFixedPrice),
      isFree: rule.model === "FREE",
      isNonMember,
      rule: {
        model: rule.model,
        pricePerHour: rule.pricePerHour ?? rule.memberPricePerHour ?? rule.nonMemberPricePerHour,
        pricePerDay: rule.pricePerDay ?? rule.memberPricePerDay ?? rule.nonMemberPricePerDay,
        fixedPrice: rule.fixedPrice ?? rule.memberFixedPrice ?? rule.nonMemberFixedPrice,
        fixedPriceDuration: rule.fixedPriceDuration
      },
      // Member price for savings display (only if user is non-member and member price is lower)
      memberPricePerHour: isNonMember && memberPrice && memberPrice < userPrice ? memberPrice : undefined
    })
  } catch (error) {
    console.error("Error checking pricing access:", error)
    return NextResponse.json(
      { error: "Failed to check pricing access" },
      { status: 500 }
    )
  }
}

