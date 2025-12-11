# Guide: Opprette ny kunde (separat prosjekt)

Denne guiden viser hvordan du setter opp en ny kunde med eget Vercel-prosjekt og Neon-database.

## Oversikt

```
GitHub: arena-booking (én kodebase)
         │
         ├── Vercel: arena-booking-sauda     → Neon: arena-booking-sauda
         ├── Vercel: arena-booking-kunde2    → Neon: arena-booking-kunde2
         └── Vercel: arena-booking-kunde3    → Neon: arena-booking-kunde3
```

## Steg 1: Opprett Neon Database

1. Gå til [console.neon.tech](https://console.neon.tech)
2. Klikk **"New Project"**
3. Fyll ut:
   - **Name:** `arena-booking-<kundenavn>` (f.eks. `arena-booking-stavanger`)
   - **Region:** `eu-west-1` (nærmest Norge)
4. Klikk **"Create Project"**
5. **Kopier connection string** - du trenger denne senere:
   ```
   postgresql://user:pass@ep-xxx.eu-west-1.aws.neon.tech/neondb?sslmode=require
   ```

## Steg 2: Sett opp database-skjema

Kjør i terminalen (erstatt `<CONNECTION_STRING>` med din Neon URL):

```powershell
# Windows PowerShell
$env:DATABASE_URL="<CONNECTION_STRING>"
npx prisma db push
```

```bash
# Mac/Linux
DATABASE_URL="<CONNECTION_STRING>" npx prisma db push
```

## Steg 3: Opprett Vercel-prosjekt

1. Gå til [vercel.com/new](https://vercel.com/new)
2. Velg **"Import Git Repository"**
3. Velg `arena-booking` repositoryet
4. **Viktig:** Endre prosjektnavnet til `arena-booking-<kundenavn>`
5. Klikk **"Deploy"** (vil feile første gang pga manglende env vars - det er OK)

## Steg 4: Konfigurer miljøvariabler

I Vercel Dashboard for det nye prosjektet:

1. Gå til **Settings** → **Environment Variables**
2. Legg til følgende variabler for **alle miljøer** (Production, Preview, Development):

| Variabel | Verdi |
|----------|-------|
| `DATABASE_URL` | `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` |
| `DIRECT_URL` | (samme som DATABASE_URL, eller direkte URL uten pooling) |
| `NEXTAUTH_SECRET` | Lag ny: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://arena-booking-<kundenavn>.vercel.app` |

### Valgfritt: E-post (SMTP)
Hvis kunden skal sende e-post:

| Variabel | Verdi |
|----------|-------|
| `SMTP_HOST` | `smtp.office365.com` eller `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Kundens e-postadresse |
| `SMTP_PASS` | App-passord |
| `SMTP_FROM` | Avsenderadresse |

## Steg 5: Redeploy

1. Gå til **Deployments** i Vercel
2. Klikk **"Redeploy"** på siste deployment
3. Vent på at bygget fullføres

## Steg 6: Opprett organisasjon og admin-bruker

### Alternativ A: Bruk Prisma Studio (anbefalt)

```powershell
$env:DATABASE_URL="<CONNECTION_STRING>"
npx prisma studio
```

1. Gå til `Organization` tabellen
2. Klikk **"Add record"**
3. Fyll ut:
   - `name`: Kundens navn (f.eks. "Stavanger IL")
   - `slug`: Unik URL-vennlig ID (f.eks. "stavanger-il")
   - `tagline`: "Kalender" eller annet
   - `primaryColor`: "#2563eb" eller kundens farge
4. Lagre og kopier `id`

5. Gå til `User` tabellen
6. Klikk **"Add record"**
7. Fyll ut:
   - `email`: Admin e-post
   - `name`: Admin navn
   - `password`: Bruk bcrypt hash (se under)
   - `role`: "admin"
   - `organizationId`: ID fra steg 4
   - `isApproved`: true
8. Lagre

### Generere bcrypt passord-hash

```powershell
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('PASSORD_HER', 10).then(h => console.log(h))"
```

### Alternativ B: Bruk seed-script

Rediger `prisma/seed.ts` med kundens info og kjør:

```powershell
$env:DATABASE_URL="<CONNECTION_STRING>"
npx tsx prisma/seed.ts
```

## Steg 7: Sett opp domene (valgfritt)

### Subdomain (enklest)
Prosjektet er allerede tilgjengelig på:
`https://arena-booking-<kundenavn>.vercel.app`

### Custom domain
1. I Vercel: **Settings** → **Domains** → **Add**
2. Skriv inn kundens domene (f.eks. `booking.stavanger-il.no`)
3. Kunden må legge til DNS-record:
   - **Type:** CNAME
   - **Name:** booking (eller @)
   - **Value:** cname.vercel-dns.com
4. Oppdater `NEXTAUTH_URL` miljøvariabelen til det nye domenet

## Steg 8: Tilpass utseende

Kunden kan selv endre:
- Logo
- Farger
- Organisasjonsnavn

Via **Admin** → **Innstillinger** i appen.

---

## Sjekkliste for ny kunde

- [ ] Neon database opprettet
- [ ] Database-skjema pushet (`prisma db push`)
- [ ] Vercel prosjekt opprettet
- [ ] Miljøvariabler konfigurert
- [ ] Redeployet etter env vars
- [ ] Organisasjon opprettet i DB
- [ ] Admin-bruker opprettet
- [ ] Testet innlogging
- [ ] Domene konfigurert (valgfritt)
- [ ] E-post konfigurert (valgfritt)

---

## Gratis tier-grenser

### Neon (database)
- **10 gratis prosjekter**
- 3 GB lagring per prosjekt
- 1 GB RAM
- Ubegrenset compute-timer

### Vercel (hosting)
- **Ubegrenset prosjekter**
- 100 deployments per dag per prosjekt
- 100 GB bandwidth per måned (delt)
- Serverless functions: 100 GB-timer

### Totalt gratis
- **10 kunder** med full funksjonalitet
- Oppgrader til Pro når du får betalende kunder

---

## Oppdatere alle kunder

Når du pusher til `main` branch, vil **alle** Vercel-prosjekter automatisk oppdateres (de deler samme GitHub repo).

For å oppdatere manuelt:
1. Gå til hvert prosjekt i Vercel
2. Klikk **Deployments** → **Redeploy**

Eller bruk Vercel CLI:
```bash
vercel --prod
```

