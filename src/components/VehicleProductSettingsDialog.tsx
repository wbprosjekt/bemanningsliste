'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { VehicleType } from '@/lib/vehicleEntries';

interface VehicleProductSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
}

interface TripletexProductOption {
  id: number;
  name?: string;
  number?: number;
  unit?: string;
  type?: string;
  isService?: boolean;
  isProduct?: boolean;
  isOutlay?: boolean;
}

interface VehicleSelectionState {
  servicebil: string;
  km_utenfor: string;
  tilhenger: string;
}

const VEHICLE_LABELS: Record<VehicleType, string> = {
  servicebil: 'Servicebil Oslo/Akershus',
  km_utenfor: 'Km utenfor Oslo/Akershus',
  tilhenger: 'Tilhenger',
};

const emptySelection: VehicleSelectionState = {
  servicebil: '',
  km_utenfor: '',
  tilhenger: '',
};

export default function VehicleProductSettingsDialog({ open, onOpenChange, orgId }: VehicleProductSettingsDialogProps) {
  const { toast } = useToast();
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<TripletexProductOption[]>([]);
  const [selection, setSelection] = useState<VehicleSelectionState>(emptySelection);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const numberA = a.number ?? 0;
      const numberB = b.number ?? 0;
      if (numberA !== numberB) return numberA - numberB;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [products]);

  useEffect(() => {
    if (!open || !orgId) return;

    const loadConfig = async () => {
      setLoadingConfig(true);
      try {
        const { data, error } = await supabase
          .from('vehicle_products')
          .select('product_type, tripletex_product_id')
          .eq('org_id', orgId);

        if (error) throw error;

        const nextSelection: VehicleSelectionState = { ...emptySelection };
        data?.forEach((item) => {
          const key = item.product_type as VehicleType;
          if (key && item.tripletex_product_id) {
            nextSelection[key] = String(item.tripletex_product_id);
          }
        });

        setSelection(nextSelection);
      } catch (error) {
        console.error('Failed to load vehicle product config:', error);
        toast({
          title: 'Kunne ikke laste konfigurasjon',
          description: error instanceof Error ? error.message : 'Prøv igjen senere',
          variant: 'destructive',
        });
      } finally {
        setLoadingConfig(false);
      }
    };

    const loadProducts = async () => {
      setLoadingProducts(true);
      setFetchError(null);
      try {
        const { data, error } = await supabase.functions.invoke('tripletex-api', {
          body: {
            action: 'list_vehicle_products',
            orgId,
          },
        });

        if (error) throw error;
        if (!data?.success) {
          throw new Error(data?.error || 'Ukjent feil ved henting av produkter');
        }

        const list = Array.isArray(data.data) ? data.data : [];
        setProducts(list as TripletexProductOption[]);
      } catch (error) {
        console.error('Failed to load Tripletex products:', error);
        setFetchError(error instanceof Error ? error.message : 'Kunne ikke hente produkter fra Tripletex');
      } finally {
        setLoadingProducts(false);
      }
    };

    loadConfig();
    loadProducts();
  }, [open, orgId, toast]);

  const handleSelect = (type: VehicleType, productId: string) => {
    setSelection((prev) => ({ ...prev, [type]: productId }));
  };

  const handleSave = async () => {
    if (!orgId) return;

    if (!selection.servicebil || !selection.km_utenfor || !selection.tilhenger) {
      toast({
        title: 'Manglende valg',
        description: 'Velg Tripletex-lønnsarter for alle tre kompensasjonstypene.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = (Object.keys(selection) as VehicleType[]).map((type) => ({
        org_id: orgId,
        product_type: type,
        tripletex_product_id: Number(selection[type]) || 0,
      }));

      const { error } = await supabase
        .from('vehicle_products')
        .upsert(payload, {
          onConflict: 'org_id,product_type',
        });

      if (error) throw error;

      toast({
        title: 'Lagret',
        description: 'Tripletex-lønnsarter ble oppdatert.',
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save vehicle products:', error);
      toast({
        title: 'Kunne ikke lagre',
        description: error instanceof Error ? error.message : 'Prøv igjen senere',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderSelect = (type: VehicleType) => {
    const value = selection[type];
    return (
      <Select value={value} onValueChange={(val) => handleSelect(type, val)} disabled={loadingProducts || saving}>
        <SelectTrigger>
          <SelectValue placeholder="Velg produkt" />
        </SelectTrigger>
        <SelectContent>
          {sortedProducts.map((product) => (
            <SelectItem key={product.id} value={String(product.id)}>
              <div className="flex flex-col">
                <span className="font-medium">{product.name || `Produkt ${product.id}`}</span>
                <span className="text-xs text-muted-foreground">
                  {product.number ? `#${product.number}` : 'Uten nummer'}
                  {product.unit ? ` • ${product.unit}` : ''}
                  {product.type ? ` • ${product.type}` : ''}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Tripletex-lønnsarter for kjøretøy</DialogTitle>
          <DialogDescription>
            Velg hvilke Tripletex-produkter som skal brukes for å beregne kompensasjon når ansatte registrerer servicebil, kilometer og tilhenger.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loadingProducts && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Henter produkter fra Tripletex...
            </div>
          )}

          {fetchError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {fetchError}
              <Button
                variant="link"
                className="ml-2 h-auto p-0 text-destructive"
                onClick={() => {
                  setFetchError(null);
                  setLoadingProducts(true);
                  supabase.functions
                    .invoke('tripletex-api', {
                      body: {
                        action: 'list_vehicle_products',
                        orgId,
                      },
                    })
                    .then(({ data, error }) => {
                      if (error) throw error;
                      if (!data?.success) throw new Error(data?.error || 'Ukjent feil');
                      setProducts(Array.isArray(data.data) ? data.data : []);
                    })
                    .catch((error) => {
                      console.error('Failed to reload Tripletex products:', error);
                      setFetchError(error instanceof Error ? error.message : 'Kunne ikke hente produkter fra Tripletex');
                    })
                    .finally(() => setLoadingProducts(false));
                }}
              >
                Prøv igjen
              </Button>
            </div>
          )}

          {(Object.keys(VEHICLE_LABELS) as VehicleType[]).map((type) => (
            <div key={type} className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {VEHICLE_LABELS[type]}
              </label>
              {renderSelect(type)}
            </div>
          ))}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Avbryt
          </Button>
          <Button onClick={handleSave} disabled={saving || loadingProducts || loadingConfig}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lagre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
