# Guide: Migrere til ny Vercel-konto

## 📋 Oversikt

Dette er en enkel guide for å flytte prosjektet til en ny Vercel-konto uten å endre database eller kode.

## Steg 1: Opprett nytt Vercel-prosjekt

1. Logg inn på [vercel.com](https://vercel.com) med din **nye konto**
2. Klikk **"Add New..."** → **"Project"**
3. Velg **"Import Git Repository"**
4. Velg samme GitHub-repository som før
5. **Viktig:** Gi prosjektet et nytt navn (f.eks. `sportflow-ny-konto`)
6. Klikk **"Deploy"** (vil feile første gang pga manglende env vars - det er OK)

## Steg 2: Konfigurer miljøvariabler

I det nye Vercel-prosjektet:

1. Gå til **Settings** → **Environment Variables**
2. Legg til følgende variabler for **alle miljøer** (Production, Preview, Development):

### Database (fra gamle Vercel-prosjektet)
Hent disse fra det gamle Vercel-prosjektet:
- Gå til gammelt prosjekt → Settings → Environment Variables
- Kopier `DATABASE_URL` og `DIRECT_URL`

| Variabel | Verdi |
|----------|-------|
| `DATABASE_URL` | (Kopier fra gammelt prosjekt) |
| `DIRECT_URL` | (Kopier fra gammelt prosjekt) |

### NextAuth (generer ny secret)
| Variabel | Verdi |
|----------|-------|
| `NEXTAUTH_SECRET` | Generer ny: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://<nytt-prosjektnavn>.vercel.app` |

### Andre miljøvariabler
Kopier alle andre miljøvariabler fra gammelt prosjekt:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (hvis du bruker e-post)
- `LICENSE_SERVER_URL`, `LICENSE_KEY` (hvis du bruker lisensserver)
- `RESEND_API_KEY`, `EMAIL_FROM` (hvis du bruker Resend)
- Alle andre variabler du har

## Steg 3: Redeploy

1. Gå til **Deployments** i Vercel Dashboard
2. Klikk **"Redeploy"** på siste deployment
3. Vent på at bygget fullføres

## Steg 4: Test

1. Gå til `https://<nytt-prosjektnavn>.vercel.app`
2. Test at alt fungerer:
   - ✅ Innlogging
   - ✅ Bookinger
   - ✅ Alle funksjoner

## Steg 5: Oppdater domene (hvis du bruker custom domain)

1. I nye Vercel-prosjektet: **Settings** → **Domains** → **Add**
2. Legg til domenet
3. Oppdater DNS-records hos din DNS-leverandør
4. Oppdater `NEXTAUTH_URL` miljøvariabelen til det nye domenet
5. Redeploy

## Steg 6: Pause gammelt Vercel-prosjekt (valgfritt)

Hvis du vil pause det gamle prosjektet:

1. Gå til gammelt Vercel-prosjekt
2. **Settings** → **General** → Scroll ned til **"Danger Zone"**
3. Klikk **"Pause Project"** eller **"Delete Project"**

**⚠️ Viktig:** Ikke slett før du er 100% sikker på at det nye prosjektet fungerer!

## ✅ Sjekkliste

- [ ] Nytt Vercel-prosjekt opprettet
- [ ] Miljøvariabler kopiert fra gammelt prosjekt
- [ ] Ny `NEXTAUTH_SECRET` generert
- [ ] `NEXTAUTH_URL` oppdatert
- [ ] Prosjektet redeployet
- [ ] Testet at alt fungerer
- [ ] Custom domain oppdatert (hvis relevant)
- [ ] Gammelt prosjekt pauset/slettet (valgfritt)

## 🔍 Hvor finner jeg miljøvariabler i gammelt prosjekt?

1. Gå til [vercel.com](https://vercel.com)
2. Logg inn med **gammel konto**
3. Velg gammelt prosjekt
4. **Settings** → **Environment Variables**
5. Kopier alle variabler

## 💡 Tips

- **Behold gammelt prosjekt i 1-2 uker** som backup
- **Test grundig** før du sletter gammelt prosjekt
- **Samme database** - ingen endringer i database nødvendig
- **Samme kode** - bruker samme GitHub-repo
