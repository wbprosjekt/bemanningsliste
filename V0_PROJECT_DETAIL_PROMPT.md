# V0 Design Prompt - Project Detail Page

## 🎯 PROMPT FOR V0:

```
Create a modern project detail page for FieldNote - a Norwegian construction project management app.

## CONTEXT:
- This is LAG 2 of the dashboard (clicking "Se detaljer" from project list)
- Shows detailed information for ONE specific project
- Users need quick access to all project modules and data
- Mobile-first design is essential

## DESIGN REQUIREMENTS:

### 1. TOP SECTION - PROJECT HEADER
- Back button: "← Tilbake til Dashboard"
- Project name and number: "Haugesund Bygg #1234"
- Favorite button (⭐) and settings button (⚙️)
- Project info: "Kunde: Haugesund Kommune | Status: Aktiv | Sist oppdatert: 2t siden"
- Responsive: Stack on mobile, horizontal on desktop

### 2. REQUIRES ACTION - PROJECT ALERTS
- Red alert card showing critical items for THIS project only
- Examples: "🔴 5 oppgaver > 7 dager - ESKALERT [Se oppgaver →]"
- Orange alert for photos: "📷 12 bilder venter på tagging [Se foto-innboks →]"
- Click buttons to navigate to specific modules
- Use red (#ef4444) and orange (#f97316) colors for urgency

### 3. KPI CARDS - PROJECT METRICS
- 4 metric cards in a row (responsive grid)
- Metrics: 
  - "Befaringer: 8 (5 åpne)"
  - "Oppgaver: 15 (5 kritiske)"
  - "Bilder: 45 (12 utagged)"
  - "Sjekklister: 3 (1 pending)"
- Use shadcn/ui Card component
- Icons for each metric
- Hover effects

### 4. MODULES - TABS
- Tab navigation for different modules:
  - "📋 Befaringer (8)"
  - "📝 Oppgaver (15)"
  - "📷 Bilder (45)"
  - "✅ Sjekklister (3)"
  - "📊 Rapporter"
  - "⚙️ Innstillinger"
- Use shadcn/ui Tabs component
- Active tab highlighted
- Responsive: Scrollable on mobile

### 5. ACTIVITY FEED - GROUPED EVENTS
- Show last 24 hours of activity
- Group by type:
  - "🎨 Bilder (2 hendelser)"
    - "• Ole Hansen la til 3 bilder (2t siden)"
    - "• Kari Nordmann la til 5 bilder (6t siden)"
  - "📋 Oppgaver (2 hendelser)"
    - "• Kari Nordmann opprettet oppgave #12 (4t siden)"
    - "• Lars Hansen fullførte oppgave #8 (8t siden)"
- "Vis alle hendelser" button at bottom
- Use timeline-style layout
- Show user avatars

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
- Badge (with variants: default, secondary, destructive)
- Tabs, TabsList, TabsTrigger, TabsContent
- Avatar, AvatarFallback
- Separator
- Alert, AlertDescription

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

### Spacing:
- Use Tailwind spacing scale (4px increments)
- Section spacing: py-6
- Card padding: p-4 or p-6
- Gap between items: gap-4

## NORWEGIAN LANGUAGE:
All text should be in Norwegian:
- "Tilbake til Dashboard" (Back to Dashboard)
- "Krever handling" (Requires action)
- "Se oppgaver" (See tasks)
- "Se foto-innboks" (See photo inbox)
- "Befaringer" (Inspections)
- "Oppgaver" (Tasks)
- "Bilder" (Photos)
- "Sjekklister" (Checklists)
- "Rapporter" (Reports)
- "Innstillinger" (Settings)
- "Aktivitetsfeed" (Activity feed)
- "Vis alle hendelser" (See all events)

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

## OUTPUT FORMAT:
Please provide:
1. Complete Next.js component code
2. TypeScript interfaces for data structures
3. Responsive design that works on all screen sizes
4. Clean, maintainable code with comments
5. Proper error handling
6. Loading states

## NOTES:
- This page should feel focused and organized
- No repetition from dashboard (only project-specific info)
- Grouped activity feed makes it easier to scan
- Tab navigation keeps modules organized
```

---

## 📋 ALTERNATIVE SHORTER PROMPT:

```
Create a Norwegian project detail page for construction management with:

1. Header: Back button, project name/number, favorite/settings buttons
2. Project info: Customer, status, last updated
3. Priority alerts: Critical tasks, untagged photos (project-specific)
4. KPI cards: Inspections, tasks, photos, checklists with counts
5. Module tabs: Inspections, Tasks, Photos, Checklists, Reports, Settings
6. Activity feed: Grouped events from last 24 hours

Tech: Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui
Style: Clean, focused, mobile-first
Language: Norwegian
Colors: Blue primary, red/orange for alerts

Make it responsive, accessible, and touch-friendly.
```

---

## 🎨 TIPS FOR V0:

1. **Start med den korte prompten** - Se hva v0 genererer
2. **Iterer basert på resultatet** - Gi tilbakemelding
3. **Be om spesifikke endringer** - "Make the activity feed more compact"
4. **Test tab navigation** - "Show me how tabs work on mobile"

---

**Kopier prompten over og lim den inn i v0!** 🚀

