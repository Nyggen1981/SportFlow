# E-postkonfigurasjon for Sportflow Booking

## Oversikt
Sportflow Booking-applikasjonen trenger tilgang til en SMTP-server for å sende e-postvarsler om bookinger. Applikasjonen bruker standard SMTP-protokoll (nodemailer).

**Viktig:** Sportflow Booking støtter nå per-organisasjon SMTP-innstillinger. Hver idrettslag kan konfigurere sin egen e-postserver direkte i admin-panelet. Dette gir bedre branding og fleksibilitet.

## To måter å konfigurere e-post

### 1. Per-organisasjon (Anbefalt for produksjon)
Hver organisasjon kan konfigurere sine egne SMTP-innstillinger i admin-panelet under "Innstillinger" → "E-postinnstillinger". Dette gir:
- E-poster sendt fra organisasjonens egen e-postadresse
- Bedre branding og troverdighet
- Fleksibilitet - hver organisasjon kan bruke sin egen e-postleverandør

### 2. Globale miljøvariabler (Fallback/Testing)
Hvis en organisasjon ikke har konfigurert egne SMTP-innstillinger, faller systemet tilbake til globale miljøvariabler. Disse settes i Vercel (eller annen hosting-plattform):

#### Påkrevde variabler:
- **SMTP_HOST** - SMTP-serveradressen (f.eks. `smtp.office365.com`, `smtp.gmail.com`, eller intern SMTP-server)
- **SMTP_PORT** - Portnummer (vanligvis `587` for TLS eller `465` for SSL)
- **SMTP_USER** - E-postadressen eller brukernavnet for SMTP-autentisering
- **SMTP_PASS** - Passord eller app-passord for SMTP-autentisering

#### Valgfri variabel:
- **SMTP_FROM** - Avsenderadresse (hvis ikke satt, brukes SMTP_USER)

## Hva IT-avdelingen må gjøre

### Alternativ 1: Bruk eksisterende e-postserver (anbefalt)
Hvis organisasjonen allerede har en e-postserver (Office 365, Exchange, etc.):

1. **Opprett en dedikert e-postkonto** for Sportflow Booking (f.eks. `sportflow@organisasjon.no`)
2. **Gi IT følgende informasjon:**
   - SMTP-serveradresse (f.eks. `smtp.office365.com`)
   - Portnummer (vanligvis `587` for STARTTLS eller `465` for SSL)
   - E-postadresse og passord for kontoen
   - Hvis MFA (tofaktorautentisering) er aktivert, må det opprettes et "app-passord"

### Alternativ 2: Intern SMTP-server
Hvis organisasjonen har en intern SMTP-server:

1. **Gi IT følgende informasjon:**
   - SMTP-serveradresse (f.eks. `mail.organisasjon.no` eller intern IP)
   - Portnummer (vanligvis `587` eller `25`)
   - Brukernavn og passord for autentisering
   - Bekreft at serveren tillater ekstern tilkobling (hvis applikasjonen hostes eksternt)

### Alternativ 3: Tredjepartstjeneste
Hvis organisasjonen ikke har egen e-postserver, kan IT vurdere:
- **SendGrid** (gratis tier: 100 e-poster/dag)
- **Mailgun** (gratis tier: 100 e-poster/dag)
- **Amazon SES** (pay-as-you-go)

## Vanlige SMTP-konfigurasjoner

### Office 365 / Microsoft 365
```
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=sportflow@organisasjon.no
SMTP_PASS=[app-passord hvis MFA er aktivert]
SMTP_FROM=sportflow@organisasjon.no
```

**Viktig for Office 365:**
- Hvis MFA er aktivert, må det opprettes et "app-passord" i Microsoft 365 Admin Center
- Vanlig passord vil ikke fungere med MFA aktivert

### Gmail
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=din-epost@gmail.com
SMTP_PASS=[app-passord fra Google Account]
SMTP_FROM=din-epost@gmail.com
```

**Viktig for Gmail:**
- Må aktivere "Mindre sikre apper" eller opprette app-passord
- App-passord opprettes i Google Account → Security → 2-Step Verification → App passwords

### Intern Exchange Server
```
SMTP_HOST=mail.organisasjon.no
SMTP_PORT=587
SMTP_USER=sportflow@organisasjon.no
SMTP_PASS=[passord]
SMTP_FROM=sportflow@organisasjon.no
```

## Sikkerhetshensyn

1. **Ikke del passord i klartekst** - Bruk sikker kanal for å dele passord
2. **App-passord anbefales** - Hvis MFA er aktivert, bruk app-passord i stedet for hovedpassord
3. **Begrens tilgang** - E-postkontoen bør kun brukes til Sportflow Booking, ikke personlig e-post
4. **Regelmessig passordbytte** - Vurder å bytte passord med jevne mellomrom

## Testing

Etter at miljøvariablene er satt opp, kan e-postfunksjonen testes via:
- Admin-panelet i Sportflow Booking (hvis test-endpoint er tilgjengelig)
- Eller ved å opprette en test-booking og se om e-post sendes

## Tekniske detaljer for IT

- **Protokoll:** SMTP med STARTTLS (port 587) eller SSL (port 465)
- **Autentisering:** SMTP AUTH (username/password)
- **Bibliotek:** nodemailer (Node.js)
- **Hosting:** Vercel (serverless functions)

## Kontaktinformasjon

Hvis IT har spørsmål om tekniske detaljer eller trenger mer informasjon, kan de kontakte utvikleren.

---

**Status:** Ventende på SMTP-konfigurasjon fra IT-avdelingen

