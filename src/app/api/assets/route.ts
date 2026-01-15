import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAssetRegisterEnabled } from "@/lib/asset-register"

// GET /api/assets - Hent alle anlegg
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.systemRole !== "admin") {
      return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 })
    }

    const enabled = await isAssetRegisterEnabled()
    if (!enabled) {
      return NextResponse.json({ error: "Modul ikke aktivert" }, { status: 403 })
    }

    const assets = await prisma.asset.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        resource: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: {
          select: {
            maintenanceTasks: true,
            maintenanceLogs: true,
            documents: true
          }
        }
      },
      orderBy: { name: "asc" }
    })

    // Beregn statistikk
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const tasks = await prisma.maintenanceTask.findMany({
      where: {
        asset: { organizationId: session.user.organizationId },
        status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] }
      },
      select: { id: true, nextDueDate: true, status: true }
    })

    const stats = {
      totalAssets: assets.length,
      totalTasks: tasks.length,
      dueSoon: tasks.filter(t => 
        t.nextDueDate && 
        t.nextDueDate > now && 
        t.nextDueDate <= sevenDaysFromNow
      ).length,
      overdue: tasks.filter(t => 
        t.status === "OVERDUE" || 
        (t.nextDueDate && t.nextDueDate < now && t.status === "PENDING")
      ).length
    }

    return NextResponse.json({ assets, stats })
  } catch (error) {
    console.error("Error fetching assets:", error)
    return NextResponse.json({ error: "Kunne ikke hente anlegg" }, { status: 500 })
  }
}

// POST /api/assets - Opprett nytt anlegg
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.systemRole !== "admin") {
      return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 })
    }

    const enabled = await isAssetRegisterEnabled()
    if (!enabled) {
      return NextResponse.json({ error: "Modul ikke aktivert" }, { status: 403 })
    }

    const data = await request.json()

    const asset = await prisma.asset.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category || "OTHER",
        customCategory: data.customCategory,
        location: data.location,
        serialNumber: data.serialNumber,
        manufacturer: data.manufacturer,
        model: data.model,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
        purchasePrice: data.purchasePrice,
        supplier: data.supplier,
        warrantyExpires: data.warrantyExpires ? new Date(data.warrantyExpires) : null,
        currentValue: data.currentValue,
        expectedLifeYears: data.expectedLifeYears,
        status: data.status || "ACTIVE",
        condition: data.condition || "GOOD",
        notes: data.notes,
        images: data.images || [],
        organizationId: session.user.organizationId,
        resourceId: data.resourceId,
        createdById: session.user.id
      }
    })

    return NextResponse.json(asset)
  } catch (error) {
    console.error("Error creating asset:", error)
    return NextResponse.json({ error: "Kunne ikke opprette anlegg" }, { status: 500 })
  }
}

