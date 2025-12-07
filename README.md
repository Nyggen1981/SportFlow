# Arena Booking 🏟️

En moderne bookingapp for idrettslag. Book treninger, haller og fasiliteter enkelt.

## Funksjoner

- 📅 **Kalender** - Uke- og månedsvisning med fargekoding per fasilitet
- 🏢 **Ressurshåndtering** - Stadion, haller, klubbhus med deler som kan bookes separat
- ✅ **Godkjenningsflyt** - Admin godkjenner bookinger før de blir endelige
- 👥 **Multi-tenant** - Kan brukes av flere klubber (konfigurerbart)
- 🔐 **Roller** - Admin og bruker-tilgang

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript
- **Styling:** Tailwind CSS 4
- **Database:** PostgreSQL (Supabase)
- **Auth:** NextAuth.js
- **ORM:** Prisma

## Kom i gang

### 1. Installer avhengigheter

```bash
npm install
```

### 2. Sett opp database (Supabase)

1. Opprett et prosjekt på [supabase.com](https://supabase.com)
2. Gå til **Settings → Database** og kopier connection strings
3. Opprett `.env` fil basert på `.env.example`

### 3. Kjør database-migrering

```bash
npm run db:push
```

### 4. Seed testdata (valgfritt)

```bash
npm run db:seed
```

### 5. Start utviklingsserver

```bash
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000)

## Demo-innlogging

| Rolle  | E-post          | Passord   |
|--------|-----------------|-----------|
| Admin  | admin@lyn.no    | admin123  |
| Bruker | bruker@lyn.no   | bruker123 |

## Scripts

```bash
npm run dev        # Start utviklingsserver
npm run build      # Bygg for produksjon
npm run db:push    # Push schema til database
npm run db:seed    # Opprett testdata
npm run db:studio  # Åpne Prisma Studio
```

## Deploy til Vercel

1. Push til GitHub
2. Importer prosjekt i Vercel
3. Legg til environment variables:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`

## Lisens

MIT
