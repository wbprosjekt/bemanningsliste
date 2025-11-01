# CODEX Prompt: Bemanningsliste - Sentrere inneværende uke i visningen

## Problem/Bakgrunn

På `/admin/bemanningsliste/[year]/[week]` vises 6 uker fremover fra den valgte uken. Når brukere går inn på siden (uten å spesifisere år/uke), vises inneværende uke som den første uken, og deretter 5 uker fremover.

**Nåværende oppførsel:**
- Uke 1: Inneværende uke
- Uke 2-6: De neste 5 ukene
- Total: 6 uker (alle fremover)

## Foreslått løsning

Brukeren ønsker at **inneværende uke skal vises som uke #4 av 7 totalt**, med følgende layout:

**Ny oppførsel:**
- Uke 1-3: 3 uker FØR inneværende uke
- Uke 4: Inneværende uke (senter)
- Uke 5-7: 3 uker ETTER inneværende uke
- Total: 7 uker (3 før + nåværende + 3 etter)

## Nåværende kode-struktur

### 1. Route handler (`src/app/admin/bemanningsliste/[year]/[week]/page.tsx`):
```typescript
export default function BemanningslisteWeekPage() {
  const params = useParams<{ year: string; week: string }>();
  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultWeek = getWeekNumber(now);
  
  const currentYear = Number.isNaN(parsedYear) ? defaultYear : parsedYear;
  const currentWeek = Number.isNaN(parsedWeek) ? defaultWeek : parsedWeek;
  
  // Viser 6 uker fremover
  <StaffingList startWeek={currentWeek} startYear={currentYear} weeksToShow={6} />
}
```

### 2. StaffingList komponent (`src/components/StaffingList.tsx`):
```typescript
const StaffingList = ({ startWeek, startYear, weeksToShow = 6 }: StaffingListProps) => {
  // Genererer ukene fra startWeek og fremover
  const getMultipleWeeksData = useCallback((): WeekData[] => {
    const weeks: WeekData[] = [];
    let currentWeek = safeStartWeek;
    let currentYear = safeStartYear;
    
    for (let i = 0; i < weeksToShow; i++) {
      // Genererer uke-data for currentWeek/currentYear
      // ...
      weeks.push({ week: currentWeek, year: currentYear, dates });
      
      // Går til neste uke
      currentWeek++;
      // Håndterer årsskifte...
    }
    
    return weeks;
  }, [safeStartWeek, safeStartYear, weeksToShow]);
}
```

## Spørsmål til CODEX

1. **Design-vurdering:**
   - Er dette en god UX-forbedring?
   - Finnes det noen potensielle problemer med denne tilnærmingen?
   - Bør vi ha en alternativ løsning (f.eks. virtuell scrolling, "infinite scroll")?

2. **Implementering:**
   - Er den foreslåtte tilnærmingen (endre `startWeek - 3`, øke til 7 uker) den beste løsningen?
   - Hvordan bør vi håndtere årsskifte (hvis uke -3, -2, -1 faller i forrige år)?
   - Bør `startWeek` i props endres til `centerWeek` for klarhet, eller beholde `startWeek` men justere intern logikk?

3. **Ytelse:**
   - Vil 7 uker i stedet for 6 ha betydelig ytelses-påvirkning?
   - Bør vi vurdere lazy loading eller virtualisering?

4. **Navigasjon:**
   - Hvordan bør "Forrige 6 uker" / "Neste 6 uker" knappene fungere med den nye layouten?
   - Bør vi endre disse til å scrolle 3 eller 7 uker?

5. **Edge cases:**
   - Hva skjer hvis brukeren går inn på uke 1 eller 2 (kan ikke gå 3 uker tilbake)?
   - Hva skjer ved årsskifte (uke 52/53 → uke 1)?
   - Bør vi alltid vise 7 uker, eller dynamisk justere (f.eks. vise 3 før hvis mulig, ellers starte fra uke 1)?

## Eksempler på bruk

**Scenario 1: Inneværende uke er uke 15, 2025**
- Skal vise: Uke 12, 13, 14, **15**, 16, 17, 18 (alle i 2025)

**Scenario 2: Inneværende uke er uke 2, 2025**
- Skal vise: Uke 52 (2024), 53 (2024), 1 (2025), **2**, 3, 4, 5 (alle i 2025)
- **Problem:** Må håndtere at uke 1-3 kommer fra forrige år

**Scenario 3: Inneværende uke er uke 1, 2025**
- Skal vise: Uke 50, 51, 52 (2024), **1**, 2, 3, 4 (2025)
- **Problem:** Må håndtere at uke 50-52 kommer fra forrige år

## Vårt forslag

1. Endre `weeksToShow` fra 6 til 7
2. Modifisere `getMultipleWeeksData` til å starte fra `startWeek - 3` i stedet for `startWeek`
3. Legge til robust håndtering av årsskifte (bakover og fremover)
4. Eventuelt endre navn fra `startWeek` til `centerWeek` for klarhet
5. Oppdatere navigasjonsknappene til å flytte "center week" med 3 eller 7 uker

**Venter på CODEX sin vurdering før implementering.**

