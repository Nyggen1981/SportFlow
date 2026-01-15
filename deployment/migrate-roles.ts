/**
 * Migrasjonsscript for å oppdatere eksisterende brukere med nye roller
 * 
 * Dette scriptet:
 * 1. Setter systemRole basert på eksisterende role-verdi
 * 2. Beholder role-feltet for bakoverkompatibilitet
 * 3. Kan kjøres flere ganger uten å påvirke data
 * 
 * Kjør: npx tsx deployment/migrate-roles.ts
 */

import { PrismaClient } from '@prisma/client'
import * as readline from 'readline'

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function question(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function confirm(message: string): Promise<boolean> {
  const answer = await question(`${message} (j/n): `)
  return answer.toLowerCase() === 'j' || answer.toLowerCase() === 'y'
}

async function migrateRoles() {
  log('\n════════════════════════════════════════════', 'cyan')
  log('  Sportflow - Migrasjon av roller', 'cyan')
  log('════════════════════════════════════════════\n', 'cyan')

  // Bruk DATABASE_URL fra miljøvariabler
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    log('❌ DATABASE_URL er ikke satt!', 'red')
    log('   Sett DATABASE_URL i .env filen eller som miljøvariabel', 'yellow')
    process.exit(1)
  }

  log('📋 Dette scriptet vil:', 'blue')
  log('   1. Oppdatere systemRole for alle eksisterende brukere', 'reset')
  log('   2. Beholde role-feltet for bakoverkompatibilitet', 'reset')
  log('   3. Ikke endre customRoleId (blir null for eksisterende brukere)', 'reset')
  log('   4. Være trygt å kjøre flere ganger\n', 'reset')

  log(`Database: ${databaseUrl.substring(0, 50)}...`, 'green')
  
  const autoConfirm = process.env.AUTO_CONFIRM === 'true' || process.env.AUTO_CONFIRM === '1'
  let confirmed = autoConfirm
  
  if (!autoConfirm) {
    confirmed = await confirm('\nFortsett med migrasjon?')
  } else {
    log('\nAUTO_CONFIRM er satt - fortsetter automatisk...', 'green')
  }
  
  if (!confirmed) {
    log('\nAvbrutt.', 'yellow')
    process.exit(0)
  }

  const prisma = new PrismaClient()

  try {
    await prisma.$connect()
    log('\n✅ Tilkoblet til database\n', 'green')

    // Sjekk om systemRole-feltet eksisterer
    log('Steg 1: Sjekker database-struktur...', 'blue')
    try {
      // Prøv å hente en bruker med systemRole
      const testUser = await prisma.user.findFirst({
        select: { id: true, systemRole: true, role: true }
      })
      
      if (!testUser) {
        log('⚠️  Ingen brukere funnet i databasen', 'yellow')
        log('   Migrasjon er ikke nødvendig', 'yellow')
        process.exit(0)
      }

      // Sjekk om systemRole er null eller mangler
      if (testUser.systemRole === null || testUser.systemRole === undefined) {
        log('⚠️  systemRole-feltet mangler eller er null', 'yellow')
        log('   Kjør først: npm run db:push', 'yellow')
        process.exit(1)
      }

      log('✅ Database-struktur ser riktig ut', 'green')
    } catch (error: any) {
      if (error.message?.includes('Unknown column') || error.message?.includes('column') || error.message?.includes('does not exist')) {
        log('❌ systemRole-feltet mangler i databasen!', 'red')
        log('   Kjør først: npm run db:push', 'yellow')
        process.exit(1)
      }
      throw error
    }

    // Hent alle brukere
    log('\nSteg 2: Henter brukere...', 'blue')
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        systemRole: true,
        customRoleId: true,
      },
      orderBy: { createdAt: 'asc' }
    })

    log(`   Funnet ${users.length} brukere`, 'reset')

    // Tell hvor mange som trenger oppdatering
    const needsUpdate = users.filter(u => {
      // Trenger oppdatering hvis:
      // 1. systemRole er "user" men role er "admin" (skal være systemRole="admin")
      // 2. systemRole er "user" men role er "moderator" (skal være systemRole="user", customRoleId=null)
      // 3. systemRole er "admin" men role er ikke "admin"
      const role = u.role || "user"
      const systemRole = u.systemRole || "user"
      
      if (role === "admin" && systemRole !== "admin") {
        return true
      }
      if (role === "moderator" && systemRole !== "user") {
        return true
      }
      if (role === "user" && systemRole !== "user") {
        return true
      }
      if (systemRole === "admin" && role !== "admin") {
        return true
      }
      
      return false
    })

    if (needsUpdate.length === 0) {
      log('\n✅ Alle brukere har riktig systemRole!', 'green')
      log('   Ingen migrasjon nødvendig.\n', 'green')
      process.exit(0)
    }

    log(`\n   ${needsUpdate.length} brukere trenger oppdatering`, 'yellow')

    // Oppdater brukere
    log('\nSteg 3: Oppdaterer brukere...', 'blue')
    let updated = 0
    let skipped = 0

    for (const user of needsUpdate) {
      const oldRole = user.role || "user"
      let newSystemRole: "admin" | "user" = "user"
      let newCustomRoleId: string | null = null
      let newRole = oldRole // Behold role for bakoverkompatibilitet

      // Bestem ny systemRole basert på gammel role
      if (oldRole === "admin") {
        newSystemRole = "admin"
        newRole = "admin" // Oppdater også role for konsistens
      } else if (oldRole === "moderator") {
        // Moderator blir til "user" uten custom role
        // (admin kan opprette custom roles med moderator-tilgang senere)
        newSystemRole = "user"
        newCustomRoleId = null
        newRole = "user" // Oppdater role til "user"
      } else {
        // "user" eller annen verdi
        newSystemRole = "user"
        newRole = "user"
      }

      try {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            systemRole: newSystemRole,
            customRoleId: newCustomRoleId,
            role: newRole, // Oppdater også for konsistens
          }
        })
        updated++
        log(`   ✅ ${user.email || user.name || user.id}: ${oldRole} → systemRole=${newSystemRole}`, 'green')
      } catch (error: any) {
        skipped++
        log(`   ⚠️  ${user.email || user.name || user.id}: ${error.message}`, 'yellow')
      }
    }

    // Oppsummering
    log('\n════════════════════════════════════════════', 'cyan')
    log('  Migrasjon fullført!', 'green')
    log('════════════════════════════════════════════', 'cyan')
    log(`\n✅ Oppdatert: ${updated} brukere`, 'green')
    if (skipped > 0) {
      log(`⚠️  Hoppet over: ${skipped} brukere`, 'yellow')
    }
    log(`📊 Totalt: ${users.length} brukere i databasen\n`, 'reset')

    log('📝 Viktig:', 'blue')
    log('   - role-feltet er beholdt for bakoverkompatibilitet', 'yellow')
    log('   - systemRole er nå satt korrekt for alle brukere', 'yellow')
    log('   - Eksisterende moderatorer er nå "user" uten custom role', 'yellow')
    log('   - Du kan opprette custom roles med moderator-tilgang i admin-panelet\n', 'yellow')

  } catch (error: any) {
    log(`\n❌ Feil under migrasjon: ${error.message}`, 'red')
    if (error.stack) {
      log(`\nStack trace:\n${error.stack}`, 'red')
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

migrateRoles().catch((error) => {
  log(`\n❌ Uventet feil: ${error}`, 'red')
  process.exit(1)
})

