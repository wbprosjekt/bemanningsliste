# V0 Design Prompt - FieldNote Dashboard

## 🎯 PROMPT FOR V0:

```
Create a modern, responsive dashboard for FieldNote - a Norwegian construction project management app.

## CONTEXT:
- FieldNote helps construction companies manage projects, inspections (befaringer), tasks (oppgaver), and photos
- Users are project managers and field workers who need quick access to critical information
- The app needs to handle hundreds of projects from Tripletex integration
- Mobile-first design is essential (field workers use phones/tablets)

## DESIGN REQUIREMENTS:

### 1. TOP SECTION - PROJECT SELECTOR
- Dropdown: "Alle prosjekter" with search functionality
- Search input with icon
- Filter button with dropdown
- Favorites button (⭐) to show only favorited projects
- Responsive: Stack on mobile, horizontal on desktop

### 2. REQUIRES ACTION - PRIORITY ALERTS
- Red alert card showing critical items needing attention
- Examples: "5 oppgaver > 7 dager (3 prosjekter)", "Befaring i morgen (1 prosjekt)"
- Orange alert for photos: "24 bilder venter på tagging"
- Click "Vis alle" to see full list
- Use red (#ef4444) and orange (#f97316) colors for urgency

### 3. PHOTO INBOX - MINI VIEW
- Show 6 images per project, grouped by project
- Display project name and count: "Haugesund Bygg: 12 bilder"
- Show 3-6 thumbnail images in a row
- "Se alle" button to view full inbox
- Include "Uten prosjekt" section for untagged photos
- Use image grid with rounded corners

### 4. KPI OVERVIEW CARDS
- 4 metric cards in a row (responsive grid)
- Metrics: "Aktive: 12", "Oppgaver: 45", "Befaringer: 8", "Bilder: 24"
- Use shadcn/ui Card component
- Icons for each metric
- Hover effects

### 5. FAVORITES & MOST ACTIVE
- Show favorited projects as chips/badges
- Show "🔥 Top 3 mest aktive (siste 7 dager)" section
- Click to navigate to project detail
- Use star icon for favorites

### 6. PROJECT LIST - CONDENSED CARDS
- Header: "📋 ALLE PROSJEKTER (247)" with search and filter
- Each project card shows:
  - Project name and number: "Haugesund Bygg #1234"
  - Favorite star button
  - Status indicators: "🔴 5 kritiske | 📊 45 hendelser | 📷 12 bilder"
  - "Se detaljer" button
- Pagination or "Vis 10 flere" button
- Responsive: 1 column on mobile, 2-3 on desktop

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
- Input, Select
- Dialog, Alert
- Avatar, AvatarFallback
- Separator
- Tabs, TabsList, TabsTrigger, TabsContent

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

### Typography:
- Headings: font-bold
- Body: font-normal
- Small text: text-sm
- Muted text: text-muted-foreground

## NORWEGIAN LANGUAGE:
All text should be in Norwegian:
- "Krever handling" (Requires action)
- "Foto-innboks" (Photo inbox)
- "Se alle" (See all)
- "Alle prosjekter" (All projects)
- "Søk" (Search)
- "Filter" (Filter)
- "Favoritter" (Favorites)
- "Se detaljer" (See details)
- "Aktive" (Active)
- "Oppgaver" (Tasks)
- "Befaringer" (Inspections)
- "Bilder" (Photos)

## ACCESSIBILITY:
- Use semantic HTML
- Proper heading hierarchy (h1, h2, h3)
- Alt text for images
- ARIA labels for buttons
- Keyboard navigation support
- Focus states visible

## MOBILE OPTIMIZATION:
- Touch-friendly buttons (min 44x44px)
- Large enough text (min 16px)
- Safe area padding for notched devices
- Sticky header on scroll
- Bottom navigation or floating action button

## ANIMATIONS:
- Smooth transitions on hover
- Loading states with skeleton screens
- Toast notifications for actions
- Subtle fade-in on page load

## EXAMPLES OF GOOD DASHBOARDS:
- Linear's dashboard (clean, focused)
- Vercel's dashboard (modern, minimal)
- Notion's dashboard (flexible, organized)
- Monday.com's dashboard (clear hierarchy)

## OUTPUT FORMAT:
Please provide:
1. Complete Next.js component code
2. TypeScript interfaces for data structures
3. Responsive design that works on all screen sizes
4. Clean, maintainable code with comments
5. Proper error handling
6. Loading states

## NOTES:
- This is a professional tool for construction workers
- Design should be practical, not flashy
- Information density is important (show more, scroll less)
- Use icons to make scanning easier
- Color coding helps identify urgency quickly
```

---

## 📋 ALTERNATIVE SHORTER PROMPT:

Hvis du vil ha en kortere versjon:

```
Create a Norwegian construction project management dashboard with:

1. Top: Project selector with search/filter/favorites
2. Priority alerts: Critical tasks, tomorrow's inspections, untagged photos
3. Photo inbox: 6 images per project, grouped
4. KPI cards: Active projects, tasks, inspections, photos
5. Favorites & most active projects
6. Project list: Condensed cards with status indicators

Tech: Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui
Style: Clean, modern, mobile-first, professional
Language: Norwegian
Colors: Blue primary, red/orange for alerts, clean white background

Make it responsive, accessible, and touch-friendly.
```

---

## 🎨 TIPS FOR V0:

1. **Start med den korte prompten** - Se hva v0 genererer
2. **Iterer basert på resultatet** - Gi tilbakemelding og be om endringer
3. **Be om spesifikke komponenter** - "Make the photo inbox more compact"
4. **Test responsive design** - "Show me the mobile version"

---

**Kopier prompten over og lim den inn i v0!** 🚀

Vil du at jeg skal begynne å implementere wireframen direkte i koden mens du tester v0? 🤔

