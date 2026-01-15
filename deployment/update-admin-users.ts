/**
 * Oppdaterer alle admin-brukere til å ha systemRole = "admin"
 * Kjør: npx tsx deployment/update-admin-users.ts
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

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

interface DatabaseConfig {
  DATABASE_URL: string
  DIRECT_URL: string
}

async function updateAdminUsers(databaseName: string, config: DatabaseConfig) {
  log(`\n📦 [${databaseName}] Oppdaterer admin-brukere...`, 'yellow')

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: config.DATABASE_URL,
      },
    },
  })

  try {
    await prisma.$connect()
    log(`   ✅ Tilkoblet til ${databaseName}`, 'green')

    // Bruk raw SQL for å oppdatere direkte (fungerer selv om Prisma-schema ikke er oppdatert)
    // Først sjekk om systemRole-kolonnen eksisterer
    let systemRoleExists = false
    try {
      const checkResult = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = 'systemRole'
      `
      systemRoleExists = checkResult.length > 0
    } catch (error) {
      // Hvis tabellen ikke finnes eller feil, prøv å oppdatere uansett
      log(`   ⚠️  Kunne ikke sjekke om systemRole-kolonnen eksisterer, fortsetter...`, 'yellow')
    }

    if (!systemRoleExists) {
      log(`   ⚠️  systemRole-kolonnen eksisterer ikke. Kjør først: npm run db:push:all`, 'yellow')
      return { updated: 0, total: 0, error: "systemRole-kolonnen mangler" }
    }

    // Finn alle brukere med role = "admin"
    const adminUsers = await prisma.$queryRaw<Array<{
      id: string
      email: string
      name: string | null
      role: string
      systemRole: string | null
      emailVerified: boolean
    }>>`
      SELECT id, email, name, role, "systemRole", "emailVerified"
      FROM "User"
      WHERE role = 'admin'
        AND ("systemRole" IS NULL OR "systemRole" != 'admin')
    `

    if (adminUsers.length === 0) {
      log(`   ℹ️  Ingen admin-brukere som trenger oppdatering`, 'reset')
      return { updated: 0, total: 0 }
    }

    log(`   Funnet ${adminUsers.length} admin-bruker(e) som trenger oppdatering`, 'reset')

    // Oppdater alle admin-brukere med én SQL-query
    const result = await prisma.$executeRaw`
      UPDATE "User"
      SET 
        "systemRole" = 'admin',
        "emailVerified" = true,
        "emailVerifiedAt" = COALESCE("emailVerifiedAt", NOW())
      WHERE role = 'admin'
        AND ("systemRole" IS NULL OR "systemRole" != 'admin')
    `

    const updated = Number(result)
    
    // Vis detaljer for hver oppdatert bruker
    for (const user of adminUsers) {
      log(`   ✅ Oppdatert: ${user.email || user.name || user.id}`, 'green')
    }

    log(`   ✅ Oppdatert ${updated} av ${adminUsers.length} admin-bruker(e)`, 'green')
    return { updated, total: adminUsers.length }

  } catch (error: any) {
    log(`   ❌ Feil: ${error.message}`, 'red')
    return { updated: 0, total: 0, error: error.message }
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  log('\n════════════════════════════════════════════', 'cyan')
  log('  Oppdater admin-brukere i alle databaser', 'cyan')
  log('════════════════════════════════════════════\n', 'cyan')

  // Les database-konfigurasjon
  const configPath = path.join(process.cwd(), 'deployment', 'databases.local.json')
  
  if (!fs.existsSync(configPath)) {
    log('❌ databases.local.json ikke funnet!', 'red')
    log('   Opprett filen basert på databases.local.example.json', 'yellow')
    process.exit(1)
  }

  const configFile = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  const databases = configFile.databases as Record<string, DatabaseConfig>

  if (!databases || Object.keys(databases).length === 0) {
    log('❌ Ingen databaser funnet i databases.local.json', 'red')
    process.exit(1)
  }

  log('📋 Databaser som vil bli oppdatert:', 'blue')
  Object.keys(databases).forEach(name => {
    log(`   - ${name}`, 'reset')
  })

  log('\n⚠️  Dette vil oppdatere alle brukere med role="admin" til systemRole="admin"', 'yellow')
  log('   og sette emailVerified=true for admin-brukere.\n', 'yellow')

  const readline = require('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  // Sjekk om AUTO_CONFIRM er satt (for non-interaktiv bruk)
  const autoConfirm = process.env.AUTO_CONFIRM === 'true' || process.env.AUTO_CONFIRM === '1'
  let confirmed = autoConfirm
  
  if (!autoConfirm) {
    const answer = await new Promise<string>((resolve) => {
      rl.question('Fortsett? (j/n): ', resolve)
    })
    rl.close()
    confirmed = answer.toLowerCase() === 'j' || answer.toLowerCase() === 'y'
  } else {
    log('AUTO_CONFIRM er satt - fortsetter automatisk...', 'green')
    rl.close()
  }

  if (!confirmed) {
    log('\nAvbrutt.', 'yellow')
    process.exit(0)
  }

  // Oppdater alle databaser
  const results: Array<{ name: string; updated: number; total: number; error?: string }> = []

  for (const [name, config] of Object.entries(databases)) {
    const result = await updateAdminUsers(name, config)
    results.push({ name, ...result })
  }

  // Oppsummering
  log('\n════════════════════════════════════════════', 'cyan')
  log('  Oppsummering', 'cyan')
  log('════════════════════════════════════════════', 'cyan')

  let totalUpdated = 0
  let totalFound = 0

  results.forEach(result => {
    if (result.error) {
      log(`\n❌ ${result.name}: Feil - ${result.error}`, 'red')
    } else {
      log(`\n✅ ${result.name}:`, 'green')
      log(`   Oppdatert: ${result.updated} av ${result.total} admin-bruker(e)`, 'reset')
      totalUpdated += result.updated
      totalFound += result.total
    }
  })

  log(`\n📊 Totalt: ${totalUpdated} av ${totalFound} admin-bruker(e) oppdatert`, 'cyan')
  log('\n✅ Ferdig!\n', 'green')
}

main().catch((error) => {
  log(`\n❌ Uventet feil: ${error}`, 'red')
  process.exit(1)
})

