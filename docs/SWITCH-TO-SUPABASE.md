# Guide: Bytte til Supabase som primær database

## ✅ Status

Migrasjonen fra Neon til Supabase er fullført. Alle data er migrert.

## 📋 Neste steg

### 1. Oppdater miljøvariabler i Vercel

1. Gå til [Vercel Dashboard](https://vercel.com)
2. Velg ditt prosjekt
3. Gå til **Settings** → **Environment Variables**
4. Oppdater følgende variabler for **alle miljøer** (Production, Preview, Development):

#### Supabase Session Pooler (IPv4-kompatibel)
```
DATABASE_URL=postgresql://postgres.tvlxngbuzkmavtjqjpje:L3n0v02025!@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require
DIRECT_URL=postgresql://postgres.tvlxngbuzkmavtjqjpje:L3n0v02025!@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require
```

5. **Slett eller behold** de gamle Neon-variablene (anbefalt: behold dem som backup i 1-2 uker)

### 2. Oppdater lokal .env fil (valgfritt)

Hvis du har en `.env` fil lokalt:

```env
DATABASE_URL=postgresql://postgres.tvlxngbuzkmavtjqjpje:L3n0v02025!@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require
DIRECT_URL=postgresql://postgres.tvlxngbuzkmavtjqjpje:L3n0v02025!@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require
```

### 3. Redeploy Vercel-prosjektet

1. Gå til **Deployments** i Vercel Dashboard
2. Klikk **"Redeploy"** på siste deployment
3. Vent på at bygget fullføres

### 4. Test applikasjonen

Test at alt fungerer:
- ✅ Innlogging
- ✅ Bookinger
- ✅ Fakturaer
- ✅ Alle funksjoner

## 🔄 Pause automatiske deployments (valgfritt)

Hvis du vil pause automatiske deployments i Vercel:

1. Gå til **Settings** → **Git**
2. Under **"Production Branch"**, kan du:
   - Deaktivere **"Automatic deployments from Git"** (pauser alle auto-deployments)
   - Eller bruke **"Ignore Build Step"** for å kontrollere når det skal deployes

**Alternativ:** Bruk Vercel CLI for å pause:
```bash
vercel project pause
```

## 📊 Migrert data

- ✅ 1 organisasjon
- ✅ 4 kategorier
- ✅ 1 egendefinert rolle
- ✅ 4 brukere
- ✅ 5 ressurser
- ✅ 17 ressursdeler
- ✅ 2 fastpris-pakker
- ✅ 2 fakturaer
- ✅ 2 betalinger
- ✅ 120 bookinger
- ✅ 2 brukerpreferanser

## ⚠️ Viktig

- **Ikke slett Neon-databasen ennå** - behold den som backup i minst 1-2 uker
- Test grundig at alt fungerer med Supabase før du sletter Neon
- Alle nye data lagres nå i Supabase

## 🗑️ Rydding (etter 1-2 uker)

Når du er sikker på at alt fungerer:

1. Verifiser at alle funksjoner fungerer korrekt
2. Ta en siste backup av Neon (hvis ønskelig)
3. Slett Neon-databasen i Neon Console (valgfritt)

