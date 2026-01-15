import { NextResponse } from "next/server"
import { isAssetRegisterEnabled } from "@/lib/asset-register"

export async function GET() {
  try {
    const enabled = await isAssetRegisterEnabled()
    return NextResponse.json({ enabled })
  } catch (error) {
    console.error("[API] Error checking asset-register module:", error)
    return NextResponse.json({ enabled: false })
  }
}

