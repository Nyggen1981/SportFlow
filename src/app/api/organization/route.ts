import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

// Dynamisk - ingen server-side caching for å sikre ferske data
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get("slug")
    const noCache = searchParams.get("fresh") === "1" // For å tvinge fersk data
    
    let org
    if (slug) {
      // Find organization by slug if provided
      org = await prisma.organization.findUnique({
        where: { slug },
        select: {
          id: true,
          name: true,
          logo: true,
          tagline: true,
          primaryColor: true,
          requireUserApproval: true,
          allowSelfMembershipClaim: true,
          invoiceOrgNumber: true,
          invoiceAddress: true,
          invoicePhone: true,
          invoiceEmail: true,
        }
      })
    } else {
      // Check for preferred organization from environment variable
      const preferredSlug = process.env.PREFERRED_ORG_SLUG
      if (preferredSlug) {
        org = await prisma.organization.findUnique({
          where: { slug: preferredSlug },
          select: {
            id: true,
            name: true,
            logo: true,
            tagline: true,
            primaryColor: true,
            requireUserApproval: true,
            allowSelfMembershipClaim: true,
            invoiceOrgNumber: true,
            invoiceAddress: true,
            invoicePhone: true,
            invoiceEmail: true,
          }
        })
      }
      
      // Fallback to first organization if preferred not found
      if (!org) {
        org = await prisma.organization.findFirst({
          select: {
            id: true,
            name: true,
            logo: true,
            tagline: true,
            primaryColor: true,
            requireUserApproval: true,
            allowSelfMembershipClaim: true,
            invoiceOrgNumber: true,
            invoiceAddress: true,
            invoicePhone: true,
            invoiceEmail: true,
          }
        })
      }
    }

    // Add cache headers - kortere cache for registreringssiden
    return NextResponse.json(org, {
      headers: {
        'Cache-Control': noCache ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=120',
      }
    })
  } catch {
    return NextResponse.json(null)
  }
}

