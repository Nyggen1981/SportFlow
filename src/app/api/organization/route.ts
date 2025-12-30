import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

// Cache for 5 minutes
export const revalidate = 300

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get("slug")
    
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
            invoiceOrgNumber: true,
            invoiceAddress: true,
            invoicePhone: true,
            invoiceEmail: true,
          }
        })
      }
    }

    // Add cache headers
    return NextResponse.json(org, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      }
    })
  } catch {
    return NextResponse.json(null)
  }
}

