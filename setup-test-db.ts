/**
 * Setup script for arena-booking-test
 * Creates first organization and admin user
 * 
 * Usage: npx tsx setup-test-db.ts
 * 
 * Default organization: arena-booking-test
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import * as readline from 'readline'

const prisma = new PrismaClient()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve))
}

async function main() {
  console.log('🚀 Setting up arena-booking-test database...\n')

  // Check if any organizations exist
  const existingOrgs = await prisma.organization.count()
  if (existingOrgs > 0) {
    console.log('⚠️  Organizations already exist in database.')
    const answer = await question('Do you want to create a new one anyway? (y/n): ')
    if (answer.toLowerCase() !== 'y') {
      console.log('Cancelled.')
      process.exit(0)
    }
  }

  // Get organization details
  console.log('\n📋 Organization Details:')
  const orgName = await question('Organization name (e.g., "Lyn Idrettslag"): ')
  const orgSlug = await question('Organization slug (e.g., "lyn"): ')

  // Validate slug
  if (!/^[a-z0-9-]+$/.test(orgSlug)) {
    console.error('❌ Slug can only contain lowercase letters, numbers, and hyphens')
    process.exit(1)
  }

  // Check if slug exists
  const existingOrg = await prisma.organization.findUnique({
    where: { slug: orgSlug }
  })
  if (existingOrg) {
    console.error(`❌ Organization with slug "${orgSlug}" already exists`)
    process.exit(1)
  }

  // Get admin user details
  console.log('\n👤 Admin User Details:')
  const adminName = await question('Admin name: ')
  const adminEmail = await question('Admin email: ')
  const adminPhone = await question('Admin phone (optional, press Enter to skip): ')
  const adminPassword = await question('Admin password: ')

  if (!adminEmail || !adminPassword) {
    console.error('❌ Email and password are required')
    process.exit(1)
  }

  // Check if email exists
  const existingUser = await prisma.user.findUnique({
    where: { email: adminEmail }
  })
  if (existingUser) {
    console.error(`❌ User with email "${adminEmail}" already exists`)
    process.exit(1)
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(adminPassword, 10)

  // Create organization and admin user in transaction
  console.log('\n⏳ Creating organization and admin user...')
  
  const result = await prisma.$transaction(async (tx) => {
    // Create organization
    const organization = await tx.organization.create({
      data: {
        name: orgName,
        slug: orgSlug,
        primaryColor: '#2563eb',
        secondaryColor: '#1e40af'
      }
    })

    // Create default categories if none exist
    const existingCategories = await tx.resourceCategory.count()
    if (existingCategories === 0) {
      await tx.resourceCategory.createMany({
        data: [
          { name: 'Utendørs', description: 'Utendørs fasiliteter', icon: 'Sun', color: '#22c55e' },
          { name: 'Innendørs', description: 'Innendørs fasiliteter', icon: 'Home', color: '#3b82f6' },
          { name: 'Møterom', description: 'Møterom og sosiale rom', icon: 'Users', color: '#f59e0b' },
          { name: 'Utstyr', description: 'Utstyr som kan lånes', icon: 'Package', color: '#8b5cf6' }
        ]
      })
      console.log('✅ Created default categories')
    }

    // Create admin user
    const user = await tx.user.create({
      data: {
        email: adminEmail,
        name: adminName || null,
        phone: adminPhone || null,
        password: hashedPassword,
        role: 'admin',
        isApproved: true,
        approvedAt: new Date(),
        organizationId: organization.id
      }
    })

    return { organization, user }
  })

  console.log('\n✅ Setup complete!')
  console.log(`\n📊 Organization: ${result.organization.name}`)
  console.log(`   Slug: ${result.organization.slug}`)
  console.log(`\n👤 Admin User: ${result.user.email}`)
  console.log(`   Role: ${result.user.role}`)
  console.log(`\n🔗 You can now login at: http://localhost:3000/login`)
  console.log(`   Use the organization slug "${result.organization.slug}" when registering new users`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    rl.close()
  })

