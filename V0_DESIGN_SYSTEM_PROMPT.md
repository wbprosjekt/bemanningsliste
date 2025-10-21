# V0 Design System Prompt - FieldNote Complete Theme

## 🎯 PROMPT FOR V0:

```
Create a comprehensive design system and theme for FieldNote - a Norwegian construction project management app.

## CONTEXT:
FieldNote helps construction companies manage:
- Projects (hundreds from Tripletex integration)
- Inspections (befaringer)
- Tasks (oppgaver)
- Photos (documentation)
- Time tracking (timer/uke)
- Reports and checklists

Users: Project managers, field workers, administrators
Devices: Desktop, tablets, mobile phones
Environment: Construction sites, offices, on-the-go

## DESIGN SYSTEM REQUIREMENTS:

### 1. COLOR PALETTE

#### Primary Colors:
- Primary: Blue (#3b82f6) - Main actions, links, active states
- Primary Dark: Blue (#2563eb) - Hover states
- Primary Light: Blue (#dbeafe) - Backgrounds, badges

#### Status Colors:
- Success: Green (#10b981) - Completed, approved, positive
- Warning: Orange (#f97316) - Attention needed, pending
- Danger: Red (#ef4444) - Critical, errors, urgent
- Info: Blue (#3b82f6) - Information, neutral

#### Neutral Colors:
- Background: White (#ffffff)
- Surface: Light Gray (#f9fafb)
- Border: Gray (#e5e7eb)
- Text Primary: Dark Gray (#1f2937)
- Text Secondary: Gray (#6b7280)
- Text Muted: Light Gray (#9ca3af)

#### Status Badge Colors:
- Fullført: Green (#10b981)
- Pågående: Blue (#3b82f6)
- Pending: Orange (#f97316)
- Kansellert: Gray (#6b7280)
- Eskalert: Red (#ef4444)

### 2. TYPOGRAPHY

#### Font Family:
- Primary: Inter, system-ui, -apple-system, sans-serif
- Monospace: 'Courier New', monospace (for code/numbers)

#### Font Sizes:
- Display: 3rem (48px) - Hero titles
- H1: 2.25rem (36px) - Page titles
- H2: 1.875rem (30px) - Section titles
- H3: 1.5rem (24px) - Subsection titles
- H4: 1.25rem (20px) - Card titles
- Body: 1rem (16px) - Body text
- Small: 0.875rem (14px) - Secondary text
- Tiny: 0.75rem (12px) - Labels, captions

#### Font Weights:
- Light: 300
- Normal: 400
- Medium: 500
- Semibold: 600
- Bold: 700

#### Line Heights:
- Tight: 1.25
- Normal: 1.5
- Relaxed: 1.75

### 3. SPACING SCALE

Use Tailwind's spacing scale (4px increments):
- 0: 0px
- 1: 4px
- 2: 8px
- 3: 12px
- 4: 16px
- 5: 20px
- 6: 24px
- 8: 32px
- 10: 40px
- 12: 48px
- 16: 64px
- 20: 80px
- 24: 96px

### 4. BORDER RADIUS

- None: 0px
- Small: 0.25rem (4px)
- Medium: 0.5rem (8px)
- Large: 0.75rem (12px)
- XL: 1rem (16px)
- Full: 9999px (pill-shaped)

### 5. SHADOWS

- None: none
- Small: 0 1px 2px 0 rgb(0 0 0 / 0.05)
- Medium: 0 4px 6px -1px rgb(0 0 0 / 0.1)
- Large: 0 10px 15px -3px rgb(0 0 0 / 0.1)
- XL: 0 20px 25px -5px rgb(0 0 0 / 0.1)

### 6. COMPONENT STYLES

#### Buttons:
- Primary: Blue background, white text, hover darkens
- Secondary: Gray background, dark text, hover lightens
- Outline: Transparent, border, hover fills
- Ghost: Transparent, hover shows background
- Destructive: Red background, white text
- Sizes: sm (h-8), md (h-10), lg (h-12)

#### Cards:
- Background: White
- Border: 1px solid #e5e7eb
- Border radius: 0.5rem (8px)
- Shadow: Small
- Padding: p-4 or p-6
- Hover: Shadow increases

#### Inputs:
- Border: 1px solid #d1d5db
- Border radius: 0.375rem (6px)
- Padding: px-3 py-2
- Focus: Border blue, ring blue
- Error: Border red

#### Badges:
- Small: px-2 py-1, text-xs
- Medium: px-2.5 py-0.5, text-sm
- Rounded: Full (pill-shaped)

#### Alerts:
- Success: Green background (#d1fae5), green text
- Warning: Orange background (#fed7aa), orange text
- Error: Red background (#fee2e2), red text
- Info: Blue background (#dbeafe), blue text

### 7. ICONS

Use Lucide React icons consistently:
- Size: 16px (sm), 20px (md), 24px (lg)
- Stroke width: 2px
- Color: Inherit from parent or use theme colors

Common icons:
- Home: Home
- Projects: Building2
- Inspections: ClipboardList
- Tasks: CheckSquare
- Photos: Image
- Time: Clock
- Calendar: Calendar
- Search: Search
- Filter: Filter
- Settings: Settings
- User: User
- Bell: Bell
- Star: Star
- Plus: Plus
- Edit: Edit
- Delete: Trash2
- Check: Check
- X: X

### 8. RESPONSIVE BREAKPOINTS

- Mobile: < 640px (sm)
- Tablet: 640px - 1024px (md)
- Desktop: > 1024px (lg)
- Large Desktop: > 1280px (xl)

### 9. LAYOUT PATTERNS

#### Page Layout:
- Max width: 1280px (7xl)
- Container padding: p-4 sm:p-6 lg:p-8
- Section spacing: py-6 lg:py-8

#### Grid Layouts:
- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3 columns
- Large Desktop: 4 columns

#### Card Grids:
- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3 columns

### 10. ANIMATIONS

#### Transitions:
- Fast: 150ms
- Normal: 200ms
- Slow: 300ms

#### Easing:
- Default: cubic-bezier(0.4, 0, 0.2, 1)
- In: cubic-bezier(0.4, 0, 1, 1)
- Out: cubic-bezier(0, 0, 0.2, 1)
- In-out: cubic-bezier(0.4, 0, 0.2, 1)

#### Common Animations:
- Fade in: opacity 0 → 1
- Slide up: translateY(10px) → 0
- Scale: scale(0.95) → 1
- Hover: scale(1.02) or translateY(-2px)

### 11. ACCESSIBILITY

#### Contrast:
- Text on background: Min 4.5:1
- Large text: Min 3:1
- UI components: Min 3:1

#### Focus States:
- Visible outline: 2px solid blue
- Focus ring: ring-2 ring-blue-500

#### Touch Targets:
- Minimum: 44x44px
- Recommended: 48x48px

#### Keyboard Navigation:
- Tab order: Logical flow
- Skip links: For main content
- ARIA labels: For all interactive elements

### 12. NORWEGIAN LANGUAGE

All text in Norwegian:
- "Dashboard" → "Dashboard"
- "Prosjekter" → "Projects"
- "Befaringer" → "Inspections"
- "Oppgaver" → "Tasks"
- "Bilder" → "Photos"
- "Timer" → "Hours/Time"
- "Rapporter" → "Reports"
- "Innstillinger" → "Settings"
- "Profil" → "Profile"
- "Logg ut" → "Log out"
- "Lagre" → "Save"
- "Avbryt" → "Cancel"
- "Slett" → "Delete"
- "Rediger" → "Edit"
- "Se alle" → "See all"
- "Vis flere" → "See more"

### 13. MOBILE OPTIMIZATION

#### Touch-Friendly:
- Buttons: Min 44x44px
- Inputs: Min 44px height
- Checkboxes: Min 24x24px
- Links: Min 44x44px touch target

#### Safe Areas:
- Top: pt-safe (for notched devices)
- Bottom: pb-safe (for home indicator)

#### Gestures:
- Swipe: For navigation
- Pull to refresh: For lists
- Long press: For context menus

### 14. LOADING STATES

#### Skeleton Screens:
- Background: #f3f4f6
- Animation: Pulse
- Duration: 2s infinite

#### Spinners:
- Color: Blue (#3b82f6)
- Size: 20px, 24px, 32px
- Animation: Rotate 360deg

#### Progress Bars:
- Background: #e5e7eb
- Fill: Blue (#3b82f6)
- Height: 4px or 8px

### 15. TOAST NOTIFICATIONS

#### Positions:
- Top right (desktop)
- Top center (mobile)

#### Styles:
- Success: Green background, check icon
- Error: Red background, X icon
- Warning: Orange background, alert icon
- Info: Blue background, info icon

#### Timing:
- Auto dismiss: 5 seconds
- Manual dismiss: X button

### 16. MODALS & DIALOGS

#### Sizes:
- Small: max-w-md (28rem)
- Medium: max-w-lg (32rem)
- Large: max-w-2xl (42rem)
- Full: max-w-4xl (56rem)

#### Backdrop:
- Background: rgba(0, 0, 0, 0.5)
- Animation: Fade in

#### Content:
- Background: White
- Border radius: 0.5rem (8px)
- Padding: p-6
- Shadow: Large

### 17. TABLES

#### Headers:
- Background: #f9fafb
- Text: Bold, dark gray
- Border: 1px solid #e5e7eb

#### Rows:
- Background: White
- Hover: #f9fafb
- Border: 1px solid #e5e7eb

#### Cells:
- Padding: px-4 py-3
- Text: Dark gray

### 18. FORMS

#### Labels:
- Font size: 0.875rem (14px)
- Font weight: 500
- Color: Dark gray
- Margin: mb-2

#### Inputs:
- Border: 1px solid #d1d5db
- Border radius: 0.375rem (6px)
- Padding: px-3 py-2
- Focus: Border blue, ring blue

#### Error Messages:
- Color: Red (#ef4444)
- Font size: 0.875rem (14px)
- Margin: mt-1

### 19. NAVIGATION

#### Top Navigation:
- Height: 64px
- Background: White
- Border: 1px solid #e5e7eb
- Shadow: Small
- Padding: px-4 lg:px-6

#### Side Navigation:
- Width: 256px
- Background: White
- Border: 1px solid #e5e7eb
- Padding: p-4

#### Mobile Navigation:
- Bottom bar: 64px height
- Background: White
- Border: 1px solid #e5e7eb
- Shadow: Large
- Icons: 24px

### 20. PAGES TO APPLY THIS THEME:

1. **Dashboard** - Project overview
2. **Project Detail** - Single project view
3. **Inspections (Befaringer)** - List and detail
4. **Tasks (Oppgaver)** - List and detail
5. **Photos** - Gallery and upload
6. **Time Tracking (Timer/Uke)** - Weekly time entry
7. **Reports** - Generated reports
8. **Settings** - User and org settings
9. **Profile** - User profile
10. **Login/Auth** - Authentication pages
11. **Admin** - Admin functions

## OUTPUT FORMAT:

Please provide:
1. Complete Tailwind CSS configuration
2. CSS custom properties (CSS variables)
3. Component examples using the theme
4. Responsive design patterns
5. Accessibility guidelines
6. Usage examples for all pages

## NOTES:
- This is a professional tool for construction workers
- Design should be practical, not flashy
- Consistency is key across all pages
- Mobile-first approach
- Norwegian language throughout
- High contrast for outdoor visibility
```

---

## 📋 ALTERNATIVE SHORTER PROMPT:

```
Create a complete design system for FieldNote - Norwegian construction management app.

Include:
- Color palette (primary blue, status colors, neutrals)
- Typography (Inter font, sizes, weights)
- Spacing scale (Tailwind 4px increments)
- Border radius, shadows, animations
- Component styles (buttons, cards, inputs, badges, alerts)
- Icons (Lucide React, consistent sizes)
- Responsive breakpoints (mobile/tablet/desktop)
- Layout patterns (grids, containers, sections)
- Accessibility (contrast, focus, touch targets)
- Norwegian language
- Mobile optimization
- Loading states, toasts, modals, tables, forms, navigation

Apply to all pages:
- Dashboard, Project Detail, Inspections, Tasks, Photos
- Time Tracking, Reports, Settings, Profile, Login, Admin

Tech: Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui
Style: Clean, professional, mobile-first, high contrast
```

---

## 🎨 TIPS FOR V0:

1. **Start med den korte prompten** - Se hva v0 genererer
2. **Be om spesifikke komponenter** - "Show me button examples"
3. **Test responsive design** - "Show me mobile vs desktop"
4. **Be om dark mode** - "Add dark mode support" (hvis du vil)

---

**Kopier prompten over og lim den inn i v0!** 🚀

Vil du at jeg skal hjelpe deg med å integrere design-systemet når du får det fra v0? 🤔

