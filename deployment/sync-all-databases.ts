/**
 * Synkroniserer Prisma-schema til alle kundedatabaser
 * Kjør: npm run db:sync:all
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

interface DatabaseConfig {
  DATABASE_URL: string
  DIRECT_URL: string
}

interface DatabasesConfig {
  databases: Record<string, DatabaseConfig>
}

interface Customer {
  id: string
  name: string
  environment: string
}

interface CustomersConfig {
  customers: Customer[]
}

const DEPLOYMENT_DIR = path.join(__dirname)
const DATABASES_FILE = path.join(DEPLOYMENT_DIR, 'databases.local.json')
const DATABASES_EXAMPLE = path.join(DEPLOYMENT_DIR, 'databases.local.example.json')
const CUSTOMERS_FILE = path.join(DEPLOYMENT_DIR, 'customers.json')

// Colors for console output
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

function loadDatabaseConfig(): DatabasesConfig | null {
  if (!fs.existsSync(DATABASES_FILE)) {
    log('\n❌ databases.local.json ikke funnet!', 'red')
    log('\nOpprett filen ved å kopiere malen:', 'yellow')
    log('  copy deployment\\databases.local.example.json deployment\\databases.local.json', 'cyan')
    log('\nDeretter fyll inn database-credentials for hver kunde.', 'yellow')
    return null
  }

  try {
    const content = fs.readFileSync(DATABASES_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    log(`❌ Kunne ikke lese databases.local.json: ${error}`, 'red')
    return null
  }
}

function loadCustomers(): CustomersConfig | null {
  try {
    const content = fs.readFileSync(CUSTOMERS_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    log(`❌ Kunne ikke lese customers.json: ${error}`, 'red')
    return null
  }
}

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(`${message} (j/n): `, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'j' || answer.toLowerCase() === 'y')
    })
  })
}

async function syncDatabase(name: string, config: DatabaseConfig): Promise<boolean> {
  log(`\n📦 [${name}] Synkroniserer...`, 'yellow')

  try {
    // Set environment variables
    process.env.DATABASE_URL = config.DATABASE_URL
    process.env.DIRECT_URL = config.DIRECT_URL

    // Run prisma db push
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      stdio: 'pipe',
      encoding: 'utf-8',
    })

    log(`✅ [${name}] Synkronisert!`, 'green')
    return true
  } catch (error: any) {
    log(`❌ [${name}] Feil: ${error.message}`, 'red')
    if (error.stdout) {
      log(`   Output: ${error.stdout}`, 'red')
    }
    return false
  }
}

async function main() {
  log('\n════════════════════════════════════════════', 'cyan')
  log('  Sportflow Booking - Database Sync', 'cyan')
  log('════════════════════════════════════════════\n', 'cyan')

  // Load configurations
  const dbConfig = loadDatabaseConfig()
  if (!dbConfig) {
    process.exit(1)
  }

  const customers = loadCustomers()
  if (!customers) {
    process.exit(1)
  }

  // Show what will be synced
  const dbNames = Object.keys(dbConfig.databases)
  log('Følgende databaser vil bli oppdatert:', 'blue')
  
  for (const dbName of dbNames) {
    const customer = customers.customers.find(c => c.id === dbName)
    const displayName = customer ? `${customer.name} (${customer.environment})` : dbName
    log(`  • ${displayName}`, 'reset')
  }

  // Confirm
  const autoConfirm = process.env.AUTO_CONFIRM === 'true' || process.env.AUTO_CONFIRM === '1'
  let shouldContinue = autoConfirm
  
  if (!autoConfirm) {
    shouldContinue = await confirm('\nFortsett med synkronisering?')
  } else {
    log('AUTO_CONFIRM er satt - fortsetter automatisk...\n', 'green')
  }
  
  if (!shouldContinue) {
    log('\nAvbrutt.', 'yellow')
    process.exit(0)
  }

  // Sync all databases
  let successCount = 0
  let failCount = 0

  for (const [dbName, config] of Object.entries(dbConfig.databases)) {
    const success = await syncDatabase(dbName, config)
    if (success) {
      successCount++
    } else {
      failCount++
    }
  }

  // Summary
  log('\n════════════════════════════════════════════', 'cyan')
  log('  Resultat', 'cyan')
  log('════════════════════════════════════════════', 'cyan')
  log(`  ✅ Vellykket: ${successCount}`, 'green')
  if (failCount > 0) {
    log(`  ❌ Feilet: ${failCount}`, 'red')
  }
  log('')

  // Clean up env vars
  delete process.env.DATABASE_URL
  delete process.env.DIRECT_URL

  process.exit(failCount > 0 ? 1 : 0)
}

main().catch((error) => {
  log(`\n❌ Uventet feil: ${error}`, 'red')
  process.exit(1)
})

