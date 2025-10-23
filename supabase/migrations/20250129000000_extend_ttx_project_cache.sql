-- Extend ttx_project_cache with additional Tripletex project details
-- This will cache customer, project manager, and project details to avoid API calls

-- Add customer information fields
ALTER TABLE public.ttx_project_cache 
ADD COLUMN IF NOT EXISTS customer_email TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- Add project manager information fields
ALTER TABLE public.ttx_project_cache 
ADD COLUMN IF NOT EXISTS project_manager_name TEXT,
ADD COLUMN IF NOT EXISTS project_manager_email TEXT,
ADD COLUMN IF NOT EXISTS project_manager_phone TEXT;

-- Add project details fields
ALTER TABLE public.ttx_project_cache 
ADD COLUMN IF NOT EXISTS project_description TEXT,
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT false;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ttx_project_cache_customer_email 
ON public.ttx_project_cache(customer_email);

CREATE INDEX IF NOT EXISTS idx_ttx_project_cache_project_manager_email 
ON public.ttx_project_cache(project_manager_email);

CREATE INDEX IF NOT EXISTS idx_ttx_project_cache_dates 
ON public.ttx_project_cache(start_date, end_date);

-- Add comment to document the purpose
COMMENT ON TABLE public.ttx_project_cache IS 'Cached Tripletex project data including customer, project manager, and project details to minimize API calls';
