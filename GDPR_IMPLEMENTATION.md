# GDPR-implementering for Arena Booking

## Oversikt
Dette dokumentet beskriver alle GDPR-relaterte funksjoner som er implementert i Arena Booking-systemet.

## Implementerte funksjoner

### 1. Personvernpolicy-side ✅
- **Sti:** `/personvern`
- **Innhold:**
  - Informasjon om hvilke data som samles inn
  - Formål med behandlingen
  - Rettighetsgrunnlag
  - Brukerens rettigheter (innsyn, retting, sletting, dataportabilitet)
  - Informasjon om databehandlere
  - Lagringstid
  - Sikkerhetstiltak
  - Cookie-informasjon
  - Kontaktinformasjon

### 2. Cookie-banner ✅
- **Komponent:** `src/components/CookieBanner.tsx`
- **Funksjonalitet:**
  - Vises automatisk ved første besøk
  - Lagrer samtykke i localStorage
  - Informerer om bruk av nødvendige cookies (NextAuth)
  - Lenke til personvernpolicy
  - Kan lukkes/godtas

### 3. Footer med personvernlenker ✅
- **Fil:** `src/components/Footer.tsx`
- **Endringer:**
  - Lagt til lenke til personvernpolicy i footer
  - Synlig på alle sider

### 4. Brukerens egen dataeksport ✅
- **API-endepunkt:** `GET /api/user/data`
- **Funksjonalitet:**
  - Eksporterer alle brukerens personopplysninger
  - Inkluderer: profil, bookinger, preferanser
  - Returnerer JSON-format
  - Passord ekskludert fra eksport
- **Frontend:** Tilgjengelig via `/innstillinger`

### 5. Brukerens kontosletting ✅
- **API-endepunkt:** `DELETE /api/user/delete`
- **Funksjonalitet:**
  - Sletter brukerens konto og alle tilknyttede data
  - Cascade-delete håndterer bookinger og preferanser
  - Forhindrer sletting hvis bruker er eneste admin
  - Logger ut automatisk etter sletting
- **Frontend:** Tilgjengelig via `/innstillinger` med bekreftelse

### 6. Innstillinger-side for brukere ✅
- **Sti:** `/innstillinger`
- **Funksjoner:**
  - Viser kontoinformasjon
  - Eksporter data (GDPR - Right to data portability)
  - Slett konto (GDPR - Right to be forgotten)
  - Lenke til personvernpolicy
  - Tilgjengelig for alle innloggede brukere
- **Navigasjon:** Lagt til i hovednavigasjonen

### 7. Samtykke ved registrering ✅
- **Fil:** `src/app/register/page.tsx`
- **Funksjonalitet:**
  - Påkrevd checkbox for samtykke til personvernpolicy
  - Gjelder både "join" og "create" registreringsflyter
  - Lenke til personvernpolicy i checkbox-teksten
  - Validering før registrering kan fullføres

## GDPR-rettigheter dekket

### ✅ Rett til innsyn (Artikkel 15)
- Brukere kan eksportere alle sine data via `/innstillinger`
- Personvernpolicy forklarer hvilke data som samles inn

### ✅ Rett til retting (Artikkel 16)
- Brukere kan oppdatere sin profil (via eksisterende funksjonalitet)
- Admin kan oppdatere brukerdata

### ✅ Rett til sletting (Artikkel 17 - "Right to be forgotten")
- Brukere kan slette sin egen konto via `/innstillinger`
- Alle tilknyttede data slettes automatisk (cascade delete)

### ✅ Rett til dataportabilitet (Artikkel 20)
- Brukere kan eksportere data i JSON-format
- Strukturert og maskinlesbart format

### ✅ Rett til å klage (Artikkel 77)
- Informasjon om rett til å klage til Datatilsynet i personvernpolicy

### ✅ Informasjonsplikt (Artikkel 13-14)
- Personvernpolicy inneholder all nødvendig informasjon
- Samtykke ved registrering
- Cookie-banner informerer om cookies

## Tekniske detaljer

### Databehandlere
Systemet bruker følgende tjenester som databehandlere:
- **Vercel:** Hosting (serverless functions)
- **Supabase/PostgreSQL:** Database
- **SMTP-tjeneste:** E-postutsending

### Sikkerhetstiltak
- Krypterte passord (bcrypt)
- Sikker autentisering (NextAuth.js)
- HTTPS-kryptering
- Begrenset tilgang (autorisasjon)
- Cascade delete for dataintegritet

### Cookies
- NextAuth session cookies (nødvendig)
- Lagres for autentisering
- Informert om i cookie-banner og personvernpolicy

## Testing

### Teste funksjoner:
1. **Personvernpolicy:** Gå til `/personvern`
2. **Cookie-banner:** Slett localStorage og last siden på nytt
3. **Dataeksport:** Logg inn → Innstillinger → Eksporter data
4. **Kontosletting:** Logg inn → Innstillinger → Slett konto (test med testbruker!)
5. **Samtykke:** Prøv å registrere uten å huke av samtykke-checkboxen

## Neste steg (valgfritt)

### Forbedringer som kan vurderes:
1. **Logging av samtykke:** Lagre når bruker ga samtykke i databasen
2. **Samtykkehistorikk:** La brukere se når de ga samtykke
3. **Tilbakekalling av samtykke:** Funksjon for å trekke tilbake samtykke
4. **Data retention policy:** Automatisk sletting av gamle data
5. **DPIA (Data Protection Impact Assessment):** Dokumentere risikoanalyse

## Kontakt

Hvis du har spørsmål om GDPR-implementeringen, kontakt utvikleren eller se personvernpolicyn på `/personvern`.

---

**Status:** ✅ Alle grunnleggende GDPR-krav er implementert
**Dato:** {new Date().toLocaleDateString("nb-NO")}

