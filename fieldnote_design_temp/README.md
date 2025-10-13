# FieldNote Design Pack

Dette er en ferdig pakke for rask integrasjon i din app (Next.js/Tailwind). Inneholder logoer, PWA-ikoner, tema (CSS-variabler) og eksempler på UI-komponenter.

## Innhold
- `brand/`
  - logo-fieldnote-master.png (original)
  - logo-fieldnote-2048.png, 1024, 512, 256, 128, 64
- `public/`
  - `favicon.ico`
  - `icons/icon-192.png`, `icons/icon-512.png`
  - `manifest.json`
- `theme/`
  - `theme.css`
  - `tailwind.config.js`
- `components/`
  - `Button.tsx`
  - `Badge.tsx`

## Bruk
1. **Kopier filer** inn i prosjektet ditt:
   - `public/` → prosjektets `public/`
   - `theme/theme.css` → importer i `pages/_app.tsx` eller `app/globals.css`
   - `theme/tailwind.config.js` → slå sammen med din `tailwind.config.js` (eller erstatt)
   - `components/` → bruk der du ønsker

2. **Installer fonter** i `index.html`/_document.tsx:
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@500;600&display=swap" rel="stylesheet" />

3. **Tailwind**:
- Legg til `import "@/theme/theme.css";` i global CSS/entry.
- Sørg for at `content`-glob matcher dine mapper.

4. **Eksempel**:
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";

export default function Example() { 
  return (
    <div className="p-8">
      <h1 className="font-heading text-3xl mb-4">FieldNote</h1>
      <div className="space-x-2">
        <Button variant="primary">Primær</Button>
        <Button variant="secondary">Sekundær</Button>
        <Button variant="ghost">Ghost</Button>
      </div>
      <div className="mt-4 space-x-2">
        <Badge tone="success">Fullført</Badge>
        <Badge tone="warning">Pågår</Badge>
        <Badge tone="error">Avvik</Badge>
        <Badge>Neutral</Badge>
      </div>
    </div>
  );
}

## Tips
- Bruk `data-theme="dark"` på `<html>` for mørk modus-variabler.
- Opprett eget subdomene for bilder (CDN) hvis du trenger ekstra ytelse.
- Ved behov, legg inn ditt eget domenenavn i `manifest.json` og legg til PWA offline-cache.

— FieldNote Design System