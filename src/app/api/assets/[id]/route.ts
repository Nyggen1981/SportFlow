import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAssetRegisterEnabled } from "@/lib/asset-register"

// GET /api/assets/[id] - Hent enkelt anlegg med detaljer
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.systemRole !== "admin") {
      return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 })
    }

    const enabled = await isAssetRegisterEnabled()
    if (!enabled) {
      return NextResponse.json({ error: "Modul ikke aktivert" }, { status: 403 })
    }

    const asset = await prisma.asset.findFirst({
      where: { 
        id: params.id,
        organizationId: session.user.organizationId 
      },
      include: {
        resource: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        documents: {
          include: { uploadedBy: { select: { id: true, name: true } } },
          orderBy: { uploadedAt: "desc" }
        },
        maintenanceTasks: {
          include: { assignedTo: { select: { id: true, name: true } } },
          orderBy: { nextDueDate: "asc" }
        },
        maintenanceLogs: {
          include: { performedBy: { select: { id: true, name: true } } },
          orderBy: { completedAt: "desc" },
          take: 10
        }
      }
    })

    if (!asset) {
      return NextResponse.json({ error: "Anlegg ikke funnet" }, { status: 404 })
    }

    return NextResponse.json(asset)
  } catch (error) {
    console.error("Error fetching asset:", error)
    return NextResponse.json({ error: "Kunne ikke hente anlegg" }, { status: 500 })
  }
}

// PUT /api/assets/[id] - Oppdater anlegg
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.systemRole !== "admin") {
      return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 })
    }

    const enabled = await isAssetRegisterEnabled()
    if (!enabled) {
      return NextResponse.json({ error: "Modul ikke aktivert" }, { status: 403 })
    }

    // Sjekk at anlegget tilhører organisasjonen
    const existing = await prisma.asset.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId }
    })

    if (!existing) {
      return NextResponse.json({ error: "Anlegg ikke funnet" }, { status: 404 })
    }

    const data = await request.json()

    const asset = await prisma.asset.update({
      where: { id: params.id },
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
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
        status: data.status,
        condition: data.condition,
        notes: data.notes,
        images: data.images,
        resourceId: data.resourceId
      }
    })

    return NextResponse.json(asset)
  } catch (error) {
    console.error("Error updating asset:", error)
    return NextResponse.json({ error: "Kunne ikke oppdatere anlegg" }, { status: 500 })
  }
}

// DELETE /api/assets/[id] - Slett anlegg
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.systemRole !== "admin") {
      return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 })
    }

    const enabled = await isAssetRegisterEnabled()
    if (!enabled) {
      return NextResponse.json({ error: "Modul ikke aktivert" }, { status: 403 })
    }

    // Sjekk at anlegget tilhører organisasjonen
    const existing = await prisma.asset.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId }
    })

    if (!existing) {
      return NextResponse.json({ error: "Anlegg ikke funnet" }, { status: 404 })
    }

    await prisma.asset.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting asset:", error)
    return NextResponse.json({ error: "Kunne ikke slette anlegg" }, { status: 500 })
  }
}

