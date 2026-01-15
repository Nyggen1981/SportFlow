import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const debug: Record<string, any> = {
    timestamp: new Date().toISOString(),
    steps: []
  }
  
  try {
    // Step 1: Test session
    debug.steps.push("1. Getting session...")
    const session = await getServerSession(authOptions)
    debug.session = session ? { 
      hasUser: !!session.user,
      role: session.user?.role,
      organizationId: session.user?.organizationId
    } : null
    
    if (!session?.user) {
      debug.steps.push("1. FAILED - No session")
      return NextResponse.json(debug)
    }
    debug.steps.push("1. OK - Session found")

    // Step 2: Test basic database connection
    debug.steps.push("2. Testing database connection...")
    try {
      const count = await prisma.organization.count()
      debug.organizationCount = count
      debug.steps.push(`2. OK - ${count} organizations in database`)
    } catch (dbError: any) {
      debug.steps.push(`2. FAILED - ${dbError.message}`)
      debug.dbError = {
        message: dbError.message,
        code: dbError.code,
        name: dbError.name
      }
      return NextResponse.json(debug)
    }

    // Step 3: Test organization query
    debug.steps.push("3. Testing organization query...")
    try {
      const org = await prisma.organization.findUnique({
        where: { id: session.user.organizationId },
        select: {
          id: true,
          name: true,
          slug: true
        }
      })
      debug.organization = org
      debug.steps.push(org ? "3. OK - Organization found" : "3. FAILED - Organization not found")
    } catch (orgError: any) {
      debug.steps.push(`3. FAILED - ${orgError.message}`)
      debug.orgError = {
        message: orgError.message,
        code: orgError.code,
        name: orgError.name
      }
      return NextResponse.json(debug)
    }

    // Step 4: Test user query
    debug.steps.push("4. Testing user query...")
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          email: true,
          role: true
        }
      })
      debug.user = user
      debug.steps.push(user ? "4. OK - User found" : "4. FAILED - User not found")
    } catch (userError: any) {
      debug.steps.push(`4. FAILED - ${userError.message}`)
      debug.userError = {
        message: userError.message,
        code: userError.code,
        name: userError.name
      }
      return NextResponse.json(debug)
    }

    debug.steps.push("All tests passed!")
    debug.success = true
    
    return NextResponse.json(debug)
  } catch (error: any) {
    debug.steps.push(`UNEXPECTED ERROR: ${error.message}`)
    debug.error = {
      message: error.message,
      code: error.code,
      stack: error.stack
    }
    return NextResponse.json(debug)
  }
}

