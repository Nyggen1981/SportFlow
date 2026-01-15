import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Export user's own data (GDPR - Right to data portability)
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  try {
    // Fetch all user's data
    const [user, bookings, preferences] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          isApproved: true,
          approvedAt: true,
          emailVerified: true,
          emailVerifiedAt: true,
          isMember: true,
          createdAt: true,
          updatedAt: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            }
          }
        }
      }),
      prisma.booking.findMany({
        where: { userId },
        include: {
          resource: {
            select: {
              id: true,
              name: true,
              description: true,
            }
          },
          resourcePart: {
            select: {
              id: true,
              name: true,
            }
          },
          organization: {
            select: {
              id: true,
              name: true,
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      }),
      prisma.userPreferences.findUnique({
        where: { userId }
      })
    ])

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        ...user,
        password: undefined, // Never export password
      },
      bookings: bookings.map(booking => ({
        id: booking.id,
        title: booking.title,
        description: booking.description,
        startTime: (booking.startTime instanceof Date ? booking.startTime : new Date(booking.startTime)).toISOString(),
        endTime: (booking.endTime instanceof Date ? booking.endTime : new Date(booking.endTime)).toISOString(),
        status: booking.status,
        statusNote: booking.statusNote,
        contactName: booking.contactName,
        contactEmail: booking.contactEmail,
        contactPhone: booking.contactPhone,
        isRecurring: booking.isRecurring,
        recurringPattern: booking.recurringPattern,
        recurringEndDate: booking.recurringEndDate?.toISOString(),
        createdAt: booking.createdAt.toISOString(),
        updatedAt: booking.updatedAt.toISOString(),
        approvedAt: booking.approvedAt?.toISOString(),
        resource: booking.resource,
        resourcePart: booking.resourcePart,
        organization: booking.organization,
      })),
      preferences: preferences || null,
    }

    return NextResponse.json(exportData)
  } catch (error: any) {
    console.error("Error exporting user data:", error)
    return NextResponse.json(
      { error: "Failed to export data", message: error.message },
      { status: 500 }
    )
  }
}

