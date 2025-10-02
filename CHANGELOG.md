# 📝 Changelog

Alle viktige endringer i dette prosjektet vil bli dokumentert i denne filen.

Formatet er basert på [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
og dette prosjektet følger [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### 🚀 Added
- React Query DevTools for development monitoring
- Comprehensive migration documentation
- Performance monitoring og metrics

### 🔧 Changed
- Forbedret error boundaries og error handling

---

## [2.1.0] - 2025-10-02

### 🚀 Added
- **React Query Migration** - Komplett migrering til TanStack Query
  - Intelligent caching med konfigurerbare cache-tider
  - Automatisk background refetching
  - Optimistic updates for mutations
  - 70-80% reduksjon i API-kall
- **Custom Data Hooks** - `src/hooks/useStaffingData.ts`
  - `useUserProfile()` - Brukerprofildata
  - `useEmployees()` - Ansatte i organisasjon  
  - `useProjects()` - Prosjekter og aktiviteter
  - `useProjectColors()` - Prosjektfarger med 30 min cache
  - `useStaffingData()` - Bemanningsdata for periode
  - `useTimeEntryMutation()` - Lagre timeføringer
  - `useDeleteTimeEntry()` - Slette timeføringer
- **Performance Optimalisering**
  - `EditLineNameForm` komponent for å redusere re-renders
  - Smart caching strategier per datatype
  - Background invalidation uten loading states

### 🔧 Changed
- **Admin Navigation Fix** - Integrasjoner-lenken går nå direkte til Tripletex-siden
  - Fra: `/admin/integrasjoner` 
  - Til: `/admin/integrasjoner/tripletex`
  - Oppdatert aktiv-status indikator
- **Data Loading Architecture** - Migrert fra useState/useEffect til React Query
  - `StaffingList.tsx`: 23 linjer data-fetching kode → 1 linje (96% reduksjon)
  - `TimeEntry.tsx`: Migrert til mutation hooks
  - Automatisk error handling og retry logikk

### 🐛 Fixed
- **Database Relationship Errors**
  - Fjernet nested `project_color` joins som manglet foreign keys
  - Opprettet separat `loadProjectColorsOptimized()` funksjon
- **Missing Column Errors**
  - Fjernet `.eq('aktiv', true)` filter fra `ttx_project_cache` og `ttx_activity_cache`
  - Oppdatert alle relevante queries
- **Data Transformation Issues**
  - Korrekt mapping fra `OptimizedStaffingEntry` til `StaffingEntry`
  - Riktig beregning av `totalHours` og `status` fra aktiviteter
  - Lagt til fallback for `project_name`
- **Function Reference Errors**
  - Erstattet `loadStaffingData()` calls med `queryClient.invalidateQueries()`
  - Oppdatert `revalidateInBackground()` og Tripletex callback funksjoner
- **Input Lag Performance**
  - Ekstraherte input fields til separate komponenter
  - Redusert re-rendering av store komponenter ved typing

### 📚 Documentation
- **README.md** - Oppdatert med React Query informasjon og performance gevinster
- **REACT_QUERY_MIGRATION.md** - Detaljert migration guide
- **CHANGELOG.md** - Denne filen for å spore endringer

---

## [2.0.0] - 2025-10-01

### 🚀 Added
- **Node.js 20 Upgrade** - Oppgradert fra v18.20.7 til v20.19.5
- **Security Hardening**
  - JWT verification på alle Edge Functions (`verify_jwt = true`)
  - Authentication middleware i `tripletex-api` Edge Function
  - Error Boundaries (`ErrorBoundary.tsx`)
  - CORS konfigurering for spesifikke domener
- **Database Optimalisering**
  - Optimaliserte queries for å unngå N+1 problemer
  - `QueryCache` klasse for in-memory caching
  - Forbedret foreign key relationships

### 🔧 Changed
- **Next.js 15.5.4** - Oppgradert til nyeste versjon med Turbopack
- **Package Management** - Fjernet 48 ubrukte pakker
- **Engines Specification** - Lagt til Node.js og npm versjonskrav for Vercel

### 🐛 Fixed
- **Critical Database Errors**
  - Fikset `project_color` og `ttx_activity_cache` relationship problemer
  - Løst query ambiguity issues
- **Turbopack Compatibility**
  - Fjernet `isomorphic-dompurify` (erstattet med custom sanitization)
  - Fikset workspace root konfigurering
- **Favicon Conflicts** - Fjernet duplikat favicon filer

### 🗑️ Removed
- **isomorphic-dompurify** - Erstattet med custom `sanitizeHTML` funksjon
- **48 unused packages** - Ryddet opp i dependencies
- **Duplicate files** - Fjernet duplikat favicon og package-lock filer

---

## [1.0.0] - 2025-09-XX

### 🚀 Added
- **Initial Release** - Komplett bemanningsstyringssystem
- **Next.js 15** med App Router og Turbopack
- **Supabase Integration** - Database, Auth, Edge Functions
- **Tripletex API Integration** - Synkronisering av ansatte, prosjekter, aktiviteter
- **Role-based Access Control** - Admin og employee roller
- **Responsive Design** - Tailwind CSS og shadcn/ui komponenter

### 📋 Features
- **Bemanningsliste** - Ukentlig oversikt for administratorer
- **Min Uke** - Personlig timeføring for ansatte
- **Prosjekthåndtering** - Søk, tilordning, og fargekoding
- **Tripletex Sync** - Automatisk synkronisering av data
- **User Management** - Invitere brukere og håndtere roller

---

## 🏷️ Versjonering

- **Major (X.0.0)** - Breaking changes eller store arkitekturendringer
- **Minor (0.X.0)** - Nye features som er bakoverkompatible  
- **Patch (0.0.X)** - Bug fixes og små forbedringer

---

**Vedlikeholdt av:** Kristian Walberg  
**Siste oppdatering:** Oktober 2025
