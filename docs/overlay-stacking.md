# Overlay & Portal-Stacking Policy for FieldNote

> Denne dokumentasjonen gjelder for **hele FieldNote** og beskriver hvordan overlays, dialoger, dropdowns, popovers, menuer og side-sheets skal stackes, styles og mountes – for å sikre konsistent og robust opplevelse på tvers av moduler/teams.

## Hvorfor?
- Forhindre overlays som havner “bak” dialog/backdrop/sheets, og sikre at modale flyter alltid oppfører seg korrekt – både frontend og tilgjengelighetsmessig.
- Sikrer forutsigbarhet for utviklere: Ett sted å endre stacking! Mindre bugs og enklere test/vedlikehold.

## Hovedprinsipper
- **Alle overlays** (Select, Popover, Dialog, Sheet, Menu etc) skal bruke prosjektets egne UI-primitives fra `src/components/ui/`. Bygg ALDRI egendefinerte stacking-regler pr komponent!
- **Alle overlays skal montere til `<body>` via Portal** – ikke som child av dialog/panel e.l.
- **z-index skal alltid følge denne globale prioriteten:**

| Overlay-type            | z-index       |
|:----------------------- |:------------:|
| Sheet (sidepanel/ark)   |   300        |
| Select (dropdowns)      |   200        |
| Popover, Datepicker     |   110        |
| DialogContent           |   101        |
| DialogOverlay           |   100        |

- **Ingen overlays skal settes lavere enn sine overlay-søsken.**
- Ikke overstyr stacking med custom inline style hvis mulig – bidra heller til primitives og/eller informer teamet.

## Kode-eksempler (primitives)

```tsx
// Eksempel: SelectContent
<SelectContent className="relative z-[200] ...">
  ...
</SelectContent>

// Eksempel: PopoverContent
<PopoverContent className="z-[110] ...">
  ...
</PopoverContent>

// Eksempel: DialogContent fra UI-primitive
<DialogContent className="z-[101] ...">
  ...
</DialogContent>

// Eksempel: Sheet/sidepanel
<SheetContent className="z-[300] ...">
  ...
</SheetContent>
```

## Migrering/tips
- Gå gjennom gamle overlays (og gamle egne menuer/popovers) og bytt til de standardiserte komponentene.
- Hvis du lager ny modal/overlay, bruk alltid våre primitives – eller bidra med forbedring der det mangler!
- Test alltid stacking og overlappende flows: Nested dialog + dropdown + sheet + datepicker etc.
- Spør eller informer teamet om du må overstyre stacking – det bør alltid skje via primitive eller i policy!

## Oppsummering
- Denne policy gjelder **alt** i FieldNote og SKAL følges – det gjør at alle overlays fungerer på tvers av moduler, for mobil og desktop, og for alle UI-brukere og designere.

---
For spørsmål, ta kontakt med frontendansvarlig eller felt-teamet. Endringer i policy tas opp i felles slack-kanal.
