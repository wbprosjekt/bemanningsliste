# Bemanningsliste

En moderne bemanningsstyringssystem bygget med Next.js og Supabase, integrert med Tripletex.

## 🚀 Teknologier

- **Next.js 15** (App Router med Turbopack)
- **React 19**
- **TypeScript**
- **Supabase** (Database, Auth, Edge Functions)
- **Tailwind CSS**
- **shadcn/ui** komponenter
- **React Query** (TanStack Query)
- **Tripletex API** integrasjon

## 📋 Funksjonalitet

### For ansatte:
- **Min uke** (`/min/uke/:year/:week`) - Personlig ukevisning med timeføring
- Prosjektsøk og tilordning
- Overtidshåndtering (50%/100%)
- Ukeoppsummering per prosjekt

### For administratorer:
- **Bemanningsliste** (`/admin/bemanningsliste/:year/:week`) - Oversikt over alle ansatte på tvers av uker
- **Brukerhåndtering** (`/admin/brukere`) - Inviter brukere, synkroniser fra Tripletex, håndter roller
- **Timer** (`/admin/timer`) - Godkjenne timer, eksportere til Tripletex
- **Tripletex-integrasjon** (`/admin/integrasjoner/tripletex`) - Synkronisere ansatte, prosjekter, aktiviteter

### Generell ukevisning:
- **Uke** (`/uke/:year/:week`) - Les-only visning for alle i organisasjonen

## 🛠️ Kom i gang

### Forutsetninger

- Node.js 20+ (anbefalt)
- npm
- Supabase-prosjekt

### Installasjon

```sh
# Klon repository
git clone <YOUR_GIT_URL>
cd bemanningsliste

# Installer avhengigheter
npm install

# Opprett .env.local fil med Supabase-credentials
cp .env .env.local
# Rediger .env.local med dine Supabase-variabler
```

### Miljøvariabler

Opprett en `.env.local` fil i rotmappen med følgende variabler:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Kjøre utviklingsserver

```sh
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000) i nettleseren.

### Bygge for produksjon

```sh
npm run build
npm run start
```

## 📁 Prosjektstruktur

```
bemanningsliste/
├── src/
│   ├── app/                  # Next.js App Router sider
│   │   ├── admin/           # Admin-sider
│   │   ├── min/uke/         # Personlig ukevisning
│   │   ├── uke/             # Generell ukevisning
│   │   ├── auth/            # Autentisering
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Dashboard/forsiden
│   ├── components/          # React-komponenter
│   │   ├── ui/             # shadcn/ui komponenter
│   │   ├── DayCard.tsx     # Dagskort for timeføring
│   │   ├── StaffingList.tsx # Bemanningsliste-komponent
│   │   └── ...
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities og hjelpefunksjoner
│   └── integrations/       # Supabase types og client
├── supabase/
│   ├── migrations/         # Database-migrasjoner
│   └── functions/          # Edge Functions (Tripletex API)
├── public/                 # Statiske filer
└── package.json
```

## 🔧 Utvikling

### Viktige kommandoer

```sh
npm run dev        # Start utviklingsserver
npm run build      # Bygg for produksjon
npm run start      # Kjør produksjonsbygg
npm run lint       # Kjør ESLint
```

### Database

Databasen administreres via Supabase. Migrasjoner ligger i `supabase/migrations/`.

For å kjøre migrasjoner lokalt:

```sh
cd supabase
supabase db reset  # Reset local database
```

### Tripletex-integrasjon

Tripletex API-kall håndteres via Supabase Edge Functions i `supabase/functions/`:

- `tripletex-api/` - Generell Tripletex API-proxy
- `calendar-sync/` - Synkroniserer kalenderdager
- `onboarding-setup/` - Setter opp nye brukere

## 🗓️ Dato-håndtering

Alle datoer bruker `toLocalDateString()` og `toLocalDateTimeString()` fra `@/lib/utils` for å unngå tidssone-problemer. Dette sikrer konsistent datoformat (YYYY-MM-DD) uten UTC-justering.

## 🔐 Autentisering

Autentisering håndteres via Supabase Auth. `useAuth`-hooken tilbyr:
- `user` - Innlogget bruker
- `session` - Aktiv sesjon
- `loading` - Loading-state
- `signOut()` - Logg ut

## 📝 Lisens

Proprietær - Kristian Walberg
