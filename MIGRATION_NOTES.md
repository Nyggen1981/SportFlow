# Database Migration Notes

## EmailTemplate Model

Etter å ha lagt til `EmailTemplate`-modellen i Prisma schema, må du kjøre database-migrering.

### For lokal utvikling:
```bash
npm run db:push
```

### For Vercel/Production:

1. **Automatisk via Vercel Build:**
   - Vercel kjører `prisma generate` automatisk via `postinstall` script
   - Men du må kjøre `prisma db push` eller `prisma migrate deploy` manuelt

2. **Manuell migrering:**
   ```bash
   # Via Vercel CLI
   vercel env pull
   npx prisma db push
   
   # Eller via Supabase Dashboard
   # Gå til SQL Editor og kjør:
   # (se prisma/migrations for SQL)
   ```

3. **Alternativt - via Supabase Dashboard:**
   - Gå til Supabase Dashboard → SQL Editor
   - Kjør SQL for å opprette EmailTemplate-tabellen

### SQL for manuell opprettelse:

```sql
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateType" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailTemplate_organizationId_templateType_key" ON "EmailTemplate"("organizationId", "templateType");

CREATE INDEX "EmailTemplate_organizationId_idx" ON "EmailTemplate"("organizationId");

ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### Feilhåndtering

Koden er nå oppdatert til å håndtere manglende tabell gracefully:
- Hvis `EmailTemplate`-tabellen ikke finnes, brukes standardmaler
- Applikasjonen krasjer ikke, men e-postmal-redigering vil ikke fungere før migrering er kjørt

### Verifisering

Etter migrering, verifiser at tabellen eksisterer:
```sql
SELECT * FROM "EmailTemplate" LIMIT 1;
```

