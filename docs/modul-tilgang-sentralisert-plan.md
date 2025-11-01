# Sentralisert Modul-tilgang Plan - Integrert i Brukerhåndtering

## Oversikt

Dette dokumentet beskriver hvordan modul-tilgang (refusjon, befaring, osv.) skal integreres direkte i `/admin/brukere` siden, i stedet for separate tilgangssider. Løsningen bruker en **hybrid tilnærming (Alternativ A + D)** med kompakt inline-visning av moduler og optional tooltip/popover for detaljer.

## Nåværende Situasjon

### Eksisterende Struktur:
- ✅ `/admin/brukere` - Viser alle brukere, roller (dropdown), status
- ✅ `/refusjon/admin/tilgang` - Separat side for refusjon-modul tilgang og pricing policies
- ✅ `UserInviteSystem` - Komponent for å synkronisere og opprette brukere fra Tripletex
- ✅ `profile_modules` tabell - Allerede klar med `'refusjon_hjemmelading'`, `'befaring'`, `'bemanningsliste'` i CHECK constraint
- ✅ `hasRefusjonAccess()` utility - Eksisterende funksjon for refusjon-tilgang

### Hva Som Mangler:
- ❌ Befaring modul-tilgang kontroll
- ❌ Modul-tilgang på samme sted som rolle-setting
- ❌ Oversikt over alle moduler per bruker i en tabell
- ❌ Sentralisert modul-tilgang administrasjon

## Valgt Løsning: Hybrid A + D

### Konsept:
1. **Modul-kolonne** med kompakt inline visning (Alternativ D)
   - Ikoner + toggle-states side-by-side
   - Alltid synlig uten ekstra klikk
   
2. **Optional Tooltip/Popover** for detaljer (fra Alternativ A)
   - Hover eller klikk viser detaljer
   - Kan inneholde modul-spesifikke innstillinger i fremtiden

### Wireframe - Final Design:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Brukerhåndtering                                                                              [Oppdater]        │
│ WB Prosjekt AS - Administrer brukere og tilganger                                                              │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Stats Cards: Totale brukere | Administratorer | Aktive brukere | Søkefelt]                                     │
│                                                                                                                 │
│ [UserInviteSystem - Tripletex sync]                                                                            │
│                                                                                                                 │
│ Brukere (64)                                                                                                    │
│ ┌──────────┬─────────┬────────┬────────┬──────────┬──────────────────────────────┬─────────────┬─────────────────┐ │
│ │ Bruker   │ E-post  │ Rolle  │ Type   │ Status   │ Moduler                     │ Opprettet   │ Handlinger      │ │
│ ├──────────┼─────────┼────────┼────────┼──────────┼──────────────────────────────┼─────────────┼─────────────────┤ │
│ │ Ola N.   │ ola@... │ Admin  │ Ansatt │ ✅ Aktiv │ 🟢 Alt tilgang              │ 15. jan 2025│ [👁️] [🔑] [✓]   │ │
│ │          │         │        │        │          │ (alle moduler aktiv)        │             │                 │ │
│ ├──────────┼─────────┼────────┼────────┼──────────┼──────────────────────────────┼─────────────┼─────────────────┤ │
│ │ Kari P.  │ kari@...│ Leder  │ Ansatt │ ✅ Aktiv │ 🟢 Alt tilgang              │ 16. jan 2025│ [👁️] [🔑] [✓]   │ │
│ │          │         │        │        │          │ (alle moduler aktiv)        │             │                 │                 │
│ ├──────────┼─────────┼────────┼────────┼──────────┼──────────────────────────────┼─────────────┼─────────────────┤ │
│ │ Per L.   │ per@... │ Bruker │ Ansatt │ ✅ Aktiv │ 💰✓  📋✓  📅✓               │ 17. jan 2025│ [👁️] [🔑] [✓]   │ │
│ │          │         │        │        │          │ Refusjon  Befaring  Min uke │             │                 │ │
│ ├──────────┼─────────┼────────┼────────┼──────────┼──────────────────────────────┼─────────────┼─────────────────┤ │
│ │ Anne B.  │ anne@...│ Bruker │ Ansatt │ ✅ Aktiv │ 💰✗  📋✓  📅✓               │ 18. jan 2025│ [👁️] [🔑] [✓]   │ │
│ │          │         │        │        │          │ Refusjon  Befaring  Min uke │             │                 │ │
│ ├──────────┼─────────┼────────┼────────┼──────────┼──────────────────────────────┼─────────────┼─────────────────┤ │
│ │ Økonomi  │ ok@... │ Økonomi│ Ansatt │ ✅ Aktiv │ 🟢 Alt tilgang              │ 19. jan 2025│ [👁️] [🔑] [✓]   │ │
│ │          │         │        │        │          │ (alle moduler aktiv)        │             │                 │ │
│ └──────────┴─────────┴────────┴────────┴──────────┴──────────────────────────────┴─────────────┴─────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Hover Tooltip (for ikke-admin brukere):
┌─────────────────────────────────┐
│ Modul-tilgang                   │
├─────────────────────────────────┤
│ 💰 Refusjon:     [Toggle] ON    │
│ 📋 Befaring:     [Toggle] ON    │
│ 📅 Min uke:      [Toggle] ON (låst) │
│                                 │
│ Klikk for å endre              │
└─────────────────────────────────┘
```

### Ikoner:
- 💰 Refusjon (`refusjon_hjemmelading`)
- 📋 Befaring (`befaring`)
- 📅 Min uke (`bemanningsliste` eller alltid aktiv)

### Visual States:
- **Admin/Leder/Økonomi**: "🟢 Alt tilgang" (disabled badge, tooltip forklarer at de har alltid tilgang)
- **Bruker**: 
  - `💰✓` = Refusjon aktivert (grønn tekst, hover viser tooltip med toggle)
  - `💰✗` = Refusjon deaktivert (grå tekst, hover viser tooltip med toggle)
  - `📅✓` = Min uke alltid aktiv (grønn tekst, disabled toggle)

## Modul-regler (Business Rules)

### Alltid Aktiv (Ikke i database):
- **Min uke** (`bemanningsliste`) - Alle brukere med login har alltid tilgang
  - Vises som låst toggle (disabled)
  - Tooltip: "Min uke er alltid tilgjengelig for alle brukere"
  - **Ikke lagret i `profile_modules`** - bare business rule i kode

### Automatisk Aktiv for Roller:
- **Admin** (`role === 'admin'`):
  - Alle moduler aktivert automatisk (business rule)
  - Kan ikke deaktiveres i UI (vis toast ved forsøk)
  - Vises som "🟢 Alt tilgang" (disabled)
  
- **Leder** (`role === 'manager'` eller `role === 'leder'`):
  - Alle moduler aktivert automatisk (business rule)
  - Kan ikke deaktiveres i UI (vis toast ved forsøk)
  - Vises som "🟢 Alt tilgang" (disabled)
  
- **Økonomi** (`role === 'økonomi'`):
  - Alle moduler aktivert automatisk (business rule)
  - Kan ikke deaktiveres i UI (vis toast ved forsøk)
  - Vises som "🟢 Alt tilgang" (disabled)

**Notat:** For konsistens kan vi lagre admin/leder/økonomi moduler i `profile_modules`, men toggle-funksjonen må alltid respektere business rules (alltid aktiv for disse rollene).

### Manuell Aktiv/Deaktiv:
- **Bruker** (`role === 'user'`):
  - Refusjon kan aktiveres/deaktiveres manuelt
  - Befaring kan aktiveres/deaktiveres manuelt
  - Min uke alltid aktiv (låst, ikke i database)

### Edge Cases:
- **Inaktiv bruker** (`role === 'inactive'`): Vises som "❌ Inaktiv" i Status-kolonne, moduler vises normalt men toggle er disabled
- **Bruker uten person-profil**: Moduler kan fortsatt aktiveres/deaktiveres, men vises normalt

## Database-endringer

**Ingen endringer nødvendig!**

`profile_modules` tabellen er allerede klar:
- ✅ `'refusjon_hjemmelading'` i CHECK constraint (linje 184 i migration)
- ✅ `'befaring'` i CHECK constraint  
- ✅ `'bemanningsliste'` i CHECK constraint
- ✅ Foreign key til `profiles(id)` med `ON DELETE CASCADE`
- ✅ Unique constraint på `(profile_id, module_name)`
- ✅ RLS policies på plass

**Anbefaling:** 
- **Ikke** bruk `profile_modules` for `bemanningsliste` - bare ha business rule i kode ("alltid aktiv")
- **Ikke** lagre admin/leder/økonomi moduler i database hvis de alltid skal være aktiv (sparer database-space), men hvis vi lagrer dem for logging/audit, respekter business rules i toggle-funksjonen

## Implementasjonsplan

### Fase 1: Database & Data Loading ⏳
**Mål:** Hente og mappe modul-data korrekt

- [ ] Utvid `loadUsers()` i `/admin/brukere/page.tsx` til å hente `profile_modules` data
  ```typescript
  // Eksisterende query:
  const profilesResponse = await supabase
    .from("profiles")
    .select("id, user_id, display_name, role, created_at")
    .eq("org_id", profile.org_id);
  
  // Legg til:
  const { data: moduleData } = await supabase
    .from('profile_modules')
    .select('profile_id, module_name, enabled')
    .in('profile_id', profiles.map(p => p.id));
  ```

- [ ] Lag helper-funksjon `mapModuleAccess(profiles, moduleData)` som mapper modul-data til `UserProfile`
  - Map `refusjon_hjemmelading` → `modules.refusjon`
  - Map `befaring` → `modules.befaring`
  - `modules.bemanningsliste` → alltid `true` (business rule)

- [ ] Oppdater `UserProfile` interface med `modules` objekt:
  ```typescript
  interface UserProfile {
    // ... existing fields
    modules: {
      refusjon: boolean;      // fra profile_modules eller business rule
      befaring: boolean;       // fra profile_modules eller business rule
      bemanningsliste: boolean; // alltid true (business rule)
    };
  }
  ```

- [ ] **Business Rule Logic:** I mapping-funksjonen, sjekk rolle først:
  - Hvis `role === 'admin' || role === 'manager' || role === 'leder' || role === 'økonomi'`:
    - Sett `refusjon = true`, `befaring = true` (overstyrer database)
  - Hvis `role === 'user'`:
    - Bruk database-verdier fra `profile_modules`
    - Hvis ikke funnet i database, default til `false`

**Test:**
- [ ] Verifiser at admin/leder/økonomi alltid vises med alle moduler aktiv
- [ ] Verifiser at brukere vises med korrekt modul-status fra database
- [ ] Verifiser at brukere uten modul-data vises med alle moduler deaktivert (bortsett fra bemanningsliste)

### Fase 2: UI - Modul-kolonne ⏳
**Mål:** Legge til modul-kolonne i tabell med kompakt visning

- [ ] Legg til "Moduler" kolonne i tabell (plasser etter "Status", før "Opprettet")
  - Oppdater `<TableHeader>` med ny `<TableHead>Moduler</TableHead>`
  - Oppdater `<TableBody>` med ny `<TableCell>` per rad

- [ ] Implementer `ModuleAccessCell` komponent (`src/components/admin/ModuleAccessCell.tsx`):
  ```typescript
  interface ModuleAccessCellProps {
    user: UserProfile;
    onToggle: (moduleName: 'refusjon_hjemmelading' | 'befaring', enabled: boolean) => void;
  }
  ```

- [ ] **Admin/Leder/Økonomi visning:**
  ```typescript
  const isAdminOrManager = user.role === 'admin' || 
                           user.role === 'manager' || 
                           user.role === 'leder' || 
                           user.role === 'økonomi';
  
  if (isAdminOrManager) {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700">
        🟢 Alt tilgang
      </Badge>
    );
  }
  ```

- [ ] **Bruker visning:**
  ```typescript
  return (
    <div className="flex items-center gap-3">
      <ModuleIcon 
        module="refusjon_hjemmelading" 
        enabled={user.modules.refusjon} 
        onToggle={onToggle}
        user={user}
      />
      <ModuleIcon 
        module="befaring" 
        enabled={user.modules.befaring} 
        onToggle={onToggle}
        user={user}
      />
      <ModuleIcon 
        module="bemanningsliste" 
        enabled={true} 
        locked
        user={user}
      />
    </div>
  );
  ```

- [ ] Implementer `ModuleIcon` komponent (`src/components/admin/ModuleIcon.tsx`):
  - Viser ikon (💰, 📋, 📅) med ✓ eller ✗
  - Klikkbar (unntatt låste moduler)
  - Hover viser tooltip med toggle switch
  - Styling: Grønn for aktiv, grå for inaktiv

**Test:**
- [ ] Verifiser at admin/leder/økonomi viser "🟢 Alt tilgang"
- [ ] Verifiser at brukere viser ikoner med korrekt status
- [ ] Verifiser at "Min uke" alltid vises som aktiv (låst)

### Fase 3: Toggle Funksjonalitet ⏳
**Mål:** Implementere toggle av modul-tilgang med korrekt business rules

- [ ] Lag `toggleModuleAccess()` funksjon i `/admin/brukere/page.tsx`:
  ```typescript
  const toggleModuleAccess = async (
    profileId: string, 
    moduleName: 'refusjon_hjemmelading' | 'befaring',
    enabled: boolean
  ) => {
    // Business Rule Check 1: Block toggle for admin/leder/økonomi
    const user = users.find(u => u.id === profileId);
    if (user?.role === 'admin' || 
        user?.role === 'manager' || 
        user?.role === 'leder' || 
        user?.role === 'økonomi') {
      toast({
        title: 'Ikke mulig',
        description: `${user.role === 'admin' ? 'Administratorer' : 
                       user.role === 'leder' || user.role === 'manager' ? 'Ledere' : 
                       'Økonomi-ansatte'} har alltid tilgang til alle moduler`,
        variant: 'default'
      });
      return;
    }
    
    // Business Rule Check 2: Block toggle for bemanningsliste
    if (moduleName === 'bemanningsliste') {
      toast({
        title: 'Ikke mulig',
        description: 'Min uke er alltid tilgjengelig for alle brukere',
        variant: 'default'
      });
      return;
    }
    
    // Upsert module access
    const { error } = await supabase
      .from('profile_modules')
      .upsert({
        profile_id: profileId,
        module_name: moduleName,
        enabled
      }, {
        onConflict: 'profile_id,module_name'
      });
    
    if (error) {
      console.error('Error toggling module access:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke oppdatere modul-tilgang',
        variant: 'destructive'
      });
      return;
    }
    
    // Update local state optimistically
    setUsers(prev => prev.map(u => 
      u.id === profileId 
        ? { 
            ...u, 
            modules: { 
              ...u.modules, 
              [moduleName === 'refusjon_hjemmelading' ? 'refusjon' : 'befaring']: enabled 
            } 
          }
        : u
    ));
    
    toast({
      title: enabled ? 'Modul aktivert' : 'Modul deaktivert',
      description: `${moduleName === 'refusjon_hjemmelading' ? 'Refusjon' : 'Befaring'} er nå ${enabled ? 'aktivert' : 'deaktivert'} for denne brukeren`,
    });
  };
  ```

- [ ] Pass `toggleModuleAccess` til `ModuleAccessCell` via `onToggle` prop
- [ ] Implementer klikk-håndtering i `ModuleIcon` som kaller `onToggle`

**Edge Cases:**
- [ ] Håndter at bruker er inaktiv (`role === 'inactive'`) - disable toggle, vis tooltip
- [ ] Håndter network errors - vis toast, ikke oppdater local state
- [ ] Håndter at bruker endres til admin/leder/økonomi - automatisk aktiver alle moduler (kan være optional)

**Test:**
- [ ] Test at toggle fungerer for brukere
- [ ] Test at toggle blokkeres for admin/leder/økonomi
- [ ] Test at toggle blokkeres for "Min uke"
- [ ] Test at local state oppdateres korrekt
- [ ] Test at database oppdateres korrekt
- [ ] Test error handling (network error, etc.)

### Fase 4: Tooltip/Popover (Optional) ⏳
**Mål:** Bedre UX med hover/click tooltip

- [ ] Lag `ModuleAccessTooltip` komponent (`src/components/admin/ModuleAccessTooltip.tsx`):
  - Bruk Radix UI `Popover` eller `Tooltip`
  - Vis toggle switches for alle moduler (inkludert låste)
  - Vis modul-navn (Refusjon, Befaring, Min uke)
  - Vis status (ON/OFF, eller "Alltid aktiv" for låste)

- [ ] Integrer tooltip i `ModuleAccessCell`:
  - Hover eller klikk åpner tooltip
  - Tooltip viser alle moduler med toggle switches
  - Toggle switches i tooltip kan brukes direkte

**Alternative:** Hvis tooltip blir for komplekst, kan vi hoppe over denne fasen og bare bruke inline ikoner med direkte klikk.

**Test:**
- [ ] Verifiser at tooltip åpnes på hover/click
- [ ] Verifiser at toggle switches fungerer i tooltip
- [ ] Verifiser at tooltip lukkes korrekt

### Fase 5: Access Check Utility ⏳
**Mål:** Sentralisert utility for å sjekke modul-tilgang

- [ ] Lag `src/lib/moduleAccess.ts` (utvid eksisterende eller lag ny):
  ```typescript
  /**
   * Check if user has access to a specific module
   * Respekterer business rules: admin/leder/økonomi har alltid tilgang
   */
  export async function hasModuleAccess(
    userId: string,
    moduleName: 'refusjon_hjemmelading' | 'befaring'
  ): Promise<boolean> {
    try {
      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', userId)
        .single();
      
      if (!profile) return false;
      
      // Business Rule: Admin/Leder/Økonomi har alltid tilgang
      if (profile.role === 'admin' || 
          profile.role === 'manager' || 
          profile.role === 'leder' || 
          profile.role === 'økonomi') {
        return true;
      }
      
      // Check profile_modules
      const { data: moduleAccess } = await supabase
        .from('profile_modules')
        .select('enabled')
        .eq('profile_id', profile.id)
        .eq('module_name', moduleName)
        .maybeSingle();
      
      return moduleAccess?.enabled ?? false;
    } catch (error) {
      console.error('Error checking module access:', error);
      return false;
    }
  }
  
  /**
   * Check if user has bemanningsliste access
   * Alltid true for alle brukere med login (business rule)
   */
  export function hasBemanningslisteAccess(): boolean {
    return true; // Alltid aktiv
  }
  ```

- [ ] Oppdater eksisterende `hasRefusjonAccess()` til å bruke ny `hasModuleAccess()` (refaktorer)

**Test:**
- [ ] Verifiser at `hasModuleAccess()` returnerer `true` for admin/leder/økonomi
- [ ] Verifiser at `hasModuleAccess()` returnerer korrekt verdi for brukere basert på database
- [ ] Verifiser at `hasBemanningslisteAccess()` alltid returnerer `true`

### Fase 6: Befaring Modul - Access Control ⏳
**Mål:** Integrer modul-tilgang i befaring-sider

- [ ] Oppdater `/befaring/page.tsx` med access check:
  ```typescript
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, user_id')
    .eq('user_id', user.id)
    .single();
  
  const hasAccess = await hasModuleAccess(user.id, 'befaring');
  
  if (!hasAccess) {
    // Redirect eller vis "Ingen tilgang" melding
    return <AccessDenied module="Befaring" />;
  }
  ```

- [ ] Oppdater navigasjon (Sidebar) til å skjule "Befaring" link hvis ikke aktivert:
  ```typescript
  const hasBefaringAccess = await hasModuleAccess(user.id, 'befaring');
  
  {hasBefaringAccess && (
    <Link href="/befaring">Befaring</Link>
  )}
  ```

- [ ] Lag `AccessDenied` komponent for konsistent "Ingen tilgang" melding

**Test:**
- [ ] Test at befaring-side blokkerer hvis modul ikke aktivert
- [ ] Test at navigasjon skjuler link hvis modul ikke aktivert
- [ ] Test at admin/leder/økonomi alltid har tilgang

### Fase 7: Refusjon Modul - Konsolidering ⏳
**Mål:** Konsolider refusjon-tilgang med ny struktur

- [ ] Vurder: Skal vi redirecte `/refusjon/admin/tilgang` til `/admin/brukere`?
  - **Anbefaling:** Behold refusjon-side for pricing policies, legg til link til `/admin/brukere` for modul-tilgang
  - Eller: Legg til seksjon i `/admin/brukere` for pricing policies (kan være komplekst)

- [ ] Oppdater eksisterende `hasRefusjonAccess()` til å bruke ny `hasModuleAccess()` utility
- [ ] Test at refusjon-modul fortsatt fungerer med ny struktur

**Test:**
- [ ] Test at refusjon-sider fungerer korrekt med ny access check
- [ ] Test at eksisterende refusjon-tilgang er bevart

### Fase 8: Testing & Validering ⏳
**Mål:** Komplett test av alle funksjoner

**Unit Tests (Optional):**
- [ ] Test `hasModuleAccess()` med forskjellige roller
- [ ] Test `mapModuleAccess()` med forskjellige data-scenarios
- [ ] Test `toggleModuleAccess()` med edge cases

**Integration Tests:**
- [ ] Test at admin/leder/økonomi har alltid tilgang
- [ ] Test at toggle fungerer for brukere
- [ ] Test at "Min uke" alltid er tilgjengelig
- [ ] Test at navigasjon oppdateres når modul deaktiveres
- [ ] Test at befaring access fungerer
- [ ] Test at refusjon kompatibilitet er bevart
- [ ] Test at data persisteres korrekt i database
- [ ] Test at UI oppdateres optimistically

**Edge Cases:**
- [ ] Bruker endres fra "user" til "admin" - moduler skal automatisk aktiveres (optional)
- [ ] Bruker slettes - modul-data skal slettes (CASCADE)
- [ ] Bruker flyttes mellom organisasjoner - modul-data skal håndteres korrekt
- [ ] Network error under toggle - skal vise error, ikke oppdatere local state

## Tekniske Detaljer

### Data Loading:
```typescript
// I loadUsers() i /admin/brukere/page.tsx:

const loadUsers = useCallback(async () => {
  if (!profile?.org_id) return;
  
  setLoading(true);
  try {
    // Eksisterende queries
    const [profilesResponse, personsResponse] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, user_id, display_name, role, created_at")
        .eq("org_id", profile.org_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("person")
        .select("id, fornavn, etternavn, epost, aktiv, person_type, forventet_dagstimer")
        .eq("org_id", profile.org_id),
    ]);
    
    const { data, error } = profilesResponse;
    const { data: personData, error: personError } = personsResponse;
    
    if (error) throw error;
    if (personError) throw personError;
    
    const profiles = data || [];
    const persons = personData || [];
    
    // NY: Hent modul-data
    const profileIds = profiles.map(p => p.id);
    const { data: moduleData, error: moduleError } = await supabase
      .from('profile_modules')
      .select('profile_id, module_name, enabled')
      .in('profile_id', profileIds);
    
    if (moduleError) {
      console.error('Error loading module data:', moduleError);
      // Fortsett uten modul-data, bruk defaults
    }
    
    // Map modul-data til Map for rask lookup
    const moduleMap = new Map<string, boolean>();
    moduleData?.forEach(m => {
      const key = `${m.profile_id}-${m.module_name}`;
      moduleMap.set(key, m.enabled);
    });
    
    // Eksisterende mapping av persons...
    const usersWithDetails = profiles.map((userProfile) => {
      // Eksisterende person-matching...
      
      // NY: Map modul-tilgang
      const role = userProfile.role || 'user';
      const isAdminOrManager = role === 'admin' || 
                               role === 'manager' || 
                               role === 'leder' || 
                               role === 'økonomi';
      
      // Business Rule: Admin/Leder/Økonomi har alltid tilgang
      const refusjonAccess = isAdminOrManager 
        ? true 
        : moduleMap.get(`${userProfile.id}-refusjon_hjemmelading`) ?? false;
      
      const befaringAccess = isAdminOrManager 
        ? true 
        : moduleMap.get(`${userProfile.id}-befaring`) ?? false;
      
      // Bemanningsliste er alltid aktiv (business rule)
      const bemanningslisteAccess = true;
      
      const enhancedProfile: UserProfile = {
        ...userProfile,
        role,
        user_email: matchedPerson?.epost ?? "Se auth-system",
        person: matchedPerson ? { ... } : null,
        modules: {
          refusjon: refusjonAccess,
          befaring: befaringAccess,
          bemanningsliste: bemanningslisteAccess,
        },
      };
      
      return enhancedProfile;
    });
    
    setUsers(usersWithDetails);
  } catch (err) {
    console.error("Error loading users:", err);
    toast({
      title: "Feil ved lasting av brukere",
      description: "Kunne ikke laste brukerliste.",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
}, [profile?.org_id, toast]);
```

### Component Structure:
```typescript
// src/components/admin/ModuleAccessCell.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { ModuleIcon } from "./ModuleIcon";

interface ModuleAccessCellProps {
  user: UserProfile;
  onToggle: (moduleName: 'refusjon_hjemmelading' | 'befaring', enabled: boolean) => void;
}

export function ModuleAccessCell({ user, onToggle }: ModuleAccessCellProps) {
  const isAdminOrManager = user.role === 'admin' || 
                           user.role === 'manager' || 
                           user.role === 'leder' || 
                           user.role === 'økonomi';
  
  if (isAdminOrManager) {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        🟢 Alt tilgang
      </Badge>
    );
  }
  
  return (
    <div className="flex items-center gap-3">
      <ModuleIcon 
        module="refusjon_hjemmelading"
        enabled={user.modules.refusjon}
        onToggle={onToggle}
        user={user}
      />
      <ModuleIcon 
        module="befaring"
        enabled={user.modules.befaring}
        onToggle={onToggle}
        user={user}
      />
      <ModuleIcon 
        module="bemanningsliste"
        enabled={true}
        locked
        user={user}
      />
    </div>
  );
}

// src/components/admin/ModuleIcon.tsx
"use client";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ModuleIconProps {
  module: 'refusjon_hjemmelading' | 'befaring' | 'bemanningsliste';
  enabled: boolean;
  locked?: boolean;
  onToggle?: (moduleName: 'refusjon_hjemmelading' | 'befaring', enabled: boolean) => void;
  user: UserProfile;
}

const MODULE_CONFIG = {
  refusjon_hjemmelading: { icon: '💰', label: 'Refusjon' },
  befaring: { icon: '📋', label: 'Befaring' },
  bemanningsliste: { icon: '📅', label: 'Min uke' },
};

export function ModuleIcon({ module, enabled, locked, onToggle, user }: ModuleIconProps) {
  const config = MODULE_CONFIG[module];
  const canToggle = !locked && onToggle && (module === 'refusjon_hjemmelading' || module === 'befaring');
  
  const handleClick = () => {
    if (canToggle && module !== 'bemanningsliste') {
      onToggle(module, !enabled);
    }
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            disabled={!canToggle || user.role === 'inactive'}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors",
              enabled 
                ? "text-green-600 hover:bg-green-50" 
                : "text-gray-400 hover:bg-gray-50",
              !canToggle && "cursor-not-allowed opacity-60",
              user.role === 'inactive' && "cursor-not-allowed opacity-50"
            )}
          >
            <span>{config.icon}</span>
            <span>{enabled ? '✓' : '✗'}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">
            {locked 
              ? 'Alltid tilgjengelig for alle brukere' 
              : enabled 
                ? 'Klikk for å deaktivere' 
                : 'Klikk for å aktivere'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

### Modul-navn Strategi

**Nåværende modul-navn i database:**
- `refusjon_hjemmelading` (spesifikk, brukes allerede)
- `befaring` (generisk)
- `bemanningsliste` (generisk, men vi bruker ikke denne i database)

**Anbefaling:**
- **Behold nåværende navn** for å unngå breaking changes
- **Nye moduler:** Bruk generiske navn (`hms`, `vegnett`, `lagring`, etc.)

### Migrasjons-strategi

**Fra Refusjon Separat Side:**
- **Anbefaling:** Behold `/refusjon/admin/tilgang` side for pricing policies
- Legg til link "Se alle moduler" → `/admin/brukere` i refusjon-tilgang-siden
- Refusjon-side fokuserer på pricing policies, `/admin/brukere` fokuserer på modul-tilgang

## Skalerbarhet

### Når nye moduler legges til:
1. **Database:** Legg til modul-navn i `profile_modules` CHECK constraint
2. **Kode:**
   - Legg til i `MODULE_CONFIG` i `ModuleIcon`
   - Legg til i `UserProfile.modules` interface
   - Legg til i `mapModuleAccess()` funksjon
   - Legg til i `hasModuleAccess()` utility
   - Legg til ikon i `ModuleAccessCell`
   - Oppdater navigasjon med access check

**Fremtidige moduler:**
- HMS (`hms`)
- Vegnett (`vegnett`)
- Lagring/Logistikk (`lagring`)
- Rapporter (`rapporter`)
- etc.

## Fordeler med Sentralisert Løsning

1. **Én kilde til sannhet**: Alt på én side
2. **Bedre oversikt**: Se rolle + moduler samtidig
3. **Mindre navigasjon**: Alt i samme tabell
4. **Raskere arbeidsflyt**: Opprett bruker → sett rolle → aktiver moduler
5. **Skalerbart**: Enkelt å legge til nye moduler

## Ulemper / Utfordringer

1. **Tabell kan bli bred**: Flere kolonner - løses med kompakt visning
2. **Kan bli rotete med mange moduler**: Løses med ikoner + tooltip
3. **Migrasjon fra refusjon-side**: Må håndtere eksisterende brukere (allerede dekket)

## Prioritering

### Høy Prioritet (MVP):
1. ✅ **Fase 1-2:** Database & Data Loading + UI Modul-kolonne
2. ✅ **Fase 3:** Toggle Funksjonalitet
3. ✅ **Fase 6:** Befaring Access Control

### Medium Prioritet:
1. ✅ **Fase 4:** Tooltip/Popover (optional)
2. ✅ **Fase 5:** Access Check Utility (sentralisert)
3. ✅ **Fase 7:** Refusjon Konsolidering

### Lav Prioritet:
1. ✅ **Fase 8:** Testing & Validering (kan gjøres underveis)

## Testplan

### Funksjonelle Tester:
1. **Admin/Leder tilgang:**
   - ✅ Verifiser at admin/leder/økonomi vises med "🟢 Alt tilgang"
   - ✅ Verifiser at toggle blokkeres (vis toast)
   - ✅ Verifiser at de har alltid tilgang til alle moduler i access checks

2. **Bruker toggle:**
   - ✅ Test at brukere kan aktivere refusjon
   - ✅ Test at brukere kan deaktivere refusjon
   - ✅ Test at brukere kan aktivere befaring
   - ✅ Test at brukere kan deaktivere befaring
   - ✅ Verifiser at database oppdateres korrekt
   - ✅ Verifiser at UI oppdateres optimistically

3. **Min uke alltid aktiv:**
   - ✅ Verifiser at "Min uke" alltid vises som aktiv (låst)
   - ✅ Verifiser at toggle blokkeres (vis tooltip)
   - ✅ Verifiser at `/min/uke` alltid er tilgjengelig

4. **Navigasjon oppdatering:**
   - ✅ Test at sidebar-linker skjules når modul deaktiveres
   - ✅ Test at sidebar-linker vises når modul aktiveres
   - ✅ Test at admin/leder/økonomi alltid ser alle lenker

5. **Befaring access:**
   - ✅ Test at `/befaring` blokkerer hvis modul ikke aktivert
   - ✅ Test at `/befaring` gir tilgang hvis modul aktivert
   - ✅ Test at admin/leder/økonomi alltid har tilgang

6. **Refusjon kompatibilitet:**
   - ✅ Test at refusjon-sider fungerer korrekt med ny access check
   - ✅ Test at eksisterende refusjon-tilgang er bevart

### Edge Cases:
1. **Bruker endres til admin/leder/økonomi:**
   - ✅ Test at moduler automatisk aktiveres (optional)

2. **Bruker slettes:**
   - ✅ Test at modul-data slettes (CASCADE)

3. **Network error:**
   - ✅ Test at error håndteres korrekt (vis toast, ikke oppdater local state)

4. **Inaktiv bruker:**
   - ✅ Test at toggle er disabled
   - ✅ Test at moduler vises normalt

## Neste Steg

1. ✅ **Review denne planen** - DONE
2. ⏳ **Implementer Fase 1-3** (Data + UI + Toggle) - MVP
3. ⏳ **Test grundig** - Alle funksjonelle tester
4. ⏳ **Implementer Fase 6** - Befaring access control
5. ⏳ **Implementer Fase 5** - Access check utility (sentralisert)
6. ⏳ **Implementer Fase 7** - Refusjon konsolidering
7. ⏳ **Optional: Fase 4** - Tooltip/popover

## Notater

- **Bemanningsliste:** Ikke lagret i `profile_modules`, bare business rule (alltid aktiv)
- **Admin/Leder/Økonomi:** Kan lagres i database for audit, men toggle må alltid respektere business rules
- **Modul-navn:** Behold `refusjon_hjemmelading` (ikke bare `refusjon`) for konsistens
- **Refusjon-side:** Behold for pricing policies, legg til link til `/admin/brukere` for modul-tilgang
