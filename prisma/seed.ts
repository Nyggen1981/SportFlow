import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Check if already seeded
  const existingOrg = await prisma.organization.findFirst()
  if (existingOrg) {
    console.log('⚠️  Database already seeded. Skipping...')
    return
  }

  // Create default categories
  const categories = await Promise.all([
    prisma.resourceCategory.create({
      data: {
        name: 'Utendørs',
        description: 'Utendørs fasiliteter',
        icon: 'Sun',
        color: '#22c55e'
      }
    }),
    prisma.resourceCategory.create({
      data: {
        name: 'Innendørs',
        description: 'Innendørs fasiliteter',
        icon: 'Home',
        color: '#3b82f6'
      }
    }),
    prisma.resourceCategory.create({
      data: {
        name: 'Møterom',
        description: 'Møterom og sosiale rom',
        icon: 'Users',
        color: '#f59e0b'
      }
    }),
    prisma.resourceCategory.create({
      data: {
        name: 'Utstyr',
        description: 'Utstyr som kan lånes',
        icon: 'Package',
        color: '#8b5cf6'
      }
    })
  ])

  // Create organization
  const org = await prisma.organization.create({
    data: {
      name: 'Sportsklubben Lyn',
      slug: 'lyn',
      primaryColor: '#dc2626',
      secondaryColor: '#991b1b'
    }
  })

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.create({
    data: {
      email: 'admin@lyn.no',
      name: 'Admin Bruker',
      password: hashedPassword,
      role: 'admin',
      organizationId: org.id
    }
  })

  // Create regular user
  const userPassword = await bcrypt.hash('bruker123', 10)
  const user = await prisma.user.create({
    data: {
      email: 'bruker@lyn.no',
      name: 'Test Bruker',
      password: userPassword,
      role: 'user',
      organizationId: org.id
    }
  })

  // Create resources
  const stadion = await prisma.resource.create({
    data: {
      name: 'Hovedstadion',
      description: 'Hovedbanen med kunstgress, godkjent for kamper',
      location: 'Lynveien 1',
      organizationId: org.id,
      categoryId: categories[0].id,
      minBookingMinutes: 60,
      maxBookingMinutes: 180,
      advanceBookingDays: 60,
      openingHours: JSON.stringify({
        monday: { open: '08:00', close: '22:00' },
        tuesday: { open: '08:00', close: '22:00' },
        wednesday: { open: '08:00', close: '22:00' },
        thursday: { open: '08:00', close: '22:00' },
        friday: { open: '08:00', close: '22:00' },
        saturday: { open: '09:00', close: '20:00' },
        sunday: { open: '10:00', close: '18:00' }
      }),
      parts: {
        create: [
          { name: 'Hele banen', description: 'Full størrelse 11er' },
          { name: 'Bane A (nord)', description: 'Halv bane, 7er størrelse' },
          { name: 'Bane B (sør)', description: 'Halv bane, 7er størrelse' }
        ]
      }
    }
  })

  const idrettshall = await prisma.resource.create({
    data: {
      name: 'Idrettshallen',
      description: 'Stor idrettshall med parkettgulv',
      location: 'Lynveien 3',
      organizationId: org.id,
      categoryId: categories[1].id,
      minBookingMinutes: 60,
      maxBookingMinutes: 240,
      advanceBookingDays: 30,
      openingHours: JSON.stringify({
        monday: { open: '07:00', close: '23:00' },
        tuesday: { open: '07:00', close: '23:00' },
        wednesday: { open: '07:00', close: '23:00' },
        thursday: { open: '07:00', close: '23:00' },
        friday: { open: '07:00', close: '22:00' },
        saturday: { open: '08:00', close: '20:00' },
        sunday: { open: '08:00', close: '20:00' }
      }),
      parts: {
        create: [
          { name: 'Hele hallen', description: 'Full hall, håndballstørrelse' },
          { name: 'Hall 1 (vest)', description: '1/3 av hallen' },
          { name: 'Hall 2 (midt)', description: '1/3 av hallen' },
          { name: 'Hall 3 (øst)', description: '1/3 av hallen' }
        ]
      }
    }
  })

  const turnhall = await prisma.resource.create({
    data: {
      name: 'Turnhallen',
      description: 'Spesialhall for turn og gymnastikk',
      location: 'Lynveien 3, underetasje',
      organizationId: org.id,
      categoryId: categories[1].id,
      minBookingMinutes: 60,
      maxBookingMinutes: 180,
      advanceBookingDays: 14
    }
  })

  const klubbhus = await prisma.resource.create({
    data: {
      name: 'Klubbhuset',
      description: 'Møterom, kjøkken og sosiale fasiliteter',
      location: 'Lynveien 5',
      organizationId: org.id,
      categoryId: categories[2].id,
      minBookingMinutes: 60,
      maxBookingMinutes: 480,
      requiresApproval: false,
      advanceBookingDays: 90,
      parts: {
        create: [
          { name: 'Hele klubbhuset', capacity: 100 },
          { name: 'Møterom 1', capacity: 12 },
          { name: 'Møterom 2', capacity: 8 },
          { name: 'Kjøkken', capacity: 20 }
        ]
      }
    }
  })

  const esport = await prisma.resource.create({
    data: {
      name: 'E-sport rommet',
      description: '10 gaming-stasjoner med høyytelse PCer',
      location: 'Lynveien 5, 2. etasje',
      organizationId: org.id,
      categoryId: categories[1].id,
      minBookingMinutes: 60,
      maxBookingMinutes: 240,
      advanceBookingDays: 14
    }
  })

  // Create some sample bookings
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(18, 0, 0, 0)

  const tomorrowEnd = new Date(tomorrow)
  tomorrowEnd.setHours(20, 0, 0, 0)

  await prisma.booking.create({
    data: {
      title: 'A-lag trening',
      description: 'Ukentlig trening for A-laget',
      startTime: tomorrow,
      endTime: tomorrowEnd,
      status: 'approved',
      organizationId: org.id,
      resourceId: stadion.id,
      userId: user.id,
      approvedById: admin.id,
      approvedAt: new Date()
    }
  })

  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)
  nextWeek.setHours(10, 0, 0, 0)

  const nextWeekEnd = new Date(nextWeek)
  nextWeekEnd.setHours(12, 0, 0, 0)

  await prisma.booking.create({
    data: {
      title: 'Styremeøte',
      description: 'Månedlig styremeøte',
      startTime: nextWeek,
      endTime: nextWeekEnd,
      status: 'pending',
      organizationId: org.id,
      resourceId: klubbhus.id,
      userId: user.id,
      contactName: 'Test Bruker',
      contactEmail: 'bruker@lyn.no'
    }
  })

  console.log('✅ Seed data created successfully!')
  console.log('')
  console.log('📧 Admin login: admin@lyn.no / admin123')
  console.log('📧 User login: bruker@lyn.no / bruker123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

