
# FieldNote Brand Assets v2

Separate logoer (transparent) i PNG + SVG.

## Filer
- **logo-fieldnote-main-transparent.png** – hovedlogo for lys bakgrunn
- **logo-fieldnote-white.png** – bruk på mørk bakgrunn (dark mode)
- **logo-fieldnote-black.png** – bruk på lys bakgrunn/utskrift
- **logo-fieldnote-icon.png** – ikon merke (kun symbol)
- **logo-fieldnote.svg** – vektorfil for perfekt skalering

## Farger (Tailwind tokens)
```js
// tailwind.config.js (excerpt)
extend: {{
  colors: {{
    primary: "var(--color-primary)",    // #2E6375
    accent: "var(--color-accent)",      // #66B895
    text: "var(--color-text)",
  }},
}}
```

## CSS-variabler
```css
:root {{
  --color-primary: #2E6375;
  --color-accent: #66B895;
  --color-text: #1F2A33;
}}
```

## Bruk i Next.js
```tsx
import Image from "next/image";
import logo from "@/brand/logo-fieldnote-main-transparent.png";

export function Header() {{
  return (
    <header className="bg-white px-6 py-3 flex items-center gap-3">
      <Image src={logo} alt="FieldNote" width={{160}} height={{40}} priority />
    </header>
  );
}}
```

## Lys/mørk auto
```tsx
export function Logo() {{
  return (
    <picture>
      <source srcSet="/brand/logo-fieldnote-white.png" media="(prefers-color-scheme: dark)" />
      <img src="/brand/logo-fieldnote-main-transparent.png" alt="FieldNote" width="160" height="40" />
    </picture>
  );
}}
```

— FieldNote Design System
