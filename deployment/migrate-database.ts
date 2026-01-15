/**
 * Migrerer data fra en Neon database til en annen
 * Kjør: npx tsx deployment/migrate-database.ts
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

async function migrateDatabase() {
  log('\n════════════════════════════════════════════', 'cyan')
  log('  Sportflow Booking - Database Migrering', 'cyan')
  log('════════════════════════════════════════════\n', 'cyan')

  // Få connection strings fra brukeren eller miljøvariabler
  log('Steg 1: Oppgi database connection strings\n', 'blue')
  
  // Sjekk om miljøvariabler er satt (for non-interaktiv bruk)
  let sourceUrl = process.env.SOURCE_DATABASE_URL
  let sourceDirectUrl = process.env.SOURCE_DIRECT_URL
  let targetUrl = process.env.TARGET_DATABASE_URL
  let targetDirectUrl = process.env.TARGET_DIRECT_URL

  if (!sourceUrl) {
    sourceUrl = await question('Kilde database (gammel) DATABASE_URL: ')
  } else {
    log(`Kilde DATABASE_URL: ${sourceUrl.substring(0, 50)}...`, 'green')
  }

  if (!sourceDirectUrl) {
    sourceDirectUrl = await question('Kilde database (gammel) DIRECT_URL (eller trykk Enter for samme som DATABASE_URL): ') || sourceUrl
  } else {
    log(`Kilde DIRECT_URL: ${sourceDirectUrl.substring(0, 50)}...`, 'green')
  }
  
  if (!targetUrl) {
    targetUrl = await question('\nMål database (ny) DATABASE_URL: ')
  } else {
    log(`\nMål DATABASE_URL: ${targetUrl.substring(0, 50)}...`, 'green')
  }

  if (!targetDirectUrl) {
    targetDirectUrl = await question('Mål database (ny) DIRECT_URL (eller trykk Enter for samme som DATABASE_URL): ') || targetUrl
  } else {
    log(`Mål DIRECT_URL: ${targetDirectUrl.substring(0, 50)}...`, 'green')
  }

  // Bekreft migrering
  log('\n════════════════════════════════════════════', 'yellow')
  log('  Bekreft migrering', 'yellow')
  log('════════════════════════════════════════════', 'yellow')
  log(`\nKilde: ${sourceUrl.substring(0, 50)}...`, 'reset')
  log(`Mål:   ${targetUrl.substring(0, 50)}...`, 'reset')
  log('\n⚠️  ADVARSEL: Dette vil kopiere ALL data fra kilde til mål.', 'red')
  log('   Eksisterende data i mål-databasen kan bli overskrevet!\n', 'red')

  // Sjekk om AUTO_CONFIRM er satt (for non-interaktiv bruk)
  const autoConfirm = process.env.AUTO_CONFIRM === 'true' || process.env.AUTO_CONFIRM === '1'
  let confirmed = autoConfirm
  
  if (!autoConfirm) {
    confirmed = await confirm('Fortsett med migrering?')
  } else {
    log('AUTO_CONFIRM er satt - fortsetter automatisk...', 'green')
  }
  
  if (!confirmed) {
    log('\nAvbrutt.', 'yellow')
    process.exit(0)
  }

  // Opprett Prisma clients
  log('\nSteg 2: Kobler til databaser...', 'blue')
  const sourcePrisma = new PrismaClient({
    datasources: {
      db: {
        url: sourceUrl,
      },
    },
  })

  const targetPrisma = new PrismaClient({
    datasources: {
      db: {
        url: targetUrl,
      },
    },
  })

  try {
    // Test tilkoblinger
    await sourcePrisma.$connect()
    log('✅ Tilkoblet til kilde-database', 'green')
    
    await targetPrisma.$connect()
    log('✅ Tilkoblet til mål-database', 'green')

    // Sjekk at mål-databasen har riktig schema
    log('\nSteg 3: Sjekker schema i mål-database...', 'blue')
    try {
      await targetPrisma.organization.findFirst()
      log('✅ Schema ser riktig ut', 'green')
    } catch (error: any) {
      log('❌ Schema mangler i mål-database!', 'red')
      log('   Kjør først: DATABASE_URL="..." npx prisma db push', 'yellow')
      throw error
    }

    // Start migrering
    log('\nSteg 4: Starter migrering av data...\n', 'blue')

    // Migrer Organizations først (må være først pga foreign keys)
    log('📦 Migrerer Organizations...', 'yellow')
    const organizations = await sourcePrisma.organization.findMany({
      orderBy: { createdAt: 'asc' },
    })
    log(`   Funnet ${organizations.length} organisasjoner`, 'reset')
    
    for (const org of organizations) {
      await targetPrisma.organization.upsert({
        where: { id: org.id },
        update: org,
        create: org,
      })
    }
    log(`✅ Migrert ${organizations.length} organisasjoner`, 'green')

    // Migrer ResourceCategories
    log('\n📦 Migrerer ResourceCategories...', 'yellow')
    const categories = await sourcePrisma.resourceCategory.findMany({
      orderBy: { name: 'asc' },
    })
    log(`   Funnet ${categories.length} kategorier`, 'reset')
    
    for (const cat of categories) {
      await targetPrisma.resourceCategory.upsert({
        where: { id: cat.id },
        update: cat,
        create: cat,
      })
    }
    log(`✅ Migrert ${categories.length} kategorier`, 'green')

    // Migrer CustomRoles (må være før Users pga foreign key)
    log('\n📦 Migrerer CustomRoles...', 'yellow')
    let customRolesCount = 0
    try {
      const customRoles = await sourcePrisma.customRole.findMany({
        orderBy: { createdAt: 'asc' },
      })
      customRolesCount = customRoles.length
      if (customRoles.length > 0) {
        log(`   Funnet ${customRoles.length} egendefinerte roller`, 'reset')
        
        for (const role of customRoles) {
          await targetPrisma.customRole.upsert({
            where: { id: role.id },
            update: role,
            create: role,
          })
        }
        log(`✅ Migrert ${customRoles.length} egendefinerte roller`, 'green')
      } else {
        log('   Ingen egendefinerte roller å migrere', 'reset')
      }
    } catch (error: any) {
      log(`   ⚠️  Kunne ikke hente egendefinerte roller: ${error.message}`, 'yellow')
      log('   Fortsetter med neste steg...', 'yellow')
    }

    // Migrer Users
    log('\n📦 Migrerer Users...', 'yellow')
    const users = await sourcePrisma.user.findMany({
      orderBy: { createdAt: 'asc' },
    })
    log(`   Funnet ${users.length} brukere`, 'reset')
    
    for (const user of users) {
      // Sørg for at systemRole er satt basert på role hvis mangler (for bakoverkompatibilitet)
      const systemRole = (user as any).systemRole || (user.role === "admin" ? "admin" : "user")
      const customRoleId = (user as any).customRoleId || null
      
      await targetPrisma.user.upsert({
        where: { id: user.id },
        update: {
          ...user,
          systemRole: systemRole,
          customRoleId: customRoleId,
        },
        create: {
          ...user,
          systemRole: systemRole,
          customRoleId: customRoleId,
        },
      })
    }
    log(`✅ Migrert ${users.length} brukere`, 'green')

    // Migrer Resources (må være etter Organizations og Categories)
    log('\n📦 Migrerer Resources...', 'yellow')
    const resources = await sourcePrisma.resource.findMany({
      orderBy: { createdAt: 'asc' },
    })
    log(`   Funnet ${resources.length} ressurser`, 'reset')
    
    for (const resource of resources) {
      await targetPrisma.resource.upsert({
        where: { id: resource.id },
        update: resource,
        create: resource,
      })
    }
    log(`✅ Migrert ${resources.length} ressurser`, 'green')

    // Migrer ResourceParts (må være etter Resources)
    // Viktig: Migrer i riktig rekkefølge - først de uten parent, deretter de med parent
    log('\n📦 Migrerer ResourceParts...', 'yellow')
    const allParts = await sourcePrisma.resourcePart.findMany({
      orderBy: { name: 'asc' },
    })
    log(`   Funnet ${allParts.length} ressursdeler`, 'reset')
    
    // Sorter: først de uten parent (null), deretter de med parent
    const partsWithoutParent = allParts.filter(p => !p.parentId)
    const partsWithParent = allParts.filter(p => p.parentId)
    
    // Migrer først de uten parent
    for (const part of partsWithoutParent) {
      await targetPrisma.resourcePart.upsert({
        where: { id: part.id },
        update: part,
        create: part,
      })
    }
    log(`   Migrert ${partsWithoutParent.length} ressursdeler uten parent`, 'reset')
    
    // Deretter migrer de med parent (i flere runder hvis det er nested hierarki)
    let remainingParts = [...partsWithParent]
    let round = 1
    while (remainingParts.length > 0) {
      const migratedThisRound: string[] = []
      const stillRemaining: typeof remainingParts = []
      
      for (const part of remainingParts) {
        try {
          await targetPrisma.resourcePart.upsert({
            where: { id: part.id },
            update: part,
            create: part,
          })
          migratedThisRound.push(part.id)
        } catch (error: any) {
          // Hvis foreign key-feil, legg tilbake for neste runde
          if (error.message?.includes('Foreign key constraint')) {
            stillRemaining.push(part)
          } else {
            throw error
          }
        }
      }
      
      if (migratedThisRound.length > 0) {
        log(`   Runde ${round}: Migrert ${migratedThisRound.length} ressursdeler`, 'reset')
      }
      
      if (stillRemaining.length === remainingParts.length) {
        // Ingen fremgang - det kan være en sirkulær referanse eller manglende parent
        log(`   ⚠️  Kunne ikke migrere ${stillRemaining.length} ressursdeler (sjekk parentId referanser)`, 'yellow')
        break
      }
      
      remainingParts = stillRemaining
      round++
    }
    
    log(`✅ Migrert ${allParts.length - remainingParts.length} av ${allParts.length} ressursdeler`, 'green')

    // Migrer ResourceModerators (hvis modellen eksisterer)
    log('\n📦 Migrerer ResourceModerators...', 'yellow')
    let moderatorsCount = 0
    try {
      const moderators = await (sourcePrisma as any).resourceModerator?.findMany() || []
      moderatorsCount = moderators.length
      if (moderators.length > 0) {
        log(`   Funnet ${moderators.length} moderatorer`, 'reset')
        
        for (const mod of moderators) {
          try {
            await (targetPrisma as any).resourceModerator.upsert({
              where: { id: mod.id },
              update: mod,
              create: mod,
            })
          } catch (error: any) {
            log(`   ⚠️  Kunne ikke migrere moderator ${mod.id}: ${error.message}`, 'yellow')
          }
        }
        log(`✅ Migrert ${moderators.length} moderatorer`, 'green')
      } else {
        log('   Ingen moderatorer å migrere', 'reset')
      }
    } catch (error: any) {
      log(`   ⚠️  Kunne ikke hente moderatorer: ${error.message}`, 'yellow')
      log('   Fortsetter med neste steg...', 'yellow')
    }

    // Migrer Invoices (må være før Bookings pga foreign key)
    log('\n📦 Migrerer Invoices...', 'yellow')
    let invoicesCount = 0
    try {
      const invoices = await sourcePrisma.invoice.findMany({
        orderBy: { createdAt: 'asc' },
      })
      invoicesCount = invoices.length
      log(`   Funnet ${invoices.length} fakturaer`, 'reset')
      
      for (const invoice of invoices) {
        await targetPrisma.invoice.upsert({
          where: { id: invoice.id },
          update: invoice,
          create: invoice,
        })
      }
      log(`✅ Migrert ${invoices.length} fakturaer`, 'green')
    } catch (error: any) {
      log(`   ⚠️  Kunne ikke hente fakturaer: ${error.message}`, 'yellow')
      log('   Fortsetter med neste steg...', 'yellow')
    }

    // Migrer FixedPricePackages (må være før Bookings)
    log('\n📦 Migrerer FixedPricePackages...', 'yellow')
    let fixedPricePackagesCount = 0
    try {
      const packages = await sourcePrisma.fixedPricePackage.findMany({
        orderBy: { createdAt: 'asc' },
      })
      fixedPricePackagesCount = packages.length
      log(`   Funnet ${packages.length} fastpris-pakker`, 'reset')
      
      for (const pkg of packages) {
        await targetPrisma.fixedPricePackage.upsert({
          where: { id: pkg.id },
          update: pkg,
          create: pkg,
        })
      }
      log(`✅ Migrert ${packages.length} fastpris-pakker`, 'green')
    } catch (error: any) {
      log(`   ⚠️  Kunne ikke hente fastpris-pakker: ${error.message}`, 'yellow')
      log('   Fortsetter med neste steg...', 'yellow')
    }

    // Migrer EmailVerificationTokens (må være etter Users)
    log('\n📦 Migrerer EmailVerificationTokens...', 'yellow')
    let emailTokensCount = 0
    try {
      const tokens = await sourcePrisma.emailVerificationToken.findMany()
      emailTokensCount = tokens.length
      if (tokens.length > 0) {
        log(`   Funnet ${tokens.length} e-post verifiserings-tokens`, 'reset')
        
        for (const token of tokens) {
          await targetPrisma.emailVerificationToken.upsert({
            where: { id: token.id },
            update: token,
            create: token,
          })
        }
        log(`✅ Migrert ${tokens.length} e-post verifiserings-tokens`, 'green')
      } else {
        log('   Ingen e-post verifiserings-tokens å migrere', 'reset')
      }
    } catch (error: any) {
      log(`   ⚠️  Kunne ikke hente e-post verifiserings-tokens: ${error.message}`, 'yellow')
      log('   Fortsetter med neste steg...', 'yellow')
    }

    // Migrer Bookings (må være etter Users, Resources, ResourceParts, Invoices, FixedPricePackages)
    log('\n📦 Migrerer Bookings...', 'yellow')
    const bookings = await sourcePrisma.booking.findMany({
      orderBy: { createdAt: 'asc' },
    })
    log(`   Funnet ${bookings.length} bookinger`, 'reset')
    
    for (const booking of bookings) {
      await targetPrisma.booking.upsert({
        where: { id: booking.id },
        update: booking,
        create: booking,
      })
    }
    log(`✅ Migrert ${bookings.length} bookinger`, 'green')

    // Migrer Payments (må være etter Bookings pga foreign key)
    log('\n📦 Migrerer Payments...', 'yellow')
    let paymentsCount = 0
    try {
      const payments = await sourcePrisma.payment.findMany({
        orderBy: { createdAt: 'asc' },
      })
      paymentsCount = payments.length
      log(`   Funnet ${payments.length} betalinger`, 'reset')
      
      for (const payment of payments) {
        // Håndter metadata-feltet eksplisitt for å unngå type-feil
        const { metadata, ...paymentData } = payment
        await targetPrisma.payment.upsert({
          where: { id: payment.id },
          update: {
            ...paymentData,
            metadata: metadata as any, // Konverter JsonValue til InputJsonValue
          },
          create: {
            ...paymentData,
            metadata: metadata as any, // Konverter JsonValue til InputJsonValue
          },
        })
      }
      log(`✅ Migrert ${payments.length} betalinger`, 'green')
    } catch (error: any) {
      log(`   ⚠️  Kunne ikke hente betalinger: ${error.message}`, 'yellow')
      log('   Fortsetter med neste steg...', 'yellow')
    }

    // Migrer UserPreferences
    log('\n📦 Migrerer UserPreferences...', 'yellow')
    const preferences = await sourcePrisma.userPreferences.findMany()
    log(`   Funnet ${preferences.length} brukerpreferanser`, 'reset')
    
    for (const pref of preferences) {
      await targetPrisma.userPreferences.upsert({
        where: { id: pref.id },
        update: pref,
        create: pref,
      })
    }
    log(`✅ Migrert ${preferences.length} brukerpreferanser`, 'green')

    // Migrer EmailTemplates
    log('\n📦 Migrerer EmailTemplates...', 'yellow')
    const templates = await sourcePrisma.emailTemplate.findMany()
    log(`   Funnet ${templates.length} e-postmaler`, 'reset')
    
    for (const template of templates) {
      await targetPrisma.emailTemplate.upsert({
        where: {
          organizationId_templateType: {
            organizationId: template.organizationId,
            templateType: template.templateType,
          },
        },
        update: template,
        create: template,
      })
    }
    log(`✅ Migrert ${templates.length} e-postmaler`, 'green')

    // Oppsummering
    log('\n════════════════════════════════════════════', 'cyan')
    log('  Migrering fullført!', 'green')
    log('════════════════════════════════════════════', 'cyan')
    log(`\n✅ Organisasjoner: ${organizations.length}`, 'green')
    log(`✅ Kategorier: ${categories.length}`, 'green')
    log(`✅ Brukere: ${users.length}`, 'green')
    log(`✅ Egendefinerte roller: ${customRolesCount}`, 'green')
    log(`✅ Ressurser: ${resources.length}`, 'green')
    log(`✅ Ressursdeler: ${allParts.length - (remainingParts?.length || 0)}`, 'green')
    log(`✅ Fastpris-pakker: ${fixedPricePackagesCount}`, 'green')
    log(`✅ Moderatorer: ${moderatorsCount}`, 'green')
    log(`✅ Fakturaer: ${invoicesCount}`, 'green')
    log(`✅ Betalinger: ${paymentsCount}`, 'green')
    log(`✅ Bookinger: ${bookings.length}`, 'green')
    log(`✅ Brukerpreferanser: ${preferences.length}`, 'green')
    log(`✅ E-postmaler: ${templates.length}`, 'green')
    log(`✅ E-post verifiserings-tokens: ${emailTokensCount}`, 'green')
    
    log('\n📝 Neste steg:', 'blue')
    log('   1. Oppdater DATABASE_URL og DIRECT_URL i .env filen', 'yellow')
    log('   2. Oppdater miljøvariabler i Vercel (hvis relevant)', 'yellow')
    log('   3. Oppdater databases.local.json hvis du bruker den', 'yellow')
    log('   4. Test applikasjonen med den nye databasen\n', 'yellow')

  } catch (error: any) {
    log(`\n❌ Feil under migrering: ${error.message}`, 'red')
    if (error.stack) {
      log(`\nStack trace:\n${error.stack}`, 'red')
    }
    process.exit(1)
  } finally {
    await sourcePrisma.$disconnect()
    await targetPrisma.$disconnect()
  }
}

migrateDatabase().catch((error) => {
  log(`\n❌ Uventet feil: ${error}`, 'red')
  process.exit(1)
})

