import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  })

  let updated = 0
  for (const user of users) {
    const normalized = user.email.toLowerCase().trim()
    if (normalized !== user.email) {
      await prisma.user.update({
        where: { id: user.id },
        data: { email: normalized },
      })
      console.log(`Updated: ${user.email} -> ${normalized}`)
      updated++
    }
  }

  console.log(`\nDone. ${updated} of ${users.length} emails normalized.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
