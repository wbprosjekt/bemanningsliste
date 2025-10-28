# Codex Prompt: Vehicle Compensation for Tripletex Integration

## Context
FieldNote is a staffing and time tracking system that integrates with Tripletex for payroll. We need to add vehicle compensation tracking (service vehicle kilometers, outside-region kilometers, and trailer) when employees drive to project sites.

## Existing System
- Time entries are stored in `vakt_timer` table
- Linked to `vakt` (work assignment) via `vakt_id`
- Each `vakt` is linked to a project (`ttx_project_cache`)
- Time entries are sent to Tripletex API via `/timesheet/entry` endpoint
- The system already handles overtime separately (100% and 50%)

## Requirements

### 1. Database Changes

Create a new table `vehicle_entries` to store vehicle compensation:

```sql
CREATE TABLE vehicle_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vakt_id UUID NOT NULL REFERENCES vakt(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES org(id),
  
  -- Only one of these can be true
  servicebil_oslo_akershus BOOLEAN DEFAULT false,
  km_utenfor_oslo_akershus BOOLEAN DEFAULT false,
  distance_km DECIMAL(10,2) DEFAULT 0, -- Only used if km_utenfor = true
  tilhenger BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE vehicle_entries ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can view vehicle entries in their org
CREATE POLICY "Users can view vehicle entries in their org" 
ON vehicle_entries 
FOR SELECT 
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- RLS policy: Users can create/update vehicle entries in their org
CREATE POLICY "Users can manage vehicle entries in their org" 
ON vehicle_entries 
FOR ALL 
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM profiles WHERE user_id = auth.uid()
  )
);
```

### 2. UI Changes

Add vehicle compensation toggles to:
- `src/components/uke-v2/TimeEntrySheet.tsx` (for "min/uke")
- `src/components/TimeEntry.tsx` (for bemanningsliste)

#### UI Specification

Add these elements **after** the comment field in the time entry form:

```typescript
// New state
const [vehicleServicebil, setVehicleServicebil] = useState(false);
const [vehicleKmUtenfor, setVehicleKmUtenfor] = useState(false);
const [antallKm, setAntallKm] = useState<number>(0);
const [vehicleTilhenger, setVehicleTilhenger] = useState(false);

// Logic: Only one toggle can be active
const handleVehicleToggle = (type: 'servicebil' | 'km' | 'tilhenger') => {
  setVehicleServicebil(false);
  setVehicleKmUtenfor(false);
  setVehicleTilhenger(false);
  
  if (type === 'servicebil') setVehicleServicebil(true);
  if (type === 'km') setVehicleKmUtenfor(true);
  if (type === 'tilhenger') setVehicleTilhenger(true);
};
```

UI Component (after comment field):
```tsx
{/* Vehicle Compensation */}
<div className="space-y-2 mt-4">
  <label className="text-sm text-gray-700 font-medium">Kjøretøy-kompensasjon</label>
  
  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
    <input
      type="checkbox"
      checked={vehicleServicebil}
      onChange={() => handleVehicleToggle('servicebil')}
      className="h-4 w-4"
    />
    <span className="text-sm">Servicebil Oslo/Akershus</span>
  </div>
  
  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
    <input
      type="checkbox"
      checked={vehicleKmUtenfor}
      onChange={() => handleVehicleToggle('km')}
      className="h-4 w-4"
    />
    <span className="text-sm flex-1">Km utenfor Oslo/Akershus</span>
    {vehicleKmUtenfor && (
      <Input
        type="number"
        min="0"
        value={antallKm}
        onChange={(e) => setAntallKm(parseFloat(e.target.value) || 0)}
        placeholder="Antall km"
        className="w-24"
      />
    )}
  </div>
  
  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
    <input
      type="checkbox"
      checked={vehicleTilhenger}
      onChange={() => handleVehicleToggle('tilhenger')}
      className="h-4 w-4"
    />
    <span className="text-sm">Tilhenger</span>
  </div>
</div>
```

### 3. Save Logic

In the `handleSave` function, after saving the main time entry, also save vehicle entry:

```typescript
// Save normal time entry (existing code)
// ... existing save logic ...

// If any vehicle compensation is selected, save that too
if (vehicleServicebil || vehicleKmUtenfor || vehicleTilhenger) {
  await supabase
    .from('vehicle_entries')
    .insert({
      vakt_id: vaktId,
      org_id: orgId,
      servicebil_oslo_akershus: vehicleServicebil,
      km_utenfor_oslo_akershus: vehicleKmUtenfor,
      distance_km: vehicleKmUtenfor ? antallKm : 0,
      tilhenger: vehicleTilhenger
    });
}
```

### 4. Tripletex Integration

#### Setup Required in Tripletex (Manual)

Create these product types (Lønnsarter) in Tripletex:
1. **Servicebil Oslo/Akershus** - Product type: SALARY, Unit: km, Price per km: X kr
2. **Km utenfor Oslo/Akershus** - Product type: SALARY, Unit: km, Price per km: Y kr
3. **Tilhenger** - Product type: SALARY, Unit: km, Price per km: Z kr

Store these Product IDs in the database or environment config.

#### Send to Tripletex

When sending timesheet entries to Tripletex (in `supabase/functions/tripletex-api/index.ts`), after sending the normal time entry, also send vehicle compensation if it exists:

```typescript
// In 'send_timesheet_entry' or 'export-timesheet' action

// 1. Send normal time entry (existing code)
const entryBody = {
  date: entryDate,
  employee: { id: parseInt(employeeData.tripletex_employee_id.toString()) },
  project:  { id: parseInt(entry.projectId.toString()) },
  activity: { id: parseInt(activityData.ttx_id.toString()) },
  hours: parseFloat(entry.hours.toString()),
  comment: entry.comment || ''
};

const normalEntryResult = await callTripletexAPI('/timesheet/entry', 'POST', entryBody, orgId);

// 2. Send vehicle compensation if exists
const { data: vehicleEntry } = await supabase
  .from('vehicle_entries')
  .select('*')
  .eq('vakt_id', vaktId)
  .maybeSingle();

if (vehicleEntry) {
  let productId;
  let quantity = 0;
  
  if (vehicleEntry.servicebil_oslo_akershus) {
    productId = TRIPLETEX_PRODUCT_ID_SERVICEBIL; // From environment/config
  } else if (vehicleEntry.km_utenfor_oslo_akershus) {
    productId = TRIPLETEX_PRODUCT_ID_KM_UTENFOR;
    quantity = vehicleEntry.distance_km;
  } else if (vehicleEntry.tilhenger) {
    productId = TRIPLETEX_PRODUCT_ID_TILHENGER;
  }
  
  if (productId) {
    const vehicleEntryBody = {
      date: entryDate,
      employee: { id: parseInt(employeeData.tripletex_employee_id.toString()) },
      project:  { id: parseInt(entry.projectId.toString()) },
      activity: { id: productId }, // Tripletex Product ID
      hours: 0,
      quantity: quantity,
      comment: `Vehicle compensation - ${vehicleEntry.servicebil_oslo_akershus ? 'Servicebil' : vehicleEntry.km_utenfor_oslo_akershus ? `Km utenfor (${quantity} km)` : 'Tilhenger'}`
    };
    
    const vehicleResult = await callTripletexAPI('/timesheet/entry', 'POST', vehicleEntryBody, orgId);
    
    if (vehicleResult.success) {
      // Store vehicle entry ID for tracking
      await supabase
        .from('vehicle_entries')
        .update({
          tripletex_entry_id: vehicleResult.data?.value?.id
        })
        .eq('id', vehicleEntry.id);
    }
  }
}
```

### 5. Important Constraints

- **Only one vehicle type can be selected** - implement toggle logic in UI
- **Keep existing functionality** - regular time entries and overtime remain unchanged
- **Store vehicle entries per vakt_id** - linked to the project/work assignment
- **Track Tripletex sync status** - similar to how `vakt_timer` tracks `tripletex_entry_id`

### 6. Error Handling

The existing error handling in `callTripletexAPI` will catch and return errors. The system already:
- Logs detailed errors to console
- Returns validation messages from Tripletex
- Handles rate limiting (429 errors)
- Handles period locking

For vehicle entries, implement the same error handling pattern.

## Implementation Order

1. Create database migration for `vehicle_entries` table
2. Add UI toggles to both time entry components
3. Update save logic in both components
4. Add vehicle compensation sending logic to tripletex-api
5. Test with actual Tripletex API

## Testing Checklist

- [ ] Can select servicebil and save
- [ ] Can select km utenfor with distance input
- [ ] Can select tilhenger
- [ ] Only one can be selected at a time
- [ ] Vehicle entry saved to database
- [ ] Vehicle entry sent to Tripletex successfully
- [ ] Error handling works when Tripletex API fails
- [ ] Existing time entry functionality still works
- [ ] Overtime functionality still works

## Notes

- This feature is **separate** from regular time entries
- The vehicle compensation appears as a separate timesheet entry in Tripletex
- It uses `quantity` instead of `hours` in the API call
- Tripletex will calculate the compensation based on the product's unit price
