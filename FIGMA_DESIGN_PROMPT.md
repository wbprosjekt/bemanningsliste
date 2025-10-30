# FieldNote - Figma Design Prompt

## 🎯 PROSJEKT-OVERSIKT

**FieldNote** (tidligere Bemanningsliste) er en moderne SaaS-applikasjon for byggeindustrien som kombinerer:
- **Bemanningsstyring** (timeføring, planlegging, godkjenning)
- **Befaring-modul** (inspeksjoner med plantegninger og oppgaver)
- **Foto-håndtering** (prosjekt-bilder, tagging, organisering)
- **Tripletex-integrasjon** (synkronisering av ansatte, prosjekter, timer)

**Teknologi-stack:**
- Next.js 15 (App Router)
- React 19 + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Database, Auth, Storage, RLS)
- Mobile-first design

---

## 🎨 DESIGN SYSTEM - FIELDNOTE

### **Fargepalett (HSL)**

#### **Primærfarger:**
```css
--color-primary: #2E6375        /* Field Blue - Hovedfarge */
--color-secondary: #E7EAEC      /* Concrete Gray - Bakgrunn */
--color-accent: #66B895         /* Accent Green - CTA */
--color-warning: #F4C84A        /* Warning Amber - Varsler */
--color-error: #D9655D          /* Error Red - Feilmeldinger */
--color-text: #1F2A33           /* Ink Black - Tekst */
--color-bg: #FDFDFD             /* White Smoke - Bakgrunn */
```

#### **shadcn/ui HSL Tokens:**
```css
--primary: 197 42% 31%          /* Field Blue */
--secondary: 210 9% 91%         /* Concrete Gray */
--accent: 153 37% 56%           /* Accent Green */
--destructive: 4 60% 61%        /* Error Red */
--muted: 210 9% 91%             /* Muted Gray */
--border: 210 9% 91%            /* Border Gray */
--background: 0 0% 99.2%        /* Background White */
--foreground: 204 40% 15%       /* Text Dark */
```

### **Typografi:**
```css
--font-sans: "Inter", system-ui, sans-serif
--font-heading: "Poppins", Inter, system-ui, sans-serif
```

### **Border Radius:**
```css
--radius: 0.75rem               /* Standard radius */
--radius-lg: 1rem               /* Large radius */
--radius-md: 0.5rem             /* Medium radius */
--radius-sm: 0.25rem            /* Small radius */
```

### **Spacing System:**
- Mobile-first: `0.25rem` (4px) increments
- Standard gaps: `0.5rem`, `1rem`, `1.5rem`, `2rem`, `3rem`, `4rem`
- Container padding: `1rem` (mobile), `2rem` (desktop)

### **Shadow:**
```css
--shadow-card: 0 2px 12px rgba(0,0,0,.06)
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1)
```

---

## 📱 MOBILE-FIRST DESIGN PRINCIPLES

### **Breakpoints:**
```css
sm: 640px   /* Small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Small desktops */
xl: 1280px  /* Desktops */
2xl: 1400px /* Large desktops */
```

### **Mobile Patterns:**
- **Bottom Sheets:** For dialogs og actions på mobil
- **Hamburger Menu:** For navigation på små skjermer
- **Touch Targets:** Minimum 44x44px for alle klikkbare elementer
- **Safe Area Padding:** `env(safe-area-inset-bottom)` for iPhone notches
- **Horizontal Scrolling:** For tabeller og lange lister på mobil
- **Sticky Headers:** For bedre navigasjon i lange lister

### **Responsive Utilities:**
```css
/* Hide on mobile, show on desktop */
hidden md:flex

/* Show on mobile, hide on desktop */
flex md:hidden

/* Responsive text sizes */
text-sm sm:text-base md:text-lg

/* Responsive padding */
p-4 sm:p-6 md:p-8
```

---

## 🏗️ MODUL-STRUKTUR

### **1. BEMANNINGSMODULEN (Eksisterende)**

#### **Hovedfunksjoner:**
- **Min Uke** (`/min/uke/:year/:week`): Personlig timeføring
- **Bemanningsliste** (`/admin/bemanningsliste`): Admin-oversikt
- **Timer** (`/admin/timer`): Godkjenning av timer
- **Ukevisning** (`/uke/:year/:week`): Les-only for alle

#### **Design-karakteristika:**
- **Dagskort:** Hver dag er et kort med:
  - Dato og ukedag
  - Værikon og temperatur
  - Prosjekt-bobler (farger basert på prosjekt)
  - Timer og overtid
  - Status-badges (Godkjent, Ventende, Avvist)

- **Prosjekt-bobler:** 
  - Fargekodet per prosjekt
  - Viser prosjektnavn og nummer
  - Klikkbar for å legge til tid
  - Viser total tid for dagen

- **Responsive Grid:**
  - Mobil: 1 kolonne
  - Tablet: 2 kolonner
  - Desktop: 3-4 kolonner

#### **Komponenter:**
- `DayCard.tsx` - Dagskort for timeføring
- `StaffingList.tsx` - Bemanningsliste-tabell
- `ProjectBubble.tsx` - Prosjekt-boble
- `WeatherDay.tsx` - Værvisning per dag

---

### **2. BEFARING-MODULEN (Ny - Under Utvikling)**

#### **Hovedfunksjoner:**
- **Befaringer** (`/befaring`): Liste over alle befaringer
- **Befaring Detail** (`/befaring/[id]`): Detaljert visning
- **Plantegning Viewer:** Interaktiv visning av plantegninger
- **Oppgave System:** Oppgaver knyttet til plantegninger

#### **Design-karakteristika:**
- **Befaring Cards:**
  - Tittel og adresse
  - Status-badge (Planlagt, Pågående, Ferdig)
  - Dato og prosjekt
  - Antall oppgaver
  - Klikkbar for å åpne detaljer

- **Plantegning Viewer:**
  - Full-screen modal
  - Zoom, pan, rotate controls
  - Oppgave-markører (fargekodet per status)
  - Bottom sheet på mobil (kompakt)
  - Desktop: Sidebar med oppgaver

- **Oppgave Markører:**
  - Fargekodet: Rød (Åpen), Gul (Pågående), Grønn (Ferdig)
  - Klikkbar for å åpne oppgave-detaljer
  - Normaliserte koordinater (0-1) for zoom-uavhengig plassering

#### **Komponenter:**
- `BefaringList.tsx` - Liste over befaringer
- `BefaringDetail.tsx` - Detaljert visning
- `PlantegningViewer.tsx` - Interaktiv plantegning
- `InteractivePlantegning.tsx` - Plantegning med oppgaver
- `OppgaveDialog.tsx` - Dialog for oppgaver
- `OppgaveForm.tsx` - Form for oppgaver
- `PlantegningUpload.tsx` - Upload av plantegninger

#### **Mobile Optimizations:**
- Kompakt bottom sheet med ikoner
- Sticky footer i oppgave-dialoger
- Safe-area padding for iPhone
- Responsive header (stacks på mobil)
- Touch-friendly controls

---

### **3. FOTO-MANAGEMENT SYSTEM (Planlagt)**

#### **3-Lag Arkitektur:**

**LAG 1: DASHBOARD**
- KPI Cards (Aktive prosjekter, Utaggede bilder, Åpne oppgaver)
- Photo Inbox Quick Access
- Aktive Prosjekter (drag & drop for tagging)
- "Requires Action" notifications

**LAG 2: PHOTO INBOX**
- Grid-visning av alle utaggede bilder
- Filtrering per prosjekt
- Drag & drop til prosjekter
- Bulk tagging
- Image viewer modal

**LAG 3: PROSJEKT FOTO-BIBLIOTEK**
- Alle bilder for et prosjekt
- Kategorisering og folders
- Knytt til befaringer/oppgaver
- Kommentarer og metadata
- Timeline-visning

#### **Komponenter:**
- `ProjectPhotoUpload.tsx` - Upload med/uten prosjekt
- `PhotoInbox.tsx` - Visning av utaggede bilder
- `ProjectPhotoLibrary.tsx` - Prosjekt-bibliotek
- `PhotoViewer.tsx` - Full-screen image viewer
- `TagPhotoDialog.tsx` - Tagging av bilder

#### **Features:**
- Drag & drop upload
- Bulk upload (multiple images)
- Image compression (5MB limit)
- Kommentar-felt for utaggede bilder
- Role-based access (alle kan uploade, kun admin/manager kan tagge)
- Real-time notifications

---

## 🧩 KOMPONENT-BIBLIOTEK (shadcn/ui)

### **Brukte Komponenter:**
- `Button` - Alle knapper
- `Card` - Kort for innhold
- `Dialog` - Modals og popups
- `Badge` - Status-badges
- `Input` - Tekstfelt
- `Select` - Dropdowns
- `Textarea` - Flere linjer tekst
- `Label` - Form labels
- `Toast` - Notifikasjoner
- `Tabs` - Tabs for organisering
- `Accordion` - Ekspanderbar innhold
- `Dropdown Menu` - Kontekstmenyer
- `Sheet` - Sidebar og bottom sheets

### **Custom Komponenter:**
- `DayCard` - Dagskort for timeføring
- `ProjectBubble` - Prosjekt-boble
- `WeatherDay` - Værvisning
- `PlantegningViewer` - Plantegning viewer
- `InteractivePlantegning` - Interaktiv plantegning
- `ProjectPhotoUpload` - Foto upload

---

## 📐 LAYOUT PATTERNS

### **Navigation:**
- **Desktop:** Horizontal menu med logo, links, og bruker-menu
- **Mobile:** Hamburger menu (slide-in drawer)
- **Icons:** Lucide React (konsistent icon-bibliotek)

### **Page Layout:**
```typescript
<Container>
  <Header>
    <Title />
    <Actions />
  </Header>
  
  <Content>
    <MainContent />
    <Sidebar /> {/* Optional */}
  </Content>
  
  <Footer /> {/* Optional */}
</Container>
```

### **Card Layout:**
```typescript
<Card>
  <CardHeader>
    <CardTitle />
    <CardDescription />
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    {/* Actions */}
  </CardFooter>
</Card>
```

---

## 🎯 DESIGN TOKENS FOR FIGMA

### **Farger (HSL):**
```
Primary:     hsl(197, 42%, 31%)    #2E6375
Secondary:   hsl(210, 9%, 91%)     #E7EAEC
Accent:      hsl(153, 37%, 56%)    #66B895
Warning:     hsl(44, 89%, 64%)     #F4C84A
Error:       hsl(4, 60%, 61%)      #D9655D
Text:        hsl(204, 40%, 15%)    #1F2A33
Background:  hsl(0, 0%, 99.2%)     #FDFDFD
```

### **Spacing Scale:**
```
0.25rem = 4px
0.5rem  = 8px
0.75rem = 12px
1rem    = 16px
1.5rem  = 24px
2rem    = 32px
3rem    = 48px
4rem    = 64px
```

### **Border Radius:**
```
sm:  0.25rem = 4px
md:  0.5rem  = 8px
lg:  0.75rem = 12px
xl:  1rem    = 16px
2xl: 1.5rem  = 24px
```

### **Shadow:**
```
card: 0 2px 12px rgba(0,0,0,.06)
lg:   0 10px 15px -3px rgba(0, 0, 0, 0.1)
```

---

## 📱 MOBILE-SPESIFIKK DESIGN

### **Bottom Sheet (Mobil):**
```typescript
<div className="fixed bottom-0 left-0 right-0 bg-background border-t p-2 z-[60] shadow-lg">
  <div className="flex items-center justify-center gap-1">
    {/* Compact icons */}
  </div>
</div>
```

### **Dialog (Mobil):**
```typescript
<DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
  <DialogHeader className="flex-shrink-0">
    {/* Header */}
  </DialogHeader>
  <form className="space-y-4 flex-1 overflow-y-auto">
    {/* Scrollable content */}
  </form>
  <DialogFooter className="sticky bottom-0 bg-background border-t">
    {/* Actions */}
  </DialogFooter>
</DialogContent>
```

### **Safe Area Padding:**
```css
padding-bottom: max(1rem, env(safe-area-inset-bottom))
```

---

## 🎨 VISUAL HIERARCHY

### **Typography Scale:**
```
text-xs:  0.75rem = 12px  /* Small labels */
text-sm:  0.875rem = 14px /* Body text */
text-base: 1rem = 16px    /* Default */
text-lg:  1.125rem = 18px /* Headings */
text-xl:  1.25rem = 20px  /* Large headings */
text-2xl: 1.5rem = 24px   /* Page titles */
text-3xl: 1.875rem = 30px /* Hero text */
```

### **Font Weights:**
```
font-normal: 400
font-medium: 500
font-semibold: 600
font-bold: 700
```

### **Line Heights:**
```
leading-tight: 1.25
leading-normal: 1.5
leading-relaxed: 1.625
```

---

## 🚀 NESTE STEG FOR FIGMA

### **1. Opprett Design System:**
- Sett opp fargepalett (HSL)
- Definer typografi (Inter + Poppins)
- Lag spacing scale
- Opprett komponenter (Button, Card, Dialog, etc.)

### **2. Lag Mockups:**
- **Dashboard:** KPI Cards, Photo Inbox Quick Access
- **Photo Inbox:** Grid-visning, Image Viewer
- **Project Photo Library:** Timeline, Kategorisering
- **Befaring Detail:** Plantegning Viewer, Oppgave List
- **Mobile Views:** Bottom Sheets, Hamburger Menu

### **3. Design Patterns:**
- Upload Flow (med/uten prosjekt)
- Tagging Flow (drag & drop)
- Notification System (bell icon, badge)
- Search & Filter

### **4. Prototyping:**
- Interaktive flows
- Mobile interactions
- Drag & drop animations
- Loading states

---

## 📝 VIKTIGE DESIGN-PRINSIPPER

1. **Mobile-First:** Design for mobil først, deretter desktop
2. **Touch-Friendly:** Minimum 44x44px touch targets
3. **Klar Hierarki:** Tydelig visuell hierarki med typografi og farger
4. **Konsistent Spacing:** Bruk spacing scale konsekvent
5. **Accessibility:** Kontrast-ratio 4.5:1 minimum
6. **Loading States:** Vis loading states for alle async operations
7. **Error Handling:** Tydelige feilmeldinger og recovery
8. **Empty States:** Hjelpsomme empty states med CTAs

---

## 🔗 RELEVANTE FILER

### **Design System:**
- `src/app/globals.css` - Design tokens
- `tailwind.config.ts` - Tailwind config

### **Komponenter:**
- `src/components/` - Alle React-komponenter
- `src/app/` - App Router sider

### **Dokumentasjon:**
- `README.md` - Prosjekt-oversikt
- `PROJEKT_INNBOKS_INTEGRATION_PLAN.md` - Photo management plan
- `PHOTO_MANAGEMENT_SYSTEM.md` - Komplett photo system
- `FIELDNOTE_DASHBOARD_PLAN.md` - Dashboard plan

---

## 💡 INSPIRASJON

**Design-stil:** Moderne, clean, profesjonell
**Inspirasjon:** Linear, Notion, Figma selv
**Target Audience:** Byggeindustri (feltarbeidere, prosjektledere, admins)

**Key Principles:**
- Enkel og intuitiv
- Rask og responsiv
- Mobile-optimeret
- Visuelt tiltalende
- Profesjonelt og pålitelig

---

**Lykke til med designet! 🎨**

Ved spørsmål, se på eksisterende komponenter i `src/components/` eller kontakt meg.













