-- Create vehicle compensation tables and policies

DO
$$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'vehicle_type_enum'
  ) THEN
    CREATE TYPE vehicle_type_enum AS ENUM ('servicebil', 'km_utenfor', 'tilhenger');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'vehicle_sync_status_enum'
  ) THEN
    CREATE TYPE vehicle_sync_status_enum AS ENUM ('pending', 'synced', 'failed', 'pending_delete');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS vehicle_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vakt_id UUID NOT NULL REFERENCES vakt(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES org(id) ON DELETE CASCADE,
  vehicle_type vehicle_type_enum NOT NULL,
  distance_km NUMERIC(10,2) NOT NULL DEFAULT 0,
  tripletex_entry_id BIGINT,
  sync_status vehicle_sync_status_enum NOT NULL DEFAULT 'pending',
  sync_log TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_entries_vakt ON vehicle_entries(vakt_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_entries_org ON vehicle_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_entries_sync_status ON vehicle_entries(sync_status);

CREATE TABLE IF NOT EXISTS vehicle_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES org(id) ON DELETE CASCADE,
  product_type vehicle_type_enum NOT NULL,
  tripletex_product_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, product_type)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_products_org ON vehicle_products(org_id);

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS
$$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_vehicle_entries_updated_at
BEFORE UPDATE ON vehicle_entries
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_vehicle_products_updated_at
BEFORE UPDATE ON vehicle_products
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

ALTER TABLE vehicle_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicle_entries_select_same_org"
ON vehicle_entries
FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT org_id
    FROM profiles
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "vehicle_entries_insert_admin"
ON vehicle_entries
FOR INSERT
TO authenticated
WITH CHECK (
  org_id IN (
    SELECT org_id
    FROM profiles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'leder', 'økonomi')
  )
);

CREATE POLICY "vehicle_entries_update_admin"
ON vehicle_entries
FOR UPDATE
TO authenticated
USING (
  org_id IN (
    SELECT org_id
    FROM profiles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'leder', 'økonomi')
  )
)
WITH CHECK (
  org_id IN (
    SELECT org_id
    FROM profiles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'leder', 'økonomi')
  )
);

CREATE POLICY "vehicle_entries_delete_admin"
ON vehicle_entries
FOR DELETE
TO authenticated
USING (
  org_id IN (
    SELECT org_id
    FROM profiles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'leder', 'økonomi')
  )
);

CREATE POLICY "vehicle_products_select_same_org"
ON vehicle_products
FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT org_id
    FROM profiles
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "vehicle_products_manage_admin"
ON vehicle_products
FOR ALL
TO authenticated
USING (
  org_id IN (
    SELECT org_id
    FROM profiles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'leder', 'økonomi')
  )
)
WITH CHECK (
  org_id IN (
    SELECT org_id
    FROM profiles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'leder', 'økonomi')
  )
);
