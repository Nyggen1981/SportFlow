import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET user preferences
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let preferences = await prisma.userPreferences.findUnique({
    where: { userId: session.user.id }
  })

  // Return defaults if no preferences exist
  if (!preferences) {
    return NextResponse.json({
      defaultCalendarView: "week",
      defaultResourceId: null,
      selectedResourceIds: [],
      selectedCategoryIds: []
    })
  }

  return NextResponse.json({
    defaultCalendarView: preferences.defaultCalendarView,
    defaultResourceId: preferences.defaultResourceId,
    selectedResourceIds: preferences.selectedResourceIds 
      ? JSON.parse(preferences.selectedResourceIds) 
      : [],
    selectedCategoryIds: preferences.selectedCategoryIds 
      ? JSON.parse(preferences.selectedCategoryIds) 
      : []
  })
}

// PUT (upsert) user preferences
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      defaultCalendarView,
      defaultResourceId,
      selectedResourceIds,
      selectedCategoryIds
    } = body

    const preferences = await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        defaultCalendarView: defaultCalendarView || "week",
        defaultResourceId: defaultResourceId || null,
        selectedResourceIds: selectedResourceIds 
          ? JSON.stringify(selectedResourceIds) 
          : null,
        selectedCategoryIds: selectedCategoryIds 
          ? JSON.stringify(selectedCategoryIds) 
          : null
      },
      update: {
        defaultCalendarView: defaultCalendarView !== undefined 
          ? defaultCalendarView 
          : undefined,
        defaultResourceId: defaultResourceId !== undefined 
          ? defaultResourceId 
          : undefined,
        selectedResourceIds: selectedResourceIds !== undefined 
          ? JSON.stringify(selectedResourceIds) 
          : undefined,
        selectedCategoryIds: selectedCategoryIds !== undefined 
          ? JSON.stringify(selectedCategoryIds) 
          : undefined
      }
    })

    return NextResponse.json({
      defaultCalendarView: preferences.defaultCalendarView,
      defaultResourceId: preferences.defaultResourceId,
      selectedResourceIds: preferences.selectedResourceIds 
        ? JSON.parse(preferences.selectedResourceIds) 
        : [],
      selectedCategoryIds: preferences.selectedCategoryIds 
        ? JSON.parse(preferences.selectedCategoryIds) 
        : []
    })
  } catch (error) {
    console.error("Error updating preferences:", error)
    return NextResponse.json(
      { error: "Kunne ikke lagre preferanser" },
      { status: 500 }
    )
  }
}

