# Sportflow Booking - Mobil App

React Native / Expo app for Sportflow Booking-systemet.

## Funksjoner

### For brukere
- 🏠 **Hjemskjerm** - Oversikt over kommende bookinger
- 🏢 **Fasiliteter** - Bla gjennom og søk etter fasiliteter
- 📅 **Kalender** - Ukesvisning med alle bookinger
- 📋 **Mine bookinger** - Kommende og historiske bookinger
- 👤 **Profil** - Kontoinformasjon og innstillinger

### For admin
- 📊 **Dashboard** - Oversikt over ventende bookinger
- ✅ **Godkjenning** - Godkjenn/avslå bookinger med begrunnelse
- 📋 **Alle bookinger** - Filtrer og administrer alle bookinger

## Oppsett

### Forutsetninger
- Node.js 20+
- npm eller yarn
- Expo CLI
- Android Studio / Xcode (for emulatorer)
- Expo Go app (for fysisk enhet)

### Installasjon

```bash
cd mobile
npm install
```

### Konfigurasjon

Oppdater API URL i følgende filer for å peke til din backend:

- `src/context/AuthContext.tsx`
- `src/api/client.ts`
- `src/screens/*.tsx`

Endre `API_BASE_URL`:

```typescript
const API_BASE_URL = __DEV__ 
  ? 'http://DIN_IP:3000'  // Din lokale IP for utvikling
  : 'https://din-app.vercel.app'  // Produksjons-URL
```

### Kjøre appen

```bash
# Start Expo development server
npx expo start

# Kjør på Android
npx expo start --android

# Kjør på iOS
npx expo start --ios

# Kjør i nettleser
npx expo start --web
```

## Prosjektstruktur

```
mobile/
├── src/
│   ├── api/           # API-klient
│   ├── components/    # Gjenbrukbare komponenter
│   ├── context/       # React Context (Auth)
│   ├── navigation/    # Navigasjonsoppsett
│   ├── screens/       # App-skjermer
│   │   ├── admin/     # Admin-skjermer
│   │   └── *.tsx      # Bruker-skjermer
│   ├── types/         # TypeScript typer
│   └── utils/         # Hjelpefunksjoner
├── assets/            # Bilder og ikoner
├── App.tsx            # Hovedkomponent
└── app.json           # Expo-konfigurasjon
```

## Testing på fysisk enhet

1. Last ned "Expo Go" fra App Store / Google Play
2. Start utviklingsserveren: `npx expo start`
3. Skann QR-koden med kameraet (iOS) eller Expo Go-appen (Android)

## Bygge for produksjon

### Android (APK/AAB)
```bash
npx expo build:android
```

### iOS (IPA)
```bash
npx expo build:ios
```

### EAS Build (anbefalt)
```bash
npx eas build --platform android
npx eas build --platform ios
```

## Push-varsler

Appen er klargjort for push-varsler med `expo-notifications`. For å aktivere:

1. Konfigurer Expo Push Notifications i app.json
2. Implementer push token-registrering i AuthContext
3. Send push-tokenet til backend ved innlogging

## Avhengigheter

- **Expo SDK 54** - React Native rammeverk
- **React Navigation** - Navigasjon
- **date-fns** - Datohåndtering
- **expo-secure-store** - Sikker lagring
- **expo-notifications** - Push-varsler

## Versjon

v1.0.0 - Initial release

