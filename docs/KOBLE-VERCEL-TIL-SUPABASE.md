# Guide: Koble nytt Vercel-prosjekt til Supabase database

## 📋 Oversikt

Du har:
- ✅ Supabase database (med all migrert data)
- ✅ Nytt Vercel-prosjekt (fra ny konto, linket til GitHub)

Nå skal vi koble dem sammen.

---

## Steg 1: Hent Supabase connection strings

1. Gå til [Supabase Dashboard](https://app.supabase.com)
2. Velg prosjektet ditt
3. Gå til **Settings** → **Database**
4. Under **"Connection string"**, velg:
   - **Type:** URI
   - **Source:** Primary Database
   - **Method:** Session pooler (for IPv4-kompatibilitet)

5. **Kopier connection stringen** - den ser slik ut:
   ```
   postgresql://postgres.tvlxngbuzkmavtjqjpje:[YOUR-PASSWORD]@aws-1-eu-west-1.pooler.supabase.com:5432/postgres
   ```

6. **Erstatt `[YOUR-PASSWORD]`** med ditt faktiske passord: `L3n0v02025!`

**Full connection string:**
```
postgresql://postgres.tvlxngbuzkmavtjqjpje:L3n0v02025!@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require
```

---

## Steg 2: Oppdater miljøvariabler i Vercel

1. Gå til [Vercel Dashboard](https://vercel.com)
2. Logg inn med din **nye konto**
3. Velg det **nye prosjektet**
4. Gå til **Settings** → **Environment Variables**
5. Legg til følgende variabler for **alle miljøer** (Production, Preview, Development):

### Database (PÅKREVD)

| Variabel | Verdi | Beskrivelse |
|----------|-------|-------------|
| `DATABASE_URL` | `postgresql://postgres.tvlxngbuzkmavtjqjpje:L3n0v02025!@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require` | Supabase Session Pooler connection string |
| `DIRECT_URL` | `postgresql://postgres.tvlxngbuzkmavtjqjpje:L3n0v02025!@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require` | Samme som DATABASE_URL for Supabase |

### NextAuth (PÅKREVD)

| Variabel | Verdi | Beskrivelse |
|----------|-------|-------------|
| `NEXTAUTH_SECRET` | Generer ny: `openssl rand -base64 32` | Secret key for NextAuth (må være unik for dette prosjektet) |
| `NEXTAUTH_URL` | `https://<ditt-prosjektnavn>.vercel.app` | URL til ditt Vercel-prosjekt |

**Generer NEXTAUTH_SECRET:**
```powershell
# Windows PowerShell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Eller:
```bash
# Mac/Linux
openssl rand -base64 32
```

### E-post (SMTP) - Hvis du bruker e-post

Hent disse fra det gamle Vercel-prosjektet eller fra `.env` filen:

| Variabel | Verdi | Eksempel |
|----------|-------|----------|
| `SMTP_HOST` | SMTP-server | `smtp.office365.com` eller `smtp.gmail.com` |
| `SMTP_PORT` | SMTP-port | `587` |
| `SMTP_USER` | E-postadresse | `din-epost@example.com` |
| `SMTP_PASS` | App-passord | `ditt-app-passord` |
| `SMTP_FROM` | Avsenderadresse | `din-epost@example.com` |

### Lisens (Hvis du bruker lisensserver)

| Variabel | Verdi | Beskrivelse |
|----------|-------|-------------|
| `LICENSE_SERVER_URL` | URL til lisensserver | `https://sportflow-license.vercel.app` |
| `LICENSE_KEY` | Lisensnøkkel | (Kan også settes i admin-panelet) |

### Resend (Hvis du bruker Resend for e-post)

| Variabel | Verdi | Beskrivelse |
|----------|-------|-------------|
| `RESEND_API_KEY` | Resend API-nøkkel | `re_xxxxxxxxxxxx` |
| `EMAIL_FROM` | Avsenderadresse | `noreply@dindomain.no` |

---

## Steg 3: Redeploy Vercel-prosjektet

1. Gå til **Deployments** i Vercel Dashboard
2. Klikk **"Redeploy"** på siste deployment
3. Velg **"Use existing Build Cache"** (valgfritt)
4. Klikk **"Redeploy"**
5. Vent på at bygget fullføres

---

## Steg 4: Test applikasjonen

1. Gå til `https://<ditt-prosjektnavn>.vercel.app`
2. Test at alt fungerer:
   - ✅ Innlogging med eksisterende brukere
   - ✅ Bookinger vises
   - ✅ Fakturaer fungerer
   - ✅ Alle funksjoner

---

## Steg 5: Oppdater domene (hvis du bruker custom domain)

1. I Vercel: **Settings** → **Domains** → **Add**
2. Legg til domenet
3. Oppdater DNS-records hos din DNS-leverandør
4. Oppdater `NEXTAUTH_URL` miljøvariabelen til det nye domenet
5. Redeploy

---

## ✅ Sjekkliste

- [ ] Supabase connection string hentet (Session Pooler)
- [ ] `DATABASE_URL` satt i Vercel
- [ ] `DIRECT_URL` satt i Vercel
- [ ] `NEXTAUTH_SECRET` generert og satt
- [ ] `NEXTAUTH_URL` satt til Vercel-prosjekt URL
- [ ] SMTP-variabler satt (hvis relevant)
- [ ] Lisens-variabler satt (hvis relevant)
- [ ] Prosjektet redeployet
- [ ] Testet at innlogging fungerer
- [ ] Testet at bookinger vises
- [ ] Testet at alle funksjoner fungerer

---

## 🔍 Hvor finner jeg miljøvariabler fra gammelt prosjekt?

Hvis du trenger å kopiere miljøvariabler fra gammelt Vercel-prosjekt:

1. Logg inn på [vercel.com](https://vercel.com) med **gammel konto**
2. Velg gammelt prosjekt
3. **Settings** → **Environment Variables**
4. Kopier alle relevante variabler (SMTP, LICENSE, etc.)

---

## ⚠️ Viktig

- **NEXTAUTH_SECRET må være unik** - generer alltid en ny for hvert prosjekt
- **NEXTAUTH_URL må matche domenet** - oppdater hvis du endrer domene
- **Test grundig** før du pauser/sletter gammelt prosjekt
- **Behold gammelt prosjekt i 1-2 uker** som backup

---

## 🐛 Feilsøking

### Database connection feil
- Sjekk at connection string er riktig
- Sjekk at passord er korrekt (ingen ekstra mellomrom)
- Sjekk at `?sslmode=require` er inkludert

### Innlogging fungerer ikke
- Sjekk at `NEXTAUTH_SECRET` er satt
- Sjekk at `NEXTAUTH_URL` matcher domenet
- Sjekk at brukere er migrert til Supabase

### E-post fungerer ikke
- Sjekk at SMTP-variabler er korrekte
- Test SMTP-innstillinger i admin-panelet

---

## 📞 Hjelp

Hvis du støter på problemer:
1. Sjekk Vercel deployment logs
2. Sjekk Supabase database logs
3. Verifiser at alle miljøvariabler er satt korrekt

