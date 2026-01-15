# Arena License Server - Spesifikasjon

Dette dokumentet beskriver hvordan lisensserveren skal settes opp og kommunisere med Sportflow Booking-apper.

---

## 🔗 Kommunikasjon mellom prosjektene

```
ARENA BOOKING APP                         LICENSE SERVER
(Kundeinstallasjon)                       (Din sentrale server)

.env:                                     .env:
LICENSE_SERVER_URL=https://xxx.vercel.app DATABASE_URL=postgresql://...
LICENSE_KEY=clxxxxxxxxxxxxxxxxx           NEXTAUTH_SECRET=...
                    │
                    │  POST /api/license/validate
                    │  {
                    │    "licenseKey": "clxxxxxxxxx",
                    │    "appVersion": "1.0.15",
                    │    "stats": { "userCount": 45, "bookingCount": 1230 }
                    │  }
                    │
                    └──────────────────────────────────────►
                                          │
                                          │ 1. Finn org WHERE licenseKey = "clxxx"
                                          │ 2. Sjekk isActive, isSuspended
                                          │ 3. Sjekk expiresAt vs now()
                                          │ 4. Oppdater lastHeartbeat, stats
                                          │ 5. Returner status
                                          │
                    ◄──────────────────────────────────────┘
                    │
                    │  Response:
                    │  {
                    │    "valid": true,
                    │    "status": "active",
                    │    "organization": "Haugesund IL",
                    │    "licenseType": "standard",
                    │    "expiresAt": "2025-12-31T23:59:59Z",
                    │    "limits": { "maxUsers": 50, "maxResources": 10 }
                    │  }
```

---

## 📋 API Kontrakt

### POST `/api/license/validate`

**Request fra Sportflow Booking:**
```json
{
  "licenseKey": "clxxxxxxxxxxxxxxxxxxxx",
  "appVersion": "1.0.15",
  "stats": {
    "userCount": 45,
    "bookingCount": 1230
  }
}
```

**Response - Gyldig lisens:**
```json
{
  "valid": true,
  "status": "active",
  "organization": "Haugesund IL",
  "licenseType": "standard",
  "expiresAt": "2025-12-31T23:59:59.000Z",
  "daysUntilExpiry": 380,
  "limits": {
    "maxUsers": 50,
    "maxResources": 10
  },
  "features": {
    "emailNotifications": true,
    "customBranding": true,
    "prioritySupport": false
  },
  "showRenewalWarning": false
}
```

**Response - Grace period:**
```json
{
  "valid": true,
  "status": "grace",
  "organization": "Haugesund IL",
  "graceMode": true,
  "daysLeft": 7,
  "message": "Abonnementet har utløpt. 7 dager igjen av grace period.",
  "restrictions": {
    "readOnly": false,
    "showWarning": true,
    "canCreateBookings": true,
    "canCreateUsers": false
  }
}
```

**Response - Utløpt:**
```json
{
  "valid": false,
  "status": "expired",
  "message": "Lisensen har utløpt. Kontakt support for å fornye."
}
```

**Response - Suspendert:**
```json
{
  "valid": false,
  "status": "suspended",
  "message": "Lisensen er suspendert. Kontakt support."
}
```

**Response - Ugyldig nøkkel:**
```json
{
  "valid": false,
  "status": "invalid",
  "error": "Invalid license key"
}
```

---

## 🗄️ Database Schema (Prisma)

Kopier dette til `prisma/schema.prisma` i lisensserver-prosjektet:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Kunder/Organisasjoner som bruker Sportflow Booking
model Organization {
  id            String   @id @default(cuid())
  
  // Kundeinformasjon
  name          String                          // "Haugesund IL"
  slug          String   @unique                // "haugesund-il"
  contactEmail  String
  contactName   String?
  contactPhone  String?
  
  // Lisensnøkkel (genereres automatisk, deles med kunden)
  licenseKey    String   @unique @default(cuid())
  
  // Lisenstype: "free", "trial", "standard", "premium"
  licenseType   String   @default("trial")
  
  // Datoer
  createdAt     DateTime @default(now())
  activatedAt   DateTime?                       // Settes ved første validate-kall
  expiresAt     DateTime                        // Når abonnementet utløper
  graceEndsAt   DateTime?                       // Siste dag med begrenset tilgang
  
  // Status
  isActive      Boolean  @default(true)
  isSuspended   Boolean  @default(false)
  suspendReason String?
  
  // Begrensninger (null = bruk default fra licenseType)
  maxUsers      Int?
  maxResources  Int?
  
  // Statistikk rapportert fra appen
  lastHeartbeat DateTime?
  appVersion    String?
  totalUsers    Int      @default(0)
  totalBookings Int      @default(0)
  
  // Notater
  notes         String?
  
  // Relasjoner
  validations   LicenseValidation[]
  
  @@index([licenseKey])
  @@index([isActive, expiresAt])
}

// Logg over alle lisensvalideringer
model LicenseValidation {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  timestamp      DateTime @default(now())
  ipAddress      String?
  userAgent      String?
  appVersion     String?
  
  // Resultat: "valid", "expired", "grace", "invalid", "suspended"
  status         String
  
  // Rapportert fra app
  userCount      Int?
  bookingCount   Int?
  
  @@index([organizationId, timestamp])
  @@index([timestamp])
}

// Admin-brukere for lisensserver
model AdminUser {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String                              // bcrypt hash
  name      String?
  role      String   @default("admin")          // "super", "admin", "viewer"
  createdAt DateTime @default(now())
  lastLogin DateTime?
}
```

---

## ⚙️ Lisenstype Defaults

Bruk disse verdiene i lisensserveren:

```typescript
// src/lib/license-config.ts

export const LICENSE_TYPES = {
  free: {
    name: "Free",
    maxUsers: 10,
    maxResources: 2,
    gracePeriodDays: 0,
    features: {
      emailNotifications: false,
      customBranding: false,
      prioritySupport: false
    },
    price: 0
  },
  trial: {
    name: "Trial",
    maxUsers: 25,
    maxResources: 5,
    gracePeriodDays: 7,
    trialDays: 30,
    features: {
      emailNotifications: true,
      customBranding: false,
      prioritySupport: false
    },
    price: 0
  },
  standard: {
    name: "Standard",
    maxUsers: 50,
    maxResources: 10,
    gracePeriodDays: 14,
    features: {
      emailNotifications: true,
      customBranding: true,
      prioritySupport: false
    },
    price: 299  // kr/mnd
  },
  premium: {
    name: "Premium",
    maxUsers: null,      // Ubegrenset
    maxResources: null,  // Ubegrenset
    gracePeriodDays: 30,
    features: {
      emailNotifications: true,
      customBranding: true,
      prioritySupport: true
    },
    price: 599  // kr/mnd
  }
} as const

export type LicenseType = keyof typeof LICENSE_TYPES

// Hjelpefunksjon for å få limits
export function getLicenseLimits(licenseType: LicenseType, org?: { maxUsers?: number | null, maxResources?: number | null }) {
  const defaults = LICENSE_TYPES[licenseType]
  return {
    maxUsers: org?.maxUsers ?? defaults.maxUsers,
    maxResources: org?.maxResources ?? defaults.maxResources
  }
}
```

---

## 🔐 Miljøvariabler for Lisensserver

```env
# .env for lisensserver

# Database (Neon/Supabase PostgreSQL)
DATABASE_URL="postgresql://user:password@host:5432/arena_licenses?sslmode=require"

# NextAuth
NEXTAUTH_SECRET="generer-en-lang-tilfeldig-streng"
NEXTAUTH_URL="https://license.sportflow.no"

# Første admin-bruker (brukes av seed-script)
ADMIN_EMAIL="admin@sportflow.no"
ADMIN_PASSWORD="veldig-sikkert-passord"
```

---

## 🔐 Miljøvariabler for Sportflow Booking (hver kunde)

Når en kunde er registrert i lisensserveren, må de legge til dette i sin `.env` og i Vercel:

```env
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"

# NextAuth
NEXTAUTH_SECRET="generer-en-lang-tilfeldig-streng"
NEXTAUTH_URL="https://din-app.vercel.app"

# Lisensserver
LICENSE_SERVER_URL="https://license.sportflow.no"
LICENSE_KEY="clxxxxxxxxxxxxxxxxxxxx"  # Generert av lisensserveren
ORG_SLUG="organisasjonens-slug"       # F.eks. "haugesund-il"

# E-post (Resend)
RESEND_API_KEY="re_xxxxxxxxxxxx"
EMAIL_FROM="noreply@dindomain.no"
```

**Merk:** Hvis `LICENSE_SERVER_URL`, `LICENSE_KEY` eller `ORG_SLUG` ikke er satt, kjører appen i "development mode" og hopper over lisensvalidering.

---

## 📝 Seed Script for Første Admin

```typescript
// prisma/seed.ts i lisensserver

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set")
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password: hashedPassword,
      name: "Super Admin",
      role: "super"
    }
  })

  console.log("Admin user created:", admin.email)

  // Opprett en test-organisasjon
  const testOrg = await prisma.organization.upsert({
    where: { slug: "test-klubb" },
    update: {},
    create: {
      name: "Test Klubb",
      slug: "test-klubb",
      contactEmail: "test@example.com",
      licenseType: "trial",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dager
    }
  })

  console.log("Test organization created:")
  console.log("  Name:", testOrg.name)
  console.log("  License Key:", testOrg.licenseKey)
  console.log("  Expires:", testOrg.expiresAt)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

---

## 🚀 Steg-for-steg Setup

### I Lisensserver-prosjektet:

1. **Sett opp database**
   - Opprett PostgreSQL database på Neon
   - Kopier connection string til `.env`

2. **Installer dependencies**
   ```bash
   npm install @prisma/client bcryptjs next-auth
   npm install -D prisma @types/bcryptjs
   ```

3. **Sett opp Prisma**
   ```bash
   npx prisma db push
   npx prisma generate
   ```

4. **Kjør seed**
   ```bash
   npx tsx prisma/seed.ts
   ```
   → Noter deg `licenseKey` som skrives ut!

5. **Lag validerings-API**
   - Implementer `/api/license/validate`

6. **Lag admin-panel**
   - Login-side
   - Dashboard med kundeliste
   - Legg til/rediger kunder

7. **Deploy til Vercel**

### I Sportflow Booking-prosjektet (senere):

1. Legg til i `.env`:
   ```env
   LICENSE_SERVER_URL=https://din-lisensserver.vercel.app
   LICENSE_KEY=clxxxxxxxxxxxx
   ```

2. Implementer lisenssjekk (jeg hjelper deg med dette når lisensserveren er klar)

---

## ✅ Sjekkliste

- [ ] Database oppsatt (Neon)
- [ ] Prisma schema pushet
- [ ] Seed kjørt (admin + test-org)
- [ ] `/api/license/validate` fungerer
- [ ] Admin login fungerer
- [ ] Kan se kundeliste
- [ ] Kan legge til ny kunde
- [ ] Deploy til Vercel
- [ ] Test med Sportflow Booking

