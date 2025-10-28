# Refusjon hjemmelading - Neste Steg

## 🔴 HIGH PRIORITY - Missing Features

### 1. Automatisk prishenting (TREBES VISST)

**Problem**: Ingen automatisk mekanisme for å hente daglige spotpriser.

**Løsning A: Edge Function Cron Job** (Anbefalt)
- Opprett `supabase/functions/fetch-spot-prices/index.ts`
- Kjør daglig kl. 13:00 (når morgendagens priser publiseres)
- Hent alle 5 soner (NO1-NO5)
- Lagre i `ref_energy_prices`
- Send e-post ved feil

**Løsning B: Admin UI (Midlertidig)**
- Knapp i settings: "Hent priser for i går → i morgen"
- Trigger `/api/admin/refusjon/priser/backfill`

**Feilhåndtering**:
- Hvis API-kall feiler → send e-post til admins
- Logg alle feil i `email_logs` eller ny `ref_price_fetch_logs` tabell

### 2. Strømsone konfigurasjon

**Hvor settes strømsone i dag**: Ingensteds! Hardkodet til NO1.

**Løsning**: Legg til i Employee Settings
- `src/app/refusjon/settings/page.tsx`: Legg til strømsone-dropdown per ansatt
- Lagre i `ref_employee_settings.price_area` eller `person`-tabellen
- Åpne `/refusjon/settings` → Velg ansatt → Sett strømsone (NO1–NO5)

### 3. Nettleie-konfigurasjon

**Status i dag**: Implementert, men ikke konfigurert.

**Hva mangler**:
1. **Nettprofil-settup** i `ref_nett_profiles`:
   - Opprett profiler for ulike nettleverandører
   - Eks: "Hafslund standard", "Lyse TOU", etc.

2. **TOU-vinduer** i `ref_nett_windows`:
   - Dag (07:00-17:00)
   - Kveld (17:00-22:00)
   - Natt (22:00-07:00)
   - Helg
   - Med energi-komponent og tid-komponent priser

3. **UI for konfigurasjon**:
   - `/refusjon/settings` → "Nettprofiler" tab (allerede skapt, men disabled)
   - Legg til: Opprett profil, legg til vinduer, legg til priser

4. **Koble til ansatt**:
   - I employee settings, velg hvilken nettprofil ansatt har
   - Autoload nettleie-priser basert på TOU-vindu

## 📋 IMPLEMENTERINGSPLAN

### Steg 1: Strømsone (1-2 timer)
```typescript
// src/app/refusjon/settings/page.tsx
// Legg til Select dropdown:
<Select value={employeePriceArea} onValueChange={setEmployeePriceArea}>
  <SelectItem value="NO1">NO1 (Oslo øst)</SelectItem>
  <SelectItem value="NO2">NO2 (Kristiansand)</SelectItem>
  <SelectItem value="NO3">NO3 (Trondheim)</SelectItem>
  <SelectItem value="NO4">NO4 (Tromsø)</SelectItem>
  <SelectItem value="NO5">NO5">NO5 (Bergen)</SelectItem>
</Select>

// Lagre i person-tabellen eller ref_employee_settings
```

### Steg 2: Cron Job for Priser (3-4 timer)
```typescript
// supabase/functions/fetch-spot-prices/index.ts

Deno.serve(async (req) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  for (const area of ['NO1', 'NO2', 'NO3', 'NO4', 'NO5']) {
    try {
      // Fetch yesterday's actual prices
      await fetchAndStorePrices(area, yesterday, yesterday);
      
      // Fetch tomorrow's forecast (published at 13:00)
      if (new Date().getHours() >= 13) {
        await fetchAndStorePrices(area, tomorrow, tomorrow);
      }
    } catch (err) {
      // Send email alert to admins
      await sendErrorEmail(area, err);
    }
  }
  
  return new Response(JSON.stringify({ success: true }));
});
```

### Steg 3: Nettprofil UI (2-3 timer)
- Unhide "Nettprofiler" tab
- Add form for:
  - Profile name, version
  - TOU windows (time ranges)
  - Prices (energy + time components)
  - Link to employee

### Steg 4: Test Full Workflow (2 timer)
- Last opp priser manuelt for testperiode
- Opprett nettprofil med TOU-vinduer
- Koble nettprofil til ansatt
- Last opp CSV
- Sjekk at nettleie er beregnet riktig

## 🎯 QUICK WINS (1 time each)

1. **Legg til strømsone-dropdown** i settings (5 min)
2. **Test-knapp i settings** for å hente priser for en dato (15 min)
3. **Email alerts** hvis priser mangler når analysering (15 min)
4. **Fix error i analyser** som gir 0 kWh (debugging - 30 min)

## 📊 CURRENT STATUS BY FEATURE

| Feature | Status | Missing |
|---------|--------|---------|
| Database Schema | ✅ 100% | - |
| CSV Parsing | ✅ 100% | - |
| Employee Settings | ⚠️ 50% | Strømsone config |
| RFID Management | ✅ 100% | - |
| Charger Setup | ✅ 100% | - |
| Spot Price API | ✅ 100% | Auto-fetch cron |
| Nettleie TOU | ⚠️ 30% | UI + config |
| Pricing Calculation | ✅ 90% | Missing nettleie data |
| PDF Generation | ⚠️ 50% | Not tested |
| Admin UI | ⚠️ 70% | Price fetch UI |

## 💡 RECOMMENDED NEXT SESSION PRIORITIES

1. **Test full workflow** - Debug 0 kWh issue
2. **Strømsone dropdown** - Quick win, 5 min
3. **Manuell prishenting UI** - Allow testing
4. **Cron job** - Production-ready automation


