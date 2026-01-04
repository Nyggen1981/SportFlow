# Komplett liste over alle miljøvariabler

## 🔴 PÅKREVD (Må settes)

### Database
| Variabel | Verdi | Beskrivelse |
|----------|-------|-------------|
| `DATABASE_URL` | `postgresql://postgres.tvlxngbuzkmavtjqjpje:L3n0v02025!@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require` | Supabase Session Pooler connection string |
| `DIRECT_URL` | `postgresql://postgres.tvlxngbuzkmavtjqjpje:L3n0v02025!@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require` | Samme som DATABASE_URL for Supabase |

### NextAuth
| Variabel | Verdi | Beskrivelse |
|----------|-------|-------------|
| `NEXTAUTH_SECRET` | Generer ny: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` | Secret key for NextAuth (må være unik) |
| `NEXTAUTH_URL` | `https://<ditt-prosjektnavn>.vercel.app` | URL til ditt Vercel-prosjekt |

---

## 🟡 VALGFRITT (Anbefalt hvis du bruker funksjonen)

### E-post via SMTP
| Variabel | Verdi | Eksempel | Beskrivelse |
|----------|-------|----------|-------------|
| `SMTP_HOST` | SMTP-server | `smtp.office365.com` eller `smtp.gmail.com` | SMTP-server for e-post |
| `SMTP_PORT` | SMTP-port | `587` (TLS) eller `465` (SSL) | Port for SMTP |
| `SMTP_USER` | E-postadresse | `din-epost@example.com` | E-postadresse for SMTP |
| `SMTP_PASS` | App-passord | `ditt-app-passord` | Passord eller app-passord for SMTP |
| `SMTP_FROM` | Avsenderadresse | `din-epost@example.com` | Avsenderadresse (brukes hvis annet enn SMTP_USER) |

**Merk:** Hvis `SMTP_FROM` ikke er satt, brukes `SMTP_USER` som avsender.

### E-post via Resend (Alternativ til SMTP)
| Variabel | Verdi | Eksempel | Beskrivelse |
|----------|-------|----------|-------------|
| `RESEND_API_KEY` | Resend API-nøkkel | `re_xxxxxxxxxxxx` | API-nøkkel fra Resend |
| `EMAIL_FROM` | Avsenderadresse | `noreply@dindomain.no` | Avsenderadresse for Resend |

**Merk:** Du kan bruke enten SMTP eller Resend, ikke begge.

### Lisensserver
| Variabel | Verdi | Eksempel | Beskrivelse |
|----------|-------|----------|-------------|
| `LICENSE_SERVER_URL` | URL til lisensserver | `https://sportflow-license.vercel.app` | URL til lisensserver (standard hvis ikke satt) |
| `LICENSE_KEY` | Lisensnøkkel | `clxxxxxxxxxxxxxxxxxxxx` | Lisensnøkkel fra lisensserver (kan også settes i admin-panelet) |

**Merk:** Hvis `LICENSE_SERVER_URL` eller `LICENSE_KEY` ikke er satt, kjører appen i "development mode" og hopper over lisensvalidering.

### Vipps (Hvis du bruker Vipps betalinger)

**Viktig:** Vipps-konfigurasjonen settes i **Admin-innstillinger** i appen, ikke som miljøvariabler!

#### Krav til nettside før oppsett

Før du kan opprette Vipps på nett, må nettsiden din oppfylle følgende krav:

**1. Salgsvilkår**
Nettsiden må ha salgsvilkår som omhandler:
- Parter
- Betaling
- Levering
- Angrerett
- Retur
- Reklamasjonshåndtering
- Konfliktløsning

**2. Spesielle krav for booking-systemer (utleie):**
Hvis dere tilbyr utleie av fasiliteter, må det være informasjon om:
- Leieforhold
- Frist for ombooking, endring eller avbestilling
- Informasjon om oppsigelse/avslutning av leieforhold

**3. Firma- og kontaktinformasjon**
Følgende må være godt synlig på nettsiden (f.eks. nederst på siden eller under "Kontakt oss"):
- Navn på organisasjon/bedrift
- Organisasjonsnummer
- Adresse
- Telefonnummer
- E-postadresse

**4. Informasjon om produkter/tjenester**
- Beskrivelse av hva slags produkter/tjenester dere tilbyr
- Priser må fremkomme tydelig

**Merk:** Dette er minimumskrav fra Vipps. Det er bedriftens ansvar å sørge for at nettsiden følger gjeldende regler i markedet de opererer i.

#### Miljøvariabel (valgfritt)
| Variabel | Verdi | Eksempel | Beskrivelse |
|----------|-------|----------|-------------|
| `VIPPS_CALLBACK_URL` | Callback URL | `https://din-app.vercel.app/api/payment/webhook` | URL for Vipps webhook (standard: `${NEXTAUTH_URL}/api/payment/webhook`) |

**Merk:** Hvis ikke satt, brukes `${NEXTAUTH_URL}/api/payment/webhook` automatisk.

#### Vipps-credentials (settes i Admin-innstillinger)
Gå til **Admin → Innstillinger → Vipps-innstillinger** og fyll inn:

1. **Vipps Client ID** (Merchant Serial Number)
   - Finnes i Vipps Bedriftsportal under "API-nøkler"
   - Format: `12345678`

2. **Vipps Subscription Key**
   - Finnes i Vipps Bedriftsportal under "API-nøkler"
   - Format: `abc123def456...`

3. **Vipps Client Secret**
   - Finnes i Vipps Bedriftsportal under "API-nøkler"
   - Dette er en hemmelig nøkkel - vises kun én gang når den genereres

4. **Testmodus**
   - Slå på for testing (anbefalt i utvikling)
   - Slå av for produksjon

**Hvor finner jeg Vipps-credentials?**

1. **Logg inn på Vipps Bedriftsportal**
   - Gå til [portal.vipps.no](https://portal.vipps.no/) eller [portal.vippsmobilepay.com](https://portal.vippsmobilepay.com)
   - Logg inn med dine administratorrettigheter

2. **Naviger til "For utviklere"**
   - Klikk på **"For utviklere"** i sidemenyen
   - Hvis du ikke ser dette alternativet, må du be din administrator om å gi deg utviklertilgang

3. **Velg miljø og finn salgsenheten**
   - Velg fanen **"API-nøkler"**
   - Velg enten **"Produksjon"** eller **"Test"** (avhengig av hvilket miljø du konfigurerer)
   - **Viktig:** Hvis du ikke ser noen API-nøkler, må du bestille en av følgende løsninger fra Vipps:
     - **Integrert betaling** (anbefalt for booking-systemer)
     - **Faste betalinger**
     - **Logg inn**
   - **Merk:** API-nøkler er **ikke** tilgjengelige for "Handlekurv" og "Valgfritt beløp"
   - Finn den aktuelle salgsenheten i tabellen
   - Klikk på **"Vis nøkler"** - et panel åpnes med alle nødvendige nøkler

4. **Kopier nøklene**
   - **Merchant Serial Number** (Client ID) - f.eks. `12345678`
   - **Subscription Key** - f.eks. `abc123def456...`
   - **Client Secret** - viktig: vises kun én gang når den genereres!

**Viktig:** 
- Hvis du nylig har bestilt Vipps, kan det ta noen dager før API-nøklene vises i portalen
- Hvis nøklene blir kompromittert, generer nye umiddelbart ved å klikke på **"Generer"** ved siden av "Vis nøkler"-knappen
- Oppdater deretter integrasjonene dine med de nye nøklene
- For booking-systemer, anbefales **"Integrert betaling"**-løsningen fra Vipps

**Mer informasjon:**
- [Vipps hjelpesenter - Hvordan få API-nøkler](https://help.vippsmobilepay.com/en-NO/articles/how-to-get-api-keys)
- [Vipps utviklerdokumentasjon - API-nøkler](https://developer.vippsmobilepay.com/docs/knowledge-base/api-keys/)

---

## 🟢 VALGFRITT (Kun for spesielle tilfeller)

### Organisasjon
| Variabel | Verdi | Eksempel | Beskrivelse |
|----------|-------|----------|-------------|
| `PREFERRED_ORG_SLUG` | Organisasjons-slug | `haugesund-il` | Standard organisasjon hvis flere eksisterer |

### Utvikling/Testing
| Variabel | Verdi | Beskrivelse |
|----------|-------|-------------|
| `ALLOW_UNLICENSED` | `true` eller `false` | Tillat appen å kjøre uten lisens (kun for utvikling) |
| `NODE_ENV` | `development`, `production`, `test` | Automatisk satt av Vercel, men kan settes manuelt |

### Cron Jobs
| Variabel | Verdi | Beskrivelse |
|----------|-------|-------------|
| `CRON_SECRET` | Tilfeldig streng | Secret for å sikre cron-endepunkter |

**Merk:** Brukes for å sikre at cron-jobs kun kan kjøres av Vercel, ikke eksterne requests.

**Aktive cron-jobs:**
| Endpoint | Tidspunkt | Beskrivelse |
|----------|-----------|-------------|
| `/api/cron/license-expiry` | 08:00 daglig | Sjekker lisensutløp og sender varsel-epost |
| `/api/cron/report-stats` | 03:00 daglig | Sender bruksstatistikk til lisensserver |

### Backup Database (Hvis du bruker dual-write)
| Variabel | Verdi | Beskrivelse |
|----------|-------|-------------|
| `BACKUP_DATABASE_URL` | Connection string | Backup database for dual-write (ikke i bruk per nå) |

---

## 📋 Eksempel: Komplett .env fil

```env
# ============================================
# PÅKREVD
# ============================================

# Database (Supabase)
DATABASE_URL=postgresql://postgres.tvlxngbuzkmavtjqjpje:L3n0v02025!@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require
DIRECT_URL=postgresql://postgres.tvlxngbuzkmavtjqjpje:L3n0v02025!@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require

# NextAuth
NEXTAUTH_SECRET=din-genererte-secret-her
NEXTAUTH_URL=https://ditt-prosjekt.vercel.app

# ============================================
# VALGFRITT - E-post (SMTP)
# ============================================

SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=din-epost@example.com
SMTP_PASS=ditt-app-passord
SMTP_FROM=din-epost@example.com

# ELLER bruk Resend i stedet:
# RESEND_API_KEY=re_xxxxxxxxxxxx
# EMAIL_FROM=noreply@dindomain.no

# ============================================
# VALGFRITT - Lisensserver
# ============================================

LICENSE_SERVER_URL=https://sportflow-license.vercel.app
LICENSE_KEY=clxxxxxxxxxxxxxxxxxxxx

# ============================================
# VALGFRITT - Vipps
# ============================================

VIPPS_CALLBACK_URL=https://ditt-prosjekt.vercel.app/api/payment/webhook

# ============================================
# VALGFRITT - Andre
# ============================================

PREFERRED_ORG_SLUG=haugesund-il
CRON_SECRET=din-tilfeldige-streng-her
ALLOW_UNLICENSED=false
```

---

## 🔧 Hvordan generere NEXTAUTH_SECRET

### Windows PowerShell:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Mac/Linux:
```bash
openssl rand -base64 32
```

### Online:
Gå til [generate-secret.vercel.app](https://generate-secret.vercel.app/32)

---

## ✅ Minimum oppsett (kun påkrevd)

For å få applikasjonen til å kjøre, trenger du minimum:

```env
DATABASE_URL=postgresql://postgres.tvlxngbuzkmavtjqjpje:L3n0v02025!@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require
DIRECT_URL=postgresql://postgres.tvlxngbuzkmavtjqjpje:L3n0v02025!@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require
NEXTAUTH_SECRET=din-genererte-secret
NEXTAUTH_URL=https://ditt-prosjekt.vercel.app
```

**Merk:** Uten e-post-variabler kan du ikke sende e-post, men applikasjonen vil fortsatt fungere.

---

## 📝 Notater

- **Alle variabler** bør settes for **alle miljøer** (Production, Preview, Development) i Vercel
- **NEXTAUTH_SECRET** må være unik for hvert prosjekt
- **NEXTAUTH_URL** må matche domenet ditt
- **SMTP** og **Resend** er alternativer - bruk kun én
- **LICENSE_KEY** kan også settes i admin-panelet i stedet for miljøvariabel

