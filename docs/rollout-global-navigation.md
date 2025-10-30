# Rollout: Ny global navigasjon og søk (sidebar + globalt søk)

## 1. Wireframe – Ny Sidebar-navigasjon og Global Search

```
+--------------------------------------------------------------+
|  FieldNote      |      [ Søk i alt...               ⌘K ]    |
+--------------------------------------------------------------+
                        (brukeren skriver: "Skarnes")

+--------------------------------------------------------------+
| 🔍  Søk i alt: Skarnes                                      |
+--------------------------------------------------------------+
|            |                                        |       |
| Prosjekter |  📁  Skarnes -6 100320 A1     →         |  NYLIG|
|            |  📁  Skarnes - Tverrveien     →         |
|------------------------------------------------------|-------|
| Befaringer |  🏗️  Skarnes / Bad             →        |  I DAG|
|            |  🏗️  Skarnes / Kjøkken         →        |       |
|------------------------------------------------------|-------|
| Oppgaver   |  ✅  Mangler stikk Skarnes     →        |       |
|------------------------------------------------------|-------|
| Bilder     |  🖼️  skarnes_kjøkken_001.jpg   ⇩        |  2025 |
|            |  🖼️  skarnes_bad_002.png       ⇩        |       |
|------------------------------------------------------|-------|
| Brukere    |  👤  Ola Nordmann (Skarnes)    →        |       |
+--------------------------------------------------------------+
| [ Pil-ned/Pil-opp for å navigere | Enter for å åpne | ESC ]  |
+--------------------------------------------------------------+
Sidebar – venstre:
| 🏠 Hjem       |
| 📅 Min uke    |
| 🗂️ Prosjekt   |
| ...           |
| ⚙️ Admin      |
| 🔗 Integrasjoner |
```

---

## 2. MVP/Backlog – Øverst prioritert

- [ ] Opprett Sidebar-komponent (desktop/stor skjerm)
- [ ] Flytt moduler fra toppbar inn i sidebar
- [ ] Minimal topbar: logo, globalt søk-ikon/felt, profil
- [ ] Globalt søk-bokskomponent med typeahead, key nav (Cmd+K, pil/enter)
- [ ] Koble inn enkel “gå til”/“recent” for prosjekter/befaring
- [ ] Feature flag (env eller remote config): AKTIVER ny nav/global search kun ved flag=true
- [ ] Mobiltilpasning (hamburger)
- [ ] Rollebasert redirect/hjemside (admin/leder → prosjekt dashboard, felt → min uke)
- [ ] Dokumenter alt i denne filen (+ i README)
- [ ] Testplan – QA før merge
- [ ] Rollback: flipp feature flag, git revert eller sjekk ut tag (beskrevet under)

---

## 3. Rollback- og Feature Flag-strategi

**Feature flag:**
```js
// I f.eks. src/config.ts
export const FEATURE_GLOBAL_NAV = process.env.NEXT_PUBLIC_FEATURE_GLOBAL_NAV === 'true';
```
Aktiver/deaktiver hele nav via env:
```
NEXT_PUBLIC_FEATURE_GLOBAL_NAV=true
// ...sett til false for å rulle tilbake
```

**Ekspisitt git-tag for backup:**
```
git tag prod-nav-before-global-search $(git rev-parse HEAD)
```
Hvis revert:
```
git checkout prod-nav-before-global-search
```

---

## 4. Hva skjer først
1. Opprett branch:
   ```
   git checkout -b global-nav-and-search
   ```
2. Lag denne rollout-/docs-filen
3. Implementer kun i egen branch, og feature-flag hele veien
4. QA + internreview/demo før merge
5. Ingen grunn til å merge til main før alle flows og rollback er “1-klikks”

---

**STATUS:** (holdes løpende oppdatert her i team-møter og i Slack eller denne Markdown):
- [ ] Branch opprettet
- [ ] Rollout-doc opprettet
- [ ] Komponentarbeid pågår
- [ ] Klar for test/review (skriv dato og ansvarlig)
