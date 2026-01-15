# Migrasjon av roller - Sikker migrasjonsguide

## Oversikt

Dette dokumentet beskriver hvordan du migrerer eksisterende brukere til den nye rolle-strukturen uten å påvirke produksjon.

## Bakoverkompatibilitet

✅ **Alle endringer er bakoverkompatible:**
- `role`-feltet er beholdt og fungerer som før
- Eksisterende kode som sjekker `role` vil fortsatt fungere
- Nye felter (`systemRole`, `customRoleId`) har fallback-logikk

## Migrasjonsstrategi

### Steg 1: Oppdater database-schema (ikke-destruktivt)

```bash
# Lokalt
npm run db:push

# For alle kunder (hvis nødvendig)
npm run db:push:all
```

Dette vil:
- ✅ Legge til `CustomRole`-tabellen
- ✅ Legge til `systemRole` og `customRoleId` i `User`-tabellen
- ✅ **IKKE** slette eller endre eksisterende data
- ✅ Setter `systemRole = "user"` som default for nye brukere

### Steg 2: Migrer eksisterende brukere (valgfritt, men anbefalt)

Kjør migrasjonsscriptet for å oppdatere eksisterende brukere:

```bash
npx tsx deployment/migrate-roles.ts
```

Dette scriptet:
- ✅ Setter `systemRole` basert på eksisterende `role`-verdi
- ✅ Beholder `role`-feltet for bakoverkompatibilitet
- ✅ Kan kjøres flere ganger uten å påvirke data
- ✅ Er trygt å kjøre på produksjon

**Mapping:**
- `role = "admin"` → `systemRole = "admin"`
- `role = "moderator"` → `systemRole = "user"` (kan opprette custom role senere)
- `role = "user"` → `systemRole = "user"`

### Steg 3: Test lokalt først

1. Test at eksisterende brukere kan logge inn
2. Test at admin-funksjonalitet fungerer
3. Test at moderator-funksjonalitet fungerer (hvis relevant)

## Fallback-logikk

Koden har innebygd fallback for eksisterende brukere:

```typescript
// I auth.ts
const systemRole = user.systemRole || (user.role === "admin" ? "admin" : "user")
```

Dette betyr at:
- ✅ Brukere uten `systemRole` får automatisk riktig verdi basert på `role`
- ✅ Ingen eksisterende brukere mister tilgang
- ✅ Produksjon fungerer selv uten migrasjon

## Hva skjer med eksisterende moderatorer?

Eksisterende brukere med `role = "moderator"` blir:
- `systemRole = "user"`
- `customRoleId = null`
- `role = "user"` (oppdateres)

**For å gi dem moderator-tilgang igjen:**
1. Gå til `/admin/roles`
2. Opprett en ny rolle med "Moderator-tilgang" aktivert
3. Gå til `/admin/users` og tildel rollen til brukerne

## Produksjon-sikkerhet

### ✅ Trygt å deploye uten migrasjon
- Koden har fallback-logikk
- Eksisterende funksjonalitet fungerer som før
- Nye felter har default-verdier

### ✅ Trygt å kjøre migrasjon
- Scriptet kan kjøres flere ganger
- Ingen data slettes
- Kun oppdaterer manglende verdier

### ⚠️ Før produksjon-deploy
1. Test lokalt med produksjonsdata (backup)
2. Kjør migrasjonsscriptet lokalt først
3. Verifiser at alt fungerer
4. Deploy til produksjon
5. Kjør migrasjonsscriptet på produksjon (valgfritt)

## Rollback-strategi

Hvis noe går galt:

1. **Koden er bakoverkompatibel** - gamle kode fungerer fortsatt
2. **Ingen data slettes** - `role`-feltet er beholdt
3. **Kan rulle tilbake kode** - gamle versjoner fungerer med nye data

## Verifisering

Etter migrasjon, verifiser:

```sql
-- Sjekk at alle brukere har systemRole
SELECT id, email, role, systemRole, customRoleId 
FROM "User" 
WHERE systemRole IS NULL;

-- Sjekk at admin-brukere har systemRole = 'admin'
SELECT id, email, role, systemRole 
FROM "User" 
WHERE role = 'admin' AND systemRole != 'admin';
```

## Support

Hvis du opplever problemer:
1. Sjekk at `systemRole`-feltet eksisterer i databasen
2. Kjør migrasjonsscriptet
3. Sjekk at `role`-feltet fortsatt har riktige verdier

