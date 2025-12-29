import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!session.user.organizationId) {
      return NextResponse.json({ error: "Organization ID missing" }, { status: 400 })
    }

    // First try with all fields, fall back to basic fields if some don't exist
    let org
    try {
      org = await prisma.organization.findUnique({
        where: { id: session.user.organizationId },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          tagline: true,
          primaryColor: true,
          secondaryColor: true,
          requireUserApproval: true,
          smtpHost: true,
          smtpPort: true,
          smtpUser: true,
          smtpPass: true,
          smtpFrom: true,
          licenseKey: true,
          vippsClientId: true,
          vippsClientSecret: true,
          vippsSubscriptionKey: true,
          vippsTestMode: true,
          invoiceAddress: true,
          invoicePhone: true,
          invoiceEmail: true,
          invoiceOrgNumber: true,
          invoiceBankAccount: true,
          invoiceNotes: true,
          createdAt: true,
          updatedAt: true,
          isActive: true,
          subscriptionEndsAt: true,
          graceEndsAt: true
        }
      })
    } catch (selectError: any) {
      // If some fields don't exist, try with basic fields only
      console.warn("Full select failed, trying basic fields:", selectError.message)
      org = await prisma.organization.findUnique({
        where: { id: session.user.organizationId },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          tagline: true,
          primaryColor: true,
          secondaryColor: true,
          createdAt: true,
          updatedAt: true
        }
      })
    }

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    return NextResponse.json(org)
  } catch (error: any) {
    console.error("Error fetching organization settings:", error)
    return NextResponse.json(
      { 
        error: "Kunne ikke laste innstillinger",
        details: error?.message || "Unknown error",
        code: error?.code || "UNKNOWN",
        name: error?.name || "Error",
        stack: error?.stack?.split('\n').slice(0, 3) || [],
        version: "2024-12-16-v2" // Version marker to verify deployment
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { 
      name, 
      slug, 
      logo, 
      tagline, 
      primaryColor, 
      secondaryColor,
      requireUserApproval,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpFrom,
      licenseKey,
      vippsClientId,
      vippsClientSecret,
      vippsSubscriptionKey,
      vippsTestMode,
      invoiceAddress,
      invoicePhone,
      invoiceEmail,
      invoiceOrgNumber,
      invoiceBankAccount,
      invoiceNotes,
      isMvaRegistered
    } = await request.json()

    // Check if slug is already taken by another org
    if (slug) {
      const existing = await prisma.organization.findFirst({
        where: {
          slug,
          NOT: { id: session.user.organizationId }
        }
      })
      if (existing) {
        return NextResponse.json({ error: "Denne klubbkoden er allerede i bruk" }, { status: 400 })
      }
    }

    const updated = await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: {
        name,
        slug,
        logo,
        tagline,
        primaryColor,
        secondaryColor,
        requireUserApproval: requireUserApproval !== undefined ? requireUserApproval : true,
        smtpHost: smtpHost || null,
        smtpPort: smtpPort ? parseInt(smtpPort) : null,
        smtpUser: smtpUser || null,
        smtpPass: smtpPass || null,
        smtpFrom: smtpFrom || null,
        licenseKey: licenseKey || null,
        vippsClientId: vippsClientId || null,
        vippsClientSecret: vippsClientSecret || null,
        vippsSubscriptionKey: vippsSubscriptionKey || null,
        vippsTestMode: vippsTestMode !== undefined ? vippsTestMode : true,
        invoiceAddress: invoiceAddress || null,
        invoicePhone: invoicePhone || null,
        invoiceEmail: invoiceEmail || null,
        invoiceOrgNumber: invoiceOrgNumber || null,
        invoiceBankAccount: invoiceBankAccount || null,
        invoiceNotes: invoiceNotes || null,
        // isMvaRegistered legges til etter Prisma regenerering
        ...(isMvaRegistered !== undefined ? { isMvaRegistered: isMvaRegistered === true } : {}),
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating organization settings:", error)
    return NextResponse.json(
      { error: "Kunne ikke oppdatere innstillinger" },
      { status: 500 }
    )
  }
}
