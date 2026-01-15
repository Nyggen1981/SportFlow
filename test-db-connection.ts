/**
 * Test database connection
 * Run: npx tsx test-db-connection.ts
 */

import { PrismaClient } from "@prisma/client"

async function testConnection() {
  const prisma = new PrismaClient()

  try {
    console.log("Testing database connection...")
    console.log("DATABASE_URL:", process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@"))
    console.log("DIRECT_URL:", process.env.DIRECT_URL?.replace(/:[^:@]+@/, ":****@"))
    
    // Try to connect
    await prisma.$connect()
    console.log("✅ Successfully connected to database!")
    
    // Try a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`
    console.log("✅ Query test successful:", result)
    
  } catch (error: any) {
    console.error("❌ Connection failed:")
    console.error("Error code:", error.code)
    console.error("Error message:", error.message)
    
    if (error.code === "P1001") {
      console.log("\n💡 Suggestions:")
      console.log("1. Check if the database is active in Neon console")
      console.log("2. Verify the connection string is correct")
      console.log("3. Try using DIRECT_URL instead of DATABASE_URL")
      console.log("4. Check your network/firewall settings")
      console.log("5. The database might be paused - wake it up in Neon console")
    }
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()


