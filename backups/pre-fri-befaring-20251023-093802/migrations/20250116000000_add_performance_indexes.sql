-- Performance indexes for common queries
-- This migration adds indexes to improve query performance

-- Indexes for vakt table queries
CREATE INDEX IF NOT EXISTS idx_vakt_person_date 
ON public.vakt(person_id, dato);

CREATE INDEX IF NOT EXISTS idx_vakt_org_date 
ON public.vakt(org_id, dato);

CREATE INDEX IF NOT EXISTS idx_vakt_staffing_query 
ON public.vakt(org_id, dato, person_id, project_id);

-- Indexes for vakt_timer table queries
CREATE INDEX IF NOT EXISTS idx_vakt_timer_status 
ON public.vakt_timer(status);

CREATE INDEX IF NOT EXISTS idx_vakt_timer_vakt_id_status 
ON public.vakt_timer(vakt_id, status);

CREATE INDEX IF NOT EXISTS idx_vakt_timer_org_id 
ON public.vakt_timer(org_id);

-- Indexes for person table queries
CREATE INDEX IF NOT EXISTS idx_person_org_aktiv 
ON public.person(org_id, aktiv);

CREATE INDEX IF NOT EXISTS idx_person_tripletex_employee_id 
ON public.person(tripletex_employee_id) WHERE tripletex_employee_id IS NOT NULL;

-- Indexes for project cache queries
CREATE INDEX IF NOT EXISTS idx_ttx_project_cache_org_active 
ON public.ttx_project_cache(org_id, is_active);

CREATE INDEX IF NOT EXISTS idx_ttx_project_cache_tripletex_id 
ON public.ttx_project_cache(tripletex_project_id);

-- Indexes for activity cache queries
CREATE INDEX IF NOT EXISTS idx_ttx_activity_cache_org_aktiv 
ON public.ttx_activity_cache(org_id, aktiv);

CREATE INDEX IF NOT EXISTS idx_ttx_activity_cache_ttx_id 
ON public.ttx_activity_cache(ttx_id) WHERE ttx_id IS NOT NULL;

-- Index for project color lookups
CREATE INDEX IF NOT EXISTS idx_project_color_org_project 
ON public.project_color(org_id, tripletex_project_id);

-- Indexes for calendar queries
CREATE INDEX IF NOT EXISTS idx_kalender_dag_dato 
ON public.kalender_dag(dato);

CREATE INDEX IF NOT EXISTS idx_kalender_dag_week_year 
ON public.kalender_dag(iso_ar, iso_uke);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_log_org_created 
ON public.audit_log(org_id, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record 
ON public.audit_log(table_name, record_id);

-- Indexes for underleverandorer queries
CREATE INDEX IF NOT EXISTS idx_underleverandorer_org_aktiv 
ON public.underleverandorer(org_id, aktiv);

-- Indexes for profiles queries
CREATE INDEX IF NOT EXISTS idx_profiles_user_id 
ON public.profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_org_id 
ON public.profiles(org_id);

-- Composite index for complex staffing queries
CREATE INDEX IF NOT EXISTS idx_vakt_complex_query 
ON public.vakt(org_id, dato, person_id) 
INCLUDE (project_id, id);

-- Index for time entry filtering
CREATE INDEX IF NOT EXISTS idx_vakt_timer_filtering 
ON public.vakt_timer(org_id, status, created_at) 
INCLUDE (timer, vakt_id);
