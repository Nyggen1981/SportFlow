# Guide: Migrere fra en Neon database til en annen

Denne guiden viser hvordan du migrerer all data fra en Neon database til en annen for Sauda IL sitt prosjekt.

## Oversikt

Migrasjonsprosessen består av følgende steg:
1. Opprett ny Neon database
2. Sett opp schema i ny database
3. Migrer data fra gammel til ny database
4. Oppdater connection strings
5. Test og verifiser

## Steg 1: Opprett ny Neon database

1. Gå til [console.neon.tech](https://console.neon.tech)
2. Klikk **"New Project"** eller velg eksisterende prosjekt
3. Opprett en ny database (eller bruk eksisterende)
4. **Kopier connection strings** - du trenger både:
   - **DATABASE_URL** (pooler URL)
   - **DIRECT_URL** (direkte URL uten pooling)

## Steg 2: Sett opp schema i ny database

Før du migrerer data, må den nye databasen ha riktig schema:

```powershell
# Sett miljøvariabel til ny database
$env:DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require"
$env:DIRECT_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"

# Push schema til ny database
npx prisma db push
```

## Steg 3: Migrer data

Kjør migrasjonsscriptet:

```powershell
npm run db:migrate
```

Scriptet vil spørre deg om:
- **Kilde database** (gammel) DATABASE_URL og DIRECT_URL
- **Mål database** (ny) DATABASE_URL og DIRECT_URL

Scriptet vil:
- ✅ Kopiere alle organisasjoner
- ✅ Kopiere alle kategorier
- ✅ Kopiere alle brukere
- ✅ Kopiere alle ressurser og ressursdeler
- ✅ Kopiere alle bookinger
- ✅ Kopiere alle brukerpreferanser
- ✅ Kopiere alle e-postmaler

**Viktig:** Scriptet bruker `upsert`, så eksisterende data i mål-databasen vil bli oppdatert hvis ID-en allerede finnes.

## Steg 4: Oppdater connection strings

### Lokalt (.env fil)

Oppdater `.env` filen med de nye connection strings:

```env
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
```

### Vercel (hvis relevant)

1. Gå til Vercel Dashboard → Ditt prosjekt → Settings → Environment Variables
2. Oppdater `DATABASE_URL` og `DIRECT_URL` for alle miljøer (Production, Preview, Development)
3. Redeploy applikasjonen

### databases.local.json (hvis du bruker den)

Oppdater `deployment/databases.local.json`:

```json
{
  "databases": {
    "sauda-il": {
      "DATABASE_URL": "postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require",
      "DIRECT_URL": "postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
    }
  }
}
```

## Steg 5: Test og verifiser

1. **Test lokalt:**
   ```powershell
   npm run dev
   ```
   Logg inn og sjekk at alt fungerer som forventet.

2. **Verifiser data:**
   ```powershell
   npm run db:studio
   ```
   Åpne Prisma Studio og sjekk at all data er migrert korrekt.

3. **Sjekk bookinger:**
   - Gå til kalenderen
   - Verifiser at alle bookinger vises korrekt
   - Test å opprette en ny booking

4. **Sjekk brukere:**
   - Prøv å logge inn med eksisterende brukere
   - Verifiser at roller og rettigheter er korrekte

## Feilsøking

### Schema-feil i mål-database

Hvis du får feil om manglende tabeller:
```powershell
# Sørg for at schema er pushet først
$env:DATABASE_URL="<ny-database-url>"
npx prisma db push
```

### Foreign key-feil

Hvis du får foreign key-feil under migrering, sjekk at:
- Organizations migreres først
- Resources migreres etter Organizations og Categories
- Bookings migreres etter Users, Resources og ResourceParts

Scriptet håndterer dette automatisk, men hvis du får problemer, kan du kjøre migrasjonen i flere runder.

### Connection timeout

Hvis du får timeout-feil:
- Sjekk at connection strings er riktige
- Prøv å bruke DIRECT_URL i stedet for DATABASE_URL
- Sjekk at databasen er tilgjengelig fra din IP-adresse

## Sikkerhetskopi

**Viktig:** Før du migrerer, anbefaler vi å ta en sikkerhetskopi av den gamle databasen:

1. I Neon Console → Database → Backups
2. Ta en manuell backup eller bruk automatisk backup

## Når migreringen er fullført

1. ✅ Test applikasjonen grundig
2. ✅ Verifiser at alle bookinger, brukere og ressurser er korrekte
3. ✅ Oppdater dokumentasjon med nye connection strings
4. ⚠️ **Ikke slett den gamle databasen før du er 100% sikker på at alt fungerer!**

## Hjelp

Hvis du støter på problemer:
1. Sjekk at begge databaser er tilgjengelige
2. Verifiser at schema er identisk i begge databaser
3. Sjekk Prisma logs for detaljerte feilmeldinger
4. Ta kontakt hvis du trenger hjelp!

