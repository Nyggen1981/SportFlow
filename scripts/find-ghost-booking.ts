// Script to find and optionally delete ghost bookings blocking "Møterom / selskapslokale"
// Run with: npx tsx scripts/find-ghost-booking.ts

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function findGhostBooking() {
  console.log("🔍 Searching for bookings related to 'Møterom / selskapslokale'...\n")

  // Find the resource part
  const parts = await prisma.resourcePart.findMany({
    where: {
      name: { contains: "Møterom", mode: "insensitive" }
    },
    include: {
      resource: true
    }
  })

  console.log(`Found ${parts.length} parts matching 'Møterom':`)
  parts.forEach(part => {
    console.log(`  - ${part.name} (ID: ${part.id}) on resource: ${part.resource.name}`)
  })

  if (parts.length === 0) {
    console.log("\n⚠️ No parts found with 'Møterom' in name. Checking all parts...")
    const allParts = await prisma.resourcePart.findMany({
      include: { resource: true }
    })
    allParts.forEach(part => {
      console.log(`  - ${part.name} (Resource: ${part.resource.name})`)
    })
  }

  // Find bookings on Feb 6, 2026
  const targetDate = new Date("2026-02-06")
  const nextDay = new Date("2026-02-07")

  console.log("\n🔍 Searching for all bookings on Feb 6, 2026...\n")

  const bookingsOnDate = await prisma.booking.findMany({
    where: {
      startTime: { gte: targetDate, lt: nextDay }
    },
    include: {
      resource: true,
      resourcePart: true,
      user: { select: { name: true, email: true } }
    },
    orderBy: { startTime: "asc" }
  })

  console.log(`Found ${bookingsOnDate.length} bookings on Feb 6, 2026:`)
  bookingsOnDate.forEach(booking => {
    const partName = booking.resourcePart?.name || "Hele fasiliteten"
    console.log(`  - [${booking.status}] ${booking.title}`)
    console.log(`    Resource: ${booking.resource.name} → ${partName}`)
    console.log(`    Time: ${booking.startTime.toISOString()} - ${booking.endTime.toISOString()}`)
    console.log(`    ID: ${booking.id}`)
    console.log("")
  })

  // Find competitions that might block
  console.log("\n🔍 Searching for competitions that might block...\n")

  const competitions = await prisma.competition.findMany({
    where: {
      OR: [
        { startDate: { lte: nextDay }, endDate: { gte: targetDate } },
        { startDate: { lte: nextDay }, endDate: null }
      ]
    },
    include: {
      resource: true
    }
  })

  console.log(`Found ${competitions.length} competitions that might overlap:`)
  competitions.forEach(comp => {
    console.log(`  - ${comp.name} (Status: ${comp.status})`)
    console.log(`    Resource: ${comp.resource?.name || "None"}`)
    console.log(`    Dates: ${comp.startDate?.toISOString()} - ${comp.endDate?.toISOString() || "ongoing"}`)
    console.log(`    Daily block: ${comp.dailyStartTime || "none"} - ${comp.dailyEndTime || "none"}`)
    console.log(`    ID: ${comp.id}`)
    console.log("")
  })

  // Ask for deletion
  console.log("\n" + "=".repeat(60))
  console.log("To delete a specific booking or competition, run:")
  console.log("  npx tsx scripts/find-ghost-booking.ts --delete-booking <ID>")
  console.log("  npx tsx scripts/find-ghost-booking.ts --delete-competition <ID>")
}

async function deleteBooking(id: string) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { resource: true, resourcePart: true }
  })
  
  if (!booking) {
    console.log(`❌ Booking with ID ${id} not found`)
    return
  }

  console.log(`🗑️ Deleting booking: ${booking.title}`)
  console.log(`   Resource: ${booking.resource.name} → ${booking.resourcePart?.name || "Hele fasiliteten"}`)
  
  await prisma.booking.delete({ where: { id } })
  console.log("✅ Booking deleted!")
}

async function deleteCompetition(id: string) {
  const competition = await prisma.competition.findUnique({
    where: { id },
    include: { resource: true }
  })
  
  if (!competition) {
    console.log(`❌ Competition with ID ${id} not found`)
    return
  }

  console.log(`🗑️ Deleting competition: ${competition.name}`)
  console.log(`   Resource: ${competition.resource?.name || "None"}`)
  
  await prisma.competition.delete({ where: { id } })
  console.log("✅ Competition deleted!")
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args[0] === "--delete-booking" && args[1]) {
    await deleteBooking(args[1])
  } else if (args[0] === "--delete-competition" && args[1]) {
    await deleteCompetition(args[1])
  } else {
    await findGhostBooking()
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
