# Prislogikk Implementering

## Oversikt
Implementert fleksibel prislogikk med støtte for flere pris-regler per ressurs, rollebasert prising, og lisensserver-avhengighet.

## Dato
Implementert: 2024

## Hva er implementert

### 1. Database Schema (Prisma)
- **Nytt felt**: `pricingRules` (JSON array) i `Resource` og `ResourcePart` modeller
- **Legacy felter**: Beholdt for bakoverkompatibilitet (`pricingModel`, `pricePerHour`, `pricePerDay`, `fixedPrice`, `fixedPriceDuration`, `freeForRoles`)

**PricingRule struktur:**
```typescript
{
  forRoles: string[] // Array av role IDs eller "admin", "user". Tom array = standard
  model: "FREE" | "HOURLY" | "DAILY" | "FIXED" | "FIXED_DURATION"
  pricePerHour?: number
  pricePerDay?: number
  fixedPrice?: number
  fixedPriceDuration?: number // minutter
}
```

### 2. Prislogikk (`src/lib/pricing.ts`)
- **`isPricingEnabled()`**: Sjekker lisensserver-status
  - Aktiv for: `pilot`, `premium`, `standard` lisenser
  - Sjekker `licenseType` og `features`
  
- **`getPricingConfig()`**: Henter pris-konfigurasjon
  - Støtter både nytt format (`pricingRules`) og legacy format
  - Konverterer automatisk legacy format til nytt format
  
- **`findPricingRuleForUser()`**: Finner riktig pris-regel basert på brukerens rolle
  - Sjekker spesifikke roller først
  - Fallback til standard-regel (tom `forRoles` array)
  
- **`calculateBookingPrice()`**: Beregner pris for en booking
  - Støtter alle pris-modeller (HOURLY, DAILY, FIXED, FIXED_DURATION, FREE)
  - Returnerer `BookingPriceCalculation` med pris, breakdown, og metadata

### 3. Booking API
- **`/api/bookings` (POST)**: Automatisk prisberegning ved booking-opprettelse
  - Kaller `calculateBookingPrice()` for hver booking
  - Setter `totalAmount` i booking-databasen
  - Støtter både enkelt- og recurring bookings

### 4. Admin UI
- **`/admin/resources/[id]`**: Konfigurasjon av pris-regler
  - Legg til/fjern flere pris-regler
  - Velg roller per regel
  - Konfigurer pris-modell og verdier per regel
  - Standard-regel (tom forRoles) for alle andre roller
  - Kun vises hvis prising er aktivert via lisensserver

### 5. API Ruter
- **`/api/pricing/status`**: Sjekker om prising er aktivert
- **`/api/admin/resources/[id]`**: Oppdatert for å håndtere `pricingRules`

## Eksempel på bruk

### Scenario: Trener får gratis, vanlig bruker betaler per time
```json
[
  {
    "forRoles": ["trener-role-id"],
    "model": "FREE"
  },
  {
    "forRoles": [],
    "model": "HOURLY",
    "pricePerHour": 500
  }
]
```

## Hva som mangler (ikke implementert)

### 1. Presentasjon til kunde
- ❌ Ingen prisvisning i booking-skjemaet (`/resources/[id]/book`)
- ❌ Ingen prisvisning i booking-bekreftelse
- ❌ Ingen prisvisning i "Mine bookinger"
- ❌ Ingen prisvisning på fasilitetssiden

### 2. Neste steg
1. Legg til API-endpoint for å hente beregnet pris før booking
2. Vis pris i booking-skjemaet basert på valgt tid og rolle
3. Vis pris i booking-bekreftelse
4. Vis pris i "Mine bookinger" listen
5. Eventuelt vis pris på fasilitetssiden

## Tekniske detaljer

### Lisensserver-avhengighet
Prislogikk er kun aktiv hvis:
- Lisensserver returnerer `licenseType: "pilot"`, `"premium"`, eller `"standard"`
- Eller `features.emailNotifications: true` (midlertidig indikator)

### Bakoverkompatibilitet
- Legacy felter beholdt i database
- Automatisk konvertering fra legacy til nytt format
- Fallback-logikk i alle relevante funksjoner

### Rollehåndtering
- Støtter system-roller: `"admin"`, `"user"`
- Støtter custom roles (via `customRoleId`)
- Sjekker roller i prioritert rekkefølge

## Filer endret
- `prisma/schema.prisma` - Nytt `pricingRules` felt
- `src/lib/pricing.ts` - Prislogikk-funksjoner
- `src/app/api/bookings/route.ts` - Prisberegning ved booking
- `src/app/admin/resources/[id]/page.tsx` - Admin UI for pris-konfigurasjon
- `src/app/api/admin/resources/[id]/route.ts` - API for å lagre pris-regler
- `src/app/api/pricing/status/route.ts` - Status-endpoint

## Commits
- `e8c81461` - Implementer fleksibel prislogikk med lisensserver-avhengighet
- `f9aaea0d` - Legg til pilot-lisens som har tilgang til prislogikk
- `abd0045f` - Støtt flere prislogikker per ressurs med rollebasert prising
- `dc3fa5d3` - Fiks: Fjern referanser til gamle pricing state-variabler
- `27f081e0` - Fiks: Bruk rule.model i stedet for config.model i calculateBookingPrice

