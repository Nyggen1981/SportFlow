# Deployment og Kundeadministrasjon

Denne mappen inneholder verktøy for å administrere alle Sportflow Booking-instanser.

## Filer

| Fil | Beskrivelse |
|-----|-------------|
| `customers.json` | Liste over alle kunder/instanser (COMMITS) |
| `databases.local.json` | Database-credentials (ALDRI COMMIT!) |
| `databases.local.example.json` | Mal for credentials-fil |
| `sync-all-databases.ts` | Node.js script for å synkronisere alle databaser |
| `push-schema-all.ps1` | PowerShell-alternativ (deprecated) |

## Oppsett

### 1. Opprett lokal credentials-fil

```powershell
Copy-Item deployment\databases.local.example.json deployment\databases.local.json
```

### 2. Fyll inn database-credentials

Rediger `databases.local.json` og legg inn riktige connection strings for hver kunde.

**Viktig:** Denne filen skal ALDRI committes til git!

## Bruk

### Pushe skjemaendringer til ALLE kunder

Når du gjør endringer i `prisma/schema.prisma`, kjør:

```bash
npm run db:push:all
```

Dette vil:
1. Lese alle database-credentials fra `databases.local.json`
2. Vise hvilke kunder som vil bli oppdatert
3. Be om bekreftelse
4. Kjøre `prisma db push` mot hver database
5. Vise sammendrag av resultatet

### Legge til ny kunde

1. Legg til kunden i `customers.json`
2. Legg til database-credentials i `databases.local.json`
3. Kjør `npm run db:push:all` for å synkronisere schema

## Nåværende kunder

| Kunde | Miljø | Vercel URL |
|-------|-------|------------|
| Sauda IL | Production | sportflow-booking.vercel.app |
| Test Kunde | Staging | sportflow-booking-test.vercel.app |

## Sjekkliste ved skjemaendringer

- [ ] Oppdater `prisma/schema.prisma`
- [ ] Test lokalt med `npm run db:push`
- [ ] Kjør `npm run db:push:all` for å oppdatere alle kunder
- [ ] Verifiser at alle databaser er oppdatert
- [ ] Push kode til git
- [ ] Deploy til Vercel (skjer automatisk ved push til main/development)

## Viktig!

**Før du pusher kodeendringer til git, kjør ALLTID `npm run db:push:all`** for å sikre at alle kundedatabaser er synkronisert med det nye skjemaet.

