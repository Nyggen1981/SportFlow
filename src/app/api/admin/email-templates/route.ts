import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getDefaultEmailTemplates } from "@/lib/email-templates"
import type { EmailTemplate } from "@prisma/client"

// GET all email templates for organization (with defaults)
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const organizationId = session.user.organizationId

  try {
    // Get custom templates from database
    // If table doesn't exist yet, return empty array (will use defaults)
    let customTemplates: EmailTemplate[] = []
    try {
      customTemplates = await prisma.emailTemplate.findMany({
        where: { organizationId },
      })
    } catch (error: any) {
      // If table doesn't exist (P2021), use empty array
      if (
        error?.code === "P2021" || 
        error?.code === "P2001" || 
        error?.code === "P2025" ||
        error?.message?.includes("does not exist") ||
        error?.message?.includes("Unknown arg") ||
        error?.message?.includes("emailTemplate") ||
        error?.message?.includes("Cannot read property") ||
        error?.message?.includes("is not a function")
      ) {
        console.warn("EmailTemplate table not found, using default templates")
      } else {
        throw error
      }
    }

    // Get default templates
    const defaults = getDefaultEmailTemplates()

    // Map templates with custom overrides
    const templateTypes: Array<"new_booking" | "approved" | "rejected" | "cancelled_by_admin" | "cancelled_by_user"> = [
      "new_booking",
      "approved",
      "rejected",
      "cancelled_by_admin",
      "cancelled_by_user",
    ]

    const templates = templateTypes.map((type) => {
      const custom = customTemplates.find((t) => t.templateType === type)
      const defaultTemplate = defaults[type]

      return {
        templateType: type,
        subject: custom?.subject || defaultTemplate.subject,
        htmlBody: custom?.htmlBody || defaultTemplate.htmlBody,
        isCustom: !!custom,
        customId: custom?.id || null,
      }
    })

    return NextResponse.json({ templates })
  } catch (error: any) {
    console.error("Error fetching email templates:", error)
    return NextResponse.json(
      { error: "Failed to fetch templates", message: error.message },
      { status: 500 }
    )
  }
}

// PUT - Save email template
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const organizationId = session.user.organizationId
  const { templateType, subject, htmlBody } = await request.json()

  // Validate template type
  const validTypes = ["new_booking", "approved", "rejected", "cancelled_by_admin", "cancelled_by_user"]
  if (!validTypes.includes(templateType)) {
    return NextResponse.json({ error: "Invalid template type" }, { status: 400 })
  }

  // Validate required fields
  if (!subject || !htmlBody) {
    return NextResponse.json({ error: "Subject and HTML body are required" }, { status: 400 })
  }

  try {
    // Try to upsert - if table doesn't exist, it will fail gracefully

    // Upsert template (create or update)
    const template = await prisma.emailTemplate.upsert({
      where: {
        organizationId_templateType: {
          organizationId,
          templateType,
        },
      },
      update: {
        subject,
        htmlBody,
      },
      create: {
        organizationId,
        templateType,
        subject,
        htmlBody,
      },
    })

    return NextResponse.json({ template, message: "E-postmal lagret" })
  } catch (error: any) {
    // Handle missing table/model gracefully
    if (
      error?.code === "P2021" || 
      error?.code === "P2001" || 
      error?.code === "P2025" ||
      error?.message?.includes("does not exist") ||
      error?.message?.includes("Unknown arg") ||
      error?.message?.includes("emailTemplate") ||
      error?.message?.includes("Cannot read property") ||
      error?.message?.includes("is not a function")
    ) {
      return NextResponse.json(
        { error: "EmailTemplate model not available. Please run 'prisma generate' and ensure database migration is complete." },
        { status: 503 }
      )
    }
    console.error("Error saving email template:", error)
    return NextResponse.json(
      { error: "Failed to save template", message: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Reset template to default
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const organizationId = session.user.organizationId
  const { searchParams } = new URL(request.url)
  const templateType = searchParams.get("templateType")

  if (!templateType) {
    return NextResponse.json({ error: "Template type is required" }, { status: 400 })
  }

  try {
    await prisma.emailTemplate.delete({
      where: {
        organizationId_templateType: {
          organizationId,
          templateType: templateType as any,
        },
      },
    })

    return NextResponse.json({ message: "E-postmal tilbakestilt til standard" })
  } catch (error: any) {
    // If template doesn't exist, that's fine - it's already using default
    if (error.code === "P2025") {
      return NextResponse.json({ message: "E-postmal tilbakestilt til standard" })
    }

    console.error("Error deleting email template:", error)
    return NextResponse.json(
      { error: "Failed to reset template", message: error.message },
      { status: 500 }
    )
  }
}

