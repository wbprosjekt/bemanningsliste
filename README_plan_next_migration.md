# Flytteplan: fra Lovable/Vite til Next.js

## 1. Tekniske forberedelser

- [ ] Avklar miljøvariabler: samle alle `.env`-verdier brukt av Vite-app (Supabase, Tripletex mv.) og bekreft at Next-versjonen bruker samme nøkler.
- [ ] Sjekk Supabase-klienten: sikre at `supabase/client.ts` fungerer både på klient- og serverkomponenter i Next.
- [ ] Opprett `next.config.ts`-regler for bilder, rewriters osv. etter behov.
- [ ] Vurder om vi trenger server-actions/route-handlers for Tripletex/supabase-funksjoner eller om edge-funksjoner holder.

## 2. Migrer resterende sider/flows

- [ ] Admin-seksjoner: `admin/timer`, `admin/underleverandorer`, evt. flere dialoger som ikke er portet.
- [ ] Bruker-facing sider: `Uke`, `MinUke`, `Auth` er allerede portet, men test flows (f.eks. onboarding, simulering).
- [ ] Feil- og 404-håndtering (`not-found.tsx` i Next?).

## 3. UI/State

- [ ] Bekrefte at alle shadcn-komponenter fungerer med App Router (toast, dialog, etc.).
- [ ] Sjekk `RootProviders` for React Query/Tooltip; vurder SSR/cache hvis ønskelig.

## 4. Bygg & Deploy

- [ ] Avgjør ny prosjektstruktur: flytte Next til rot (rename `bemanningsliste-next` -> root) eller oppdatere CI/CD til å peke på undermappe.
- [ ] Oppdater README med nye kommandoer (`npm run dev`, `npm run build`).
- [ ] Konfigurer lint/test i CI (evt. GitHub Actions) til å kjøre `next lint` + builds.
- [ ] Sett opp produksjonsmiljø (Vercel? Supabase?).

## 5. Datakonsistens/testing

- [ ] Kjør regresjonstest av Supabase-funksjoner (innlogging, fetching av tid/ansatte, Tripletex-sync).
- [ ] Verifiser at Next genererer samme API-kall (bruk devtools).
- [ ] Sjekk at `StaffingList` og `DayCard` oppfører seg identisk (drag/drop, toasts osv.).

## 6. Go-live

- [ ] Feature flag: vurder å beholde Lovable-versjonen en kort periode til fallback.
- [ ] Kommuniser endringen til teamet (nye URLer, logging osv.).
- [ ] Monitorer logger etter lansering (Supabase functions, Next logs).


