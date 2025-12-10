# Deployment Checklist - EmailTemplate

## Status
✅ Database er synkronisert (EmailTemplate-tabellen eksisterer)
✅ Feilhåndtering er på plass
✅ Vercel build-konfigurasjon er satt opp

## Hva som skjer ved neste deploy:

1. **Vercel vil automatisk:**
   - Kjøre `npm install` (som kjører `postinstall: prisma generate`)
   - Kjøre `prisma generate && next build` (fra vercel.json)
   - Dette sikrer at Prisma Client genereres med EmailTemplate-modellen

2. **Hvis det fortsatt feiler:**
   - Sjekk Vercel build logs for spesifikke feilmeldinger
   - Verifiser at `EmailTemplate`-modellen er tilgjengelig i Prisma Client
   - Sjekk at alle miljøvariabler er satt riktig i Vercel

## Verifisering etter deploy:

1. Gå til `/admin/settings` (som admin)
2. Scroll ned til "E-postmaler"-seksjonen
3. Hvis du ser e-postmaler, fungerer alt!
4. Hvis du ser en feil, sjekk browser console og Vercel logs

## Hvis det fortsatt feiler:

1. **Sjekk Vercel Runtime Logs:**
   - Gå til Vercel Dashboard → Prosjektet ditt → Logs
   - Se etter feilmeldinger om EmailTemplate

2. **Manuell Prisma Client regenerering:**
   - I Vercel Dashboard → Settings → Environment Variables
   - Verifiser at DATABASE_URL og DIRECT_URL er satt

3. **Force rebuild:**
   - I Vercel Dashboard → Deployments
   - Klikk på tre prikker ved siden av deployment
   - Velg "Redeploy"

## Feilhåndtering i koden:

Koden er nå konfigurert til å:
- Bruke standardmaler hvis EmailTemplate-tabellen ikke finnes
- Bruke standardmaler hvis Prisma Client ikke har EmailTemplate-modellen
- Ikke krasje applikasjonen, men logge advarsler

Dette betyr at applikasjonen skal fungere selv om EmailTemplate ikke er tilgjengelig, men e-postmal-redigering vil ikke fungere før alt er på plass.

