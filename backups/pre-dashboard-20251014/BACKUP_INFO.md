# Backup før Dashboard-implementering

**Dato:** 14. oktober 2025, kl 13:20  
**Branch:** feature/befaring-module  
**Commit:** 65455bb

## Hva er backed up:

### 1. Kode
- ✅ `src/components/befaring/` (alle 12 komponenter)
- ✅ `supabase/migrations/` (alle 37 migrasjoner)

### 2. Git commits
- ✅ Commit 7d024d7: "docs: Add complete dashboard implementation plans"
- ✅ Commit 65455bb: "chore: Create pre-dashboard backup"

### 3. Planer
- ✅ `FIELDNOTE_DASHBOARD_PLAN.md` (komplett design + features)
- ✅ `IMPLEMENTATION_PLAN_FINAL.md` (4-dagers implementeringsplan)

---

## Hva skal endres:

### Database-endringer:
1. **Normaliserte koordinater** (oppgaver, plantegninger)
2. **Presigned URLs** (oppgave_bilder)
3. **Audit log** (ny tabell)
4. **Dashboard-tabeller** (favorites, activity, preferences)

### Kode-endringer:
1. **InteractivePlantegning.tsx** (bruk normaliserte coords)
2. **PlantegningViewer.tsx** (render normaliserte coords)
3. **OppgaveImageUpload.tsx** (presigned URLs)
4. **ProjectDashboard.tsx** (nye features)

---

## Hvordan rulle tilbake:

### Hvis noe går galt:

**1. Rulle tilbake kode:**
```bash
# Gå tilbake til denne commiten
git checkout 65455bb

# Eller kopier filer fra backup
cp -r backups/pre-dashboard-20251014/befaring/* src/components/befaring/
```

**2. Rulle tilbake database:**
```bash
# Kjør migrasjoner i revers (hvis Supabase støtter)
# ELLER drop tabeller manuelt
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS project_favorites;
DROP TABLE IF EXISTS project_activity;
DROP TABLE IF EXISTS user_preferences;

# Fjern nye kolonner
ALTER TABLE oppgaver DROP COLUMN IF EXISTS x_normalized;
ALTER TABLE oppgaver DROP COLUMN IF EXISTS y_normalized;
```

**3. Verifiser:**
```bash
# Sjekk at befaring-modul fungerer
# Test at zoom/pan fungerer (skal bruke pixel-coords)
# Test at bilde-opplasting fungerer
```

---

## Backup-metadata:

**Filstørrelse:**
- befaring/: 12 filer
- migrations/: 37 filer
- Total: ~500KB

**Verifisert:** ✅ Alle filer kopiert korrekt

**Sikkerhetskopi lokasjon:**
- Git: Commit 65455bb
- Disk: `backups/pre-dashboard-20251014/`

