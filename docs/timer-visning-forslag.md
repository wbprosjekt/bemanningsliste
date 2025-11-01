# Forslag: Forbedret visning av timer med overtid

## Problem
Nåværende visning er rotete:
```
15,00
8,00 ⚡50: 6,00 ⚡50: 1,00 ⚡⚡100: 1,00
```

## Forslag: Strukturert vertikal layout

### Alternativ A: Kompakt liste (anbefalt for tabell)
```
15,00 t
  Normal: 8,00
  ⚡50: 7,00
  ⚡⚡100: 1,00
```

### Alternativ B: Med totaler
```
15,00 t totalt
  • 8,00 normal
  • 7,00 overtid (⚡50: 6,00 + 1,00)
  • 1,00 overtid (⚡⚡100: 1,00)
```

### Alternativ C: Minimalistisk (hvis kun overtid)
```
15,00 t
  ⚡50: 7,00 | ⚡⚡100: 1,00
```

### Alternativ D: Badges (visuelt)
```
15,00 t
[8,00 Normal] [⚡50: 7,00] [⚡⚡100: 1,00]
```

## Anbefaling
**Alternativ A** er best for tabellvisning:
- Klar struktur
- Lett å lese
- Tar lite plass
- God oversikt

Viser total på toppen, deretter hver timetype på egen linje.

