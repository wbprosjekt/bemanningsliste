# V0 Design Prompt - Modules (Befaringer, Oppgaver, Bilder)

## 🎯 PROMPT FOR V0:

```
Create module pages for FieldNote - a Norwegian construction project management app.

## CONTEXT:
- These are LAG 3 of the dashboard (clicking on module tabs from project detail)
- Each module shows a list of items for a specific project
- Users need to quickly view, filter, and manage items
- Mobile-first design is essential

## DESIGN REQUIREMENTS:

### 1. TOP SECTION - MODULE HEADER
- Back button: "← Tilbake"
- Breadcrumb: "Haugesund Bygg #1234 > 📋 Befaringer"
- Search input: "Søk befaringer..."
- Filter dropdown: "Filter: Alle ▾"
- Sort dropdown: "Sorter: Dato ▾"
- Action button: "[+ Ny befaring]"
- Responsive: Stack on mobile, horizontal on desktop

### 2. MODULE LIST - ITEM CARDS
- Header: "BEFARINGER (8)" or "OPPGAVER (15)" or "BILDER (45)"
- Each item card shows:
  - Title: "Befaring #5 - VVS Kontroll" or "Oppgave #12 - Lekkasje" or thumbnail
  - Date: "Dato: 15.10.2025"
  - Status: "Status: Fullført" (with color badge)
  - Metadata: "📋 12 oppgaver | 📷 25 bilder | 👤 Lars Hansen"
  - Priority: "🔴 3 kritiske oppgaver" or "🟡 2 viktige oppgaver"
  - Action button: "[Åpne →]" or "[Se detaljer →]"
- Responsive: 1 column on mobile, 2-3 on desktop

### 3. PAGINATION
- "Vis flere..." button at bottom
- Or numbered pagination: "[1] [2] [3] ... [10]"
- Show total count: "Viser 1-10 av 45"

## TECHNICAL REQUIREMENTS:

### Stack:
- Next.js 15 with App Router
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Lucide React icons

### Components to use:
- Card, CardHeader, CardContent, CardTitle, CardDescription
- Button (with variants: default, outline, ghost, destructive)
- Badge (with variants: default, secondary, destructive, success)
- Input, Select
- Avatar, AvatarFallback
- Separator
- Dropdown Menu

### Responsive breakpoints:
- Mobile: < 640px (1 column)
- Tablet: 640px - 1024px (2 columns)
- Desktop: > 1024px (3 columns)

### Color scheme:
- Primary: Blue (#3b82f6)
- Success: Green (#10b981)
- Warning: Orange (#f97316)
- Danger: Red (#ef4444)
- Background: White/light gray
- Text: Dark gray (#1f2937)

### Status colors:
- Fullført: Green (#10b981)
- Pågående: Blue (#3b82f6)
- Pending: Orange (#f97316)
- Kansellert: Gray (#6b7280)

## NORWEGIAN LANGUAGE:
All text should be in Norwegian:
- "Tilbake" (Back)
- "Søk" (Search)
- "Filter" (Filter)
- "Sorter" (Sort)
- "Ny befaring" (New inspection)
- "Ny oppgave" (New task)
- "Last opp bilder" (Upload photos)
- "Åpne" (Open)
- "Se detaljer" (See details)
- "Dato" (Date)
- "Status" (Status)
- "Fullført" (Completed)
- "Pågående" (In progress)
- "Pending" (Pending)
- "Kansellert" (Cancelled)
- "Vis flere" (See more)
- "Viser X-Y av Z" (Showing X-Y of Z)

## ACCESSIBILITY:
- Use semantic HTML
- Proper heading hierarchy
- ARIA labels for buttons
- Keyboard navigation support
- Focus states visible

## MOBILE OPTIMIZATION:
- Touch-friendly buttons (min 44x44px)
- Large enough text (min 16px)
- Safe area padding for notched devices
- Sticky header on scroll
- Image thumbnails for photo module

## OUTPUT FORMAT:
Please provide:
1. Complete Next.js component code
2. TypeScript interfaces for data structures
3. Responsive design that works on all screen sizes
4. Clean, maintainable code with comments
5. Proper error handling
6. Loading states

## NOTES:
- Keep it clean and organized
- Use consistent card design across all modules
- Make it easy to scan and find items
- Group related information together
```

---

## 📋 ALTERNATIVE SHORTER PROMPT:

```
Create a Norwegian module page for construction management with:

1. Header: Back button, breadcrumb, search, filter, sort, action button
2. Module title with count: "BEFARINGER (8)"
3. Item cards showing:
   - Title, date, status badge
   - Metadata (counts, assignee)
   - Priority indicators
   - Action button
4. Pagination at bottom

Tech: Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui
Style: Clean, organized, mobile-first
Language: Norwegian
Colors: Blue primary, status colors (green/blue/orange/red)

Make it responsive, accessible, and touch-friendly.
```

---

## 🎨 TIPS FOR V0:

1. **Start med den korte prompten** - Se hva v0 genererer
2. **Iterer basert på resultatet** - Gi tilbakemelding
3. **Be om spesifikke endringer** - "Make the cards more compact"
4. **Test på mobil** - "Show me the mobile version"

---

**Kopier prompten over og lim den inn i v0!** 🚀

