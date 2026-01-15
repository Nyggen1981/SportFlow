import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { clearLicenseCache } from "@/lib/license"

export const dynamic = "force-dynamic"

export async function POST() {
  try {
    // Kun admin kan tømme lisens-cache
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Tøm cache
    clearLicenseCache()

    return NextResponse.json({ success: true, message: "Cache tømt" })
  } catch (error) {
    console.error("Error clearing license cache:", error)
    return NextResponse.json({ error: "Failed to clear cache" }, { status: 500 })
  }
}

