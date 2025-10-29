import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/integrations/supabase/types';

export type VehicleEntryRow = Database['public']['Tables']['vehicle_entries']['Row'];
export type VehicleSyncStatus = VehicleEntryRow['sync_status'];
export type VehicleType = VehicleEntryRow['vehicle_type'];
export type VehicleTypeOption = VehicleType | 'none';

type VehicleEntriesTable = Database['public']['Tables']['vehicle_entries'];

type SaveVehicleEntryInput = {
  supabase: SupabaseClient<Database>;
  vaktId: string;
  orgId: string;
  vehicleType: VehicleTypeOption;
  distanceKm: number;
  existingEntryId?: string | null;
  existingTripletexEntryId?: number | null;
};

type SaveVehicleEntryResult = {
  id: string | null;
  syncStatus: VehicleSyncStatus | null;
};

const sanitizeDistance = (vehicleType: VehicleTypeOption, distanceKm: number) =>
  vehicleType === 'km_utenfor' ? Math.max(0, Number.isFinite(distanceKm) ? distanceKm : 0) : 0;

export async function saveVehicleEntry({
  supabase,
  vaktId,
  orgId,
  vehicleType,
  distanceKm,
  existingEntryId,
  existingTripletexEntryId,
}: SaveVehicleEntryInput): Promise<SaveVehicleEntryResult> {
  const sanitizedDistance = sanitizeDistance(vehicleType, distanceKm);

  if (vehicleType === 'none') {
    if (!existingEntryId) {
      return { id: null, syncStatus: null };
    }

    if (!existingTripletexEntryId) {
      const { error } = await supabase
        .from('vehicle_entries')
        .delete()
        .eq('id', existingEntryId);

      if (error) throw error;
      return { id: null, syncStatus: null };
    }

    const { error } = await supabase
      .from('vehicle_entries')
      .update({
        sync_status: 'pending_delete' as VehicleSyncStatus,
        sync_log: null,
        distance_km: 0,
      })
      .eq('id', existingEntryId);

    if (error) throw error;
    return { id: existingEntryId, syncStatus: 'pending_delete' };
  }

  if (existingEntryId) {
    const { error } = await supabase
      .from('vehicle_entries')
      .update({
        vehicle_type: vehicleType as VehicleType,
        distance_km: sanitizedDistance,
        sync_status: 'pending' as VehicleSyncStatus,
        sync_log: null,
      })
      .eq('id', existingEntryId);

    if (error) throw error;
    return { id: existingEntryId, syncStatus: 'pending' };
  }

  const { data, error } = await supabase
    .from('vehicle_entries')
    .insert({
      vakt_id: vaktId,
      org_id: orgId,
      vehicle_type: vehicleType as VehicleType,
      distance_km: sanitizedDistance,
      sync_status: 'pending' as VehicleSyncStatus,
    } satisfies VehicleEntriesTable['Insert'])
    .select('id, sync_status')
    .single();

  if (error) throw error;

  return {
    id: data?.id ?? null,
    syncStatus: data?.sync_status ?? 'pending',
  };
}

export async function fetchVehicleEntry(
  supabase: SupabaseClient<Database>,
  vaktId: string
): Promise<VehicleEntryRow | null> {
  const { data, error } = await supabase
    .from('vehicle_entries')
    .select('*')
    .eq('vakt_id', vaktId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}
