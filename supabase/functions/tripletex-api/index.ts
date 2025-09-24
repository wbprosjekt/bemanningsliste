import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TripletexConfig {
  consumerToken: string;
  employeeToken: string;
  baseUrl: string;
}

interface TripletexResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface TripletexEmployeeRecord {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  isActive?: boolean;
}

interface TripletexListMeta {
  isLastPage?: boolean;
  nextPage?: number | null;
  page?: number;
  totalPages?: number;
  numberOfPages?: number;
  totalCount?: number;
  countTotal?: number;
  totalMatches?: number;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Helper utilities for safe logging
function maskToken(token: string): string {
  if (!token) return '';
  return token.length <= 8 ? '****' : `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function maskAuthHeader(auth?: string): string {
  if (!auth) return '';
  if (auth.startsWith('Basic ')) return 'Basic ****';
  return '****';
}

function safeBody(body: unknown) {
  if (!body) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(body)) {
    out[k] = k.toLowerCase().includes('token') ? '***masked***' : (body as Record<string, unknown>)[k];
  }
  return out;
}

// Extract token from base64-encoded JSON if needed
function extractTokenFromBase64(base64Token: string): string {
  if (!base64Token) return base64Token;
  try {
    const decoded = atob(base64Token);
    const parsed = JSON.parse(decoded);
    return parsed.token || base64Token;
  } catch {
    return base64Token;
  }
}

async function getTripletexConfig(orgId: string): Promise<TripletexConfig> {
  console.log('getTripletexConfig called with orgId:', orgId);
  
  // First, try to get tokens from integration settings for this org
  const { data: settings, error } = await supabase
    .from('integration_settings')
    .select('settings')
    .eq('org_id', orgId)
    .eq('integration_type', 'tripletex')
    .maybeSingle();
  
  console.log('Integration settings query result:', { settings, error });

  if (settings?.settings) {
    const orgSettings = settings.settings as { consumer_token?: string; employee_token?: string; api_base_url?: string };
    console.log('Processing org settings:', { ...orgSettings, consumer_token: orgSettings.consumer_token ? '***masked***' : undefined, employee_token: orgSettings.employee_token ? '***masked***' : undefined });
    if (orgSettings.consumer_token && orgSettings.employee_token) {
      const config = {
        consumerToken: orgSettings.consumer_token,
        employeeToken: orgSettings.employee_token,
        baseUrl: orgSettings.api_base_url || 'https://api-test.tripletex.tech/v2'
      };
      console.log('Returning config:', { hasConsumerToken: !!config.consumerToken, hasEmployeeToken: !!config.employeeToken, baseUrl: config.baseUrl });
      return config;
    }
  }

  // Fallback to environment variables (legacy)
  const fallbackConfig = {
    consumerToken: Deno.env.get('TRIPLETEX_CONSUMER_TOKEN') ?? '',
    employeeToken: Deno.env.get('TRIPLETEX_EMPLOYEE_TOKEN') ?? '',
    baseUrl: Deno.env.get('TRIPLETEX_API_BASE') ?? 'https://api-test.tripletex.tech/v2'
  };
  console.log('Using fallback config (env vars):', {
    hasConsumerToken: !!fallbackConfig.consumerToken,
    hasEmployeeToken: !!fallbackConfig.employeeToken,
    baseUrl: fallbackConfig.baseUrl
  });
  return fallbackConfig;
}

// Create or reuse a Tripletex session token for this org
async function getOrCreateSession(orgId: string): Promise<{ token: string; expirationDate: string; companyId: number }> {
  const config = await getTripletexConfig(orgId);
  if (!config.consumerToken || !config.employeeToken) {
    throw new Error('Tripletex tokens not configured for this organization');
  }

  // Read existing settings to check cached session
  const { data: row, error: readErr } = await supabase
    .from('integration_settings')
    .select('id, settings')
    .eq('org_id', orgId)
    .eq('integration_type', 'tripletex')
    .maybeSingle();

  if (readErr) {
    console.error('Error reading integration settings for session:', readErr);
  }

  const currentSettings = (row?.settings as Record<string, unknown>) || {};
  const now = new Date();

  // Check if we have a valid cached session with companyId
  if (currentSettings.session_token && currentSettings.session_expires_at && currentSettings.company_id) {
    const expiresAt = new Date(currentSettings.session_expires_at);
    // Add 60s safety margin
    if (expiresAt.getTime() - 60000 > now.getTime()) {
      return { 
        token: String(currentSettings.session_token), 
        expirationDate: expiresAt.toISOString().split('T')[0],
        companyId: Number(currentSettings.company_id)
      };
    }
  }

  // Create new session
  const defaultDays = Number(Deno.env.get('SESSION_DEFAULT_DAYS') ?? '7');
  const expirationDate = new Date(Date.now() + defaultDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Use base64 tokens directly (don't decode)
  const consumerToken = config.consumerToken;
  const employeeToken = config.employeeToken;

  // Build URL with query params as per requirement
  const sessionUrl = new URL(`${config.baseUrl}/token/session/:create`);
  sessionUrl.searchParams.set('consumerToken', consumerToken);
  sessionUrl.searchParams.set('employeeToken', employeeToken);
  sessionUrl.searchParams.set('expirationDate', expirationDate);

  console.log('Creating new Tripletex session for org', orgId, 'expiring', expirationDate);
  console.log('Tripletex session request', {
    url: sessionUrl.toString().replace(consumerToken, '***masked***').replace(employeeToken, '***masked***'),
    method: 'PUT',
    queryParams: {
      consumerToken: maskToken(consumerToken),
      employeeToken: maskToken(employeeToken),
      expirationDate
    }
  });

  const resp = await fetch(sessionUrl.toString(), {
    method: 'PUT'
    // No body or headers needed - all in query params
  });

  const text = await resp.text();
  let data: unknown = {};
  try { 
    data = JSON.parse(text); 
  } catch (error) {
    console.debug('Failed to parse JSON response:', error);
  }

  console.log('Tripletex session response', { 
    status: resp.status, 
    success: resp.ok,
    bodyLen: text.length 
  });

  if (!resp.ok) {
    const errorMsg = data?.message || 'Unknown error';
    console.error('Failed to create Tripletex session:', { 
      status: resp.status, 
      error: errorMsg,
      validationMessages: data?.validationMessages || []
    });
    
    // Handle specific error codes
    if (resp.status === 401) {
      throw new Error('Ugyldig API-nøkler. Sjekk consumer_token og employee_token.');
    } else if (resp.status === 422) {
      const validationErrors = data?.validationMessages?.map(v => v.message).join(', ') || 'Valideringsfeil';
      throw new Error(`Valideringsfeil fra Tripletex: ${validationErrors}`);
    } else {
      throw new Error(errorMsg || `HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }
  }

  // Extract token and companyId from response
  const token = data?.value?.token ?? data?.token ?? data?.value?.[0]?.token;
  const companyId = data?.value?.loggedInEmployeeId ?? data?.loggedInEmployeeId ?? data?.value?.employee?.company?.id ?? 0;
  const exp = data?.value?.expirationDate ?? data?.expirationDate ?? expirationDate;

  if (!token) {
    console.error('Tripletex session response missing token:', data);
    throw new Error('Tripletex returnerte ikke en session token');
  }

  // Persist session token and companyId into settings
  const newSettings = {
    ...currentSettings,
    session_token: token,
    session_expires_at: exp,
    company_id: companyId
  };

  const { error: writeErr } = await supabase
    .from('integration_settings')
    .update({ settings: newSettings })
    .eq('id', row?.id as string);

  if (writeErr) {
    console.error('Failed saving session token to settings:', writeErr);
  }

  return { token: String(token), expirationDate: String(exp), companyId: Number(companyId) };
}

async function callTripletexAPI(endpoint: string, method: string = 'GET', body?: unknown, orgId?: string): Promise<TripletexResponse> {
  const config = await getTripletexConfig(orgId || '');
  if (!config.consumerToken || !config.employeeToken) {
    return { success: false, error: 'Tripletex tokens not configured for this organization' };
  }
  const url = `${config.baseUrl}${endpoint}`;
  let headers: Record<string, string> = { 
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};;

  // Use session token for all non-session endpoints
  if (!endpoint.startsWith('/token/session')) {
    try {
      const session = await getOrCreateSession(orgId!);
      headers = {
        ...headers,
        Authorization: `Basic ${btoa(`${session.companyId}:${session.token}`)}`
      };
    } catch (e) {
      return { success: false, error: (e as Error).message || 'Failed to create session' };
    }
  }

  try {
    console.log(`Calling Tripletex API: ${method} ${url}`);
    console.log('Tripletex request headers', { hasAuth: !!headers.Authorization, auth: maskAuthHeader(headers.Authorization) });
    
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const text = await response.text();
    let responseData: unknown = {};
    try { 
      responseData = JSON.parse(text); 
    } catch (error) {
      console.debug('Failed to parse JSON response:', error);
    }

    console.log('Tripletex API response', { status: response.status, url });

    if (!response.ok) {
      // Optional: throw on 429/5xx to let exponentialBackoff handle it
      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        const err: Error = new Error(responseData?.message || `HTTP ${response.status}`);
        err.status = response.status;
        throw err;
      }
      console.error('Tripletex API error:', response.status, responseData);
      return { 
        success: false, 
        error: responseData?.message || `HTTP ${response.status}` 
      };
    }

    return { success: true, data: responseData };
  } catch (error: unknown) {
    console.error('Network error calling Tripletex API:', error);
    return { success: false, error: error.message ?? String(error) };
  }
}

async function fetchAllTripletexEmployees(orgId: string) {
  const pageSize = 100;
  let currentPage = 0;
  const employees: TripletexEmployeeRecord[] = [];
  const visitedPages = new Set<number>();
  let totalFromMeta: number | undefined;
  let pagesFetched = 0;

  while (pagesFetched < 100) { // safety guard to avoid infinite loops
    if (visitedPages.has(currentPage)) {
      console.warn('Pagination loop detected while fetching Tripletex employees', { orgId, currentPage });
      break;
    }

    visitedPages.add(currentPage);
    pagesFetched += 1;

    const response = await callTripletexAPI(`/employee?count=${pageSize}&page=${currentPage}`, 'GET', undefined, orgId);
    if (!response.success) {
      return {
        success: false,
        error: response.error,
        meta: { pagesFetched, totalFromMeta }
      } as const;
    }

    const pageEmployees = Array.isArray(response.data?.values)
      ? (response.data.values as TripletexEmployeeRecord[])
      : [];

    employees.push(...pageEmployees);

    const meta = response.data?.meta as TripletexListMeta | undefined;
    const links = (response.data?.links || response.data?._links) as { next?: string | null } | undefined;
    if (typeof meta?.totalCount === 'number') {
      totalFromMeta = meta.totalCount;
    } else if (typeof meta?.countTotal === 'number') {
      totalFromMeta = meta.countTotal;
    } else if (typeof meta?.totalMatches === 'number') {
      totalFromMeta = meta.totalMatches;
    }

    const expectedTotal = totalFromMeta;
    const collectedCount = employees.length;

    const isLastPage = meta?.isLastPage === true
      || pageEmployees.length < pageSize
      || (typeof expectedTotal === 'number' && collectedCount >= expectedTotal)
      || (typeof meta?.totalPages === 'number' && (meta.page ?? currentPage) >= meta.totalPages - 1)
      || (typeof meta?.numberOfPages === 'number' && (meta.page ?? currentPage) >= meta.numberOfPages - 1)
      || meta?.nextPage === null;

    if (isLastPage) {
      break;
    }

    if (typeof meta?.nextPage === 'number') {
      currentPage = meta.nextPage;
    } else {
      let nextFromLink: number | undefined;
      const linkCandidate = links?.next;
      if (typeof linkCandidate === 'string') {
        try {
          const parsed = new URL(linkCandidate, 'https://dummy.tripletex.local');
          const pageParam = parsed.searchParams.get('page');
          if (pageParam !== null) {
            const parsedPage = Number(pageParam);
            if (!Number.isNaN(parsedPage)) {
              nextFromLink = parsedPage;
            }
          }
        } catch (error) {
          console.warn('Failed to parse Tripletex pagination link', { error, linkCandidate });
        }
      }

      currentPage = typeof nextFromLink === 'number' ? nextFromLink : currentPage + 1;
    }
  }

  return {
    success: true,
    employees,
    meta: {
      pagesFetched,
      totalFromMeta
    }
  } as const;
}

// === helpers: participant & activity checks ===
async function getProjectParticipantIds(orgId: string, projectId: number) {
  const res = await callTripletexAPI(`/project/${projectId}`, 'GET', undefined, orgId);
  if (!res.success) return [];
  const ids = (res.data?.value?.participants || []).map((p: unknown) => (p as { id: number }).id).filter((x: unknown) => typeof x === 'number');
  return ids;
}

async function isEmployeeParticipant(orgId: string, projectId: number, employeeId: number) {
  const ids = await getProjectParticipantIds(orgId, projectId);
  for (const pid of ids) {
    const p = await callTripletexAPI(`/project/participant/${pid}`, 'GET', undefined, orgId);
    const pEmpId = p?.data?.value?.employee?.id;
    if (p.success && Number(pEmpId) === Number(employeeId)) {
      return { found: true, participantId: pid };
    }
  }
  return { found: false };
}

async function ensureParticipant(orgId: string, projectId: number, employeeId: number) {
  const existing = await isEmployeeParticipant(orgId, projectId, employeeId);
  if (existing.found) return { ok: true, participantId: existing.participantId };

  const body = { project: { id: Number(projectId) }, employee: { id: Number(employeeId) } };
  const addRes = await callTripletexAPI('/project/participant', 'POST', body, orgId);

  const after = await isEmployeeParticipant(orgId, projectId, employeeId);
  if (after.found) return { ok: true, participantId: after.participantId };

  return { ok: false, reason: addRes.error || 'could_not_add_participant' };
}

async function ensureActivityOnProject(orgId: string, projectId: number, activityId: number) {
  const res = await callTripletexAPI(`/activity?project.id=${projectId}&count=1000`, 'GET', undefined, orgId);
  if (!res.success) return { ok: false, reason: res.error || 'activity_lookup_failed' };
  const list = res.data?.values || [];
  const found = list.some((a: unknown) => Number((a as { id: number })?.id) === Number(activityId));
  return { ok: found, reason: found ? undefined : 'activity_not_on_project' };
}
// === end helpers ===

async function exponentialBackoff(fn: () => Promise<unknown>, maxRetries: number = 3): Promise<unknown> {
  let delay = 1000; // Start with 1 second
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      if (i === maxRetries - 1) throw error;
      
      const status = error?.status;
      if (status === 429 || (status >= 500 && status < 600)) {
        console.log(`Retrying after ${delay}ms (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        throw error; // Don't retry for other errors
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Try to extract action and orgId from URL or request body (supports both styles)
    let action = url.searchParams.get('action');
    let orgId = url.searchParams.get('orgId');

    let payload: unknown = {};
    try {
      // Try to read JSON body once and reuse for all cases
      payload = await req.json();
    } catch (_) {
      // No JSON body provided
    }

    if (!action) {
      if (payload?.action) action = payload.action;
      else if (payload?.params) {
        const p = new URLSearchParams(payload.params as string);
        action = p.get('action') || action;
        orgId = orgId || p.get('orgId') || undefined;
      }
    }

    if (!orgId && payload?.orgId) orgId = payload.orgId;

    if (!action || !orgId) {
      return new Response(JSON.stringify({ error: 'Missing action or orgId parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('tripletex-api invoked', { action, orgId });
    let result: TripletexResponse;

    switch (action) {
      case 'check-config': {
        const checkConfig = await getTripletexConfig(orgId);
        result = {
          success: true,
          data: {
            hasConsumerToken: !!checkConfig.consumerToken,
            hasEmployeeToken: !!checkConfig.employeeToken,
            baseUrl: checkConfig.baseUrl
          }
        };
        break;
      }

      case 'test-session': {
        try {
          console.log(`Testing session creation for org ${orgId}`);
          const session = await getOrCreateSession(orgId);
          console.log(`Session test successful: token length=${session.token.length}, expires=${session.expirationDate}`);
          result = { 
            success: true, 
            data: { 
              token: maskToken(session.token), 
              expirationDate: session.expirationDate,
              tokenLength: session.token.length
            } 
          };
        } catch (e: unknown) {
          console.error('Session test failed:', e instanceof Error ? e.message : 'Unknown error');
          result = { success: false, error: e instanceof Error ? e.message : 'Failed to create session' };
        }
        break;
      }

      case 'sync-employees': {
        result = await exponentialBackoff(async () => {
          const employeeFetch = await fetchAllTripletexEmployees(orgId);
          if (!employeeFetch.success) {
            return { success: false, error: employeeFetch.error };
          }

          const rawEmployees = employeeFetch.employees ?? [];

          if (rawEmployees.length === 0) {
            console.log(`Syncing 0 employees for org ${orgId}`);
          } else {
            console.log(`Syncing ${rawEmployees.length} employees for org ${orgId}`, {
              pagesFetched: employeeFetch.meta?.pagesFetched,
              totalFromMeta: employeeFetch.meta?.totalFromMeta
            });
          }

          // Cache employees in database
          const employees = rawEmployees.map((emp: TripletexEmployeeRecord) => ({
            org_id: orgId,
            tripletex_employee_id: emp.id,
            fornavn: emp.firstName || '',
            etternavn: emp.lastName || '',
            epost: emp.email,
            aktiv: emp.isActive !== false, // Default to true if undefined
            last_synced: new Date().toISOString()
          }));

          const { error: upsertError } = await supabase
            .from('ttx_employee_cache')
            .upsert(employees, { 
              onConflict: 'org_id,tripletex_employee_id',
              ignoreDuplicates: false 
            });

          if (upsertError) {
            console.error('Error upserting employees:', upsertError);
            return { success: false, error: `Database error: ${upsertError.message}` };
          }

          // Create person records for each employee
          const persons = employees.map((emp) => ({
            org_id: orgId,
            fornavn: emp.fornavn,
            etternavn: emp.etternavn,
            epost: emp.epost,
            tripletex_employee_id: emp.tripletex_employee_id,
            aktiv: emp.aktiv,
            person_type: 'ansatt'
          }));

          if (persons.length > 0) {
            const { error: personError } = await supabase
              .from('person')
              .upsert(persons, {
                onConflict: 'org_id,tripletex_employee_id',
                ignoreDuplicates: false
              });

            if (personError) {
              console.error('Error upserting persons:', personError);
              return { success: false, error: `Person creation error: ${personError.message}` };
            }
          }

          // Auto-create profiles for employees with valid email addresses
          let profilesCreated = 0;
          const validEmployees = employees.filter(emp => 
            emp.epost && 
            emp.epost.includes('@') && 
            emp.aktiv
          );

          for (const emp of validEmployees) {
            try {
              // Check if profile already exists for this email
              const { data: existingProfiles } = await supabase
                .from('profiles')
                .select('id')
                .eq('org_id', orgId)
                .eq('display_name', `${emp.fornavn} ${emp.etternavn}`)
                .single();

              if (!existingProfiles) {
                // Create a placeholder profile that will be claimed when user signs up
                const profileId = crypto.randomUUID();
                
                const { error: profileError } = await supabase
                  .from('profiles')
                  .insert({
                    id: profileId,
                    user_id: profileId, // Temporary - will be updated when user actually signs up
                    org_id: orgId,
                    display_name: `${emp.fornavn} ${emp.etternavn}`,
                    role: 'user'
                  });

                if (!profileError) {
                  profilesCreated++;
                  console.log(`Created profile for ${emp.fornavn} ${emp.etternavn}`);
                }
              }
            } catch (profileErr) {
              console.error(`Failed to create profile for ${emp.fornavn} ${emp.etternavn}:`, profileErr);
            }
          }

          console.log(`Successfully synced ${employees.length} employees and created ${profilesCreated} profiles`);
          return { 
            success: true, 
            data: { 
              employees: employees.length,
              profilesCreated: profilesCreated,
              validEmails: validEmployees.length
            } 
          };
        });
        break;
      }

      case 'sync-projects': {
        result = await exponentialBackoff(async () => {
          const response = await callTripletexAPI('/project?count=100', 'GET', undefined, orgId);
          if (response.success && response.data?.values) {
            console.log(`Syncing ${response.data.values.length} projects for org ${orgId}`);
            
            // Cache projects in database
            const projects = response.data.values.map((proj: unknown) => {
              const project = proj as { id: number; number?: string; displayName?: string; name?: string; customer?: { name?: string }; isActive?: boolean };
              return {
                org_id: orgId,
                tripletex_project_id: project.id,
                project_number: project.number,
                project_name: project.displayName || project.name,
                customer_name: project.customer?.name,
                is_active: project.isActive !== false, // Default to true if undefined
                last_synced: new Date().toISOString()
              };
            });

            const { error: upsertError } = await supabase
              .from('ttx_project_cache')
              .upsert(projects, { 
                onConflict: 'org_id,tripletex_project_id',
                ignoreDuplicates: false 
              });

            if (upsertError) {
              console.error('Error upserting projects:', upsertError);
              return { success: false, error: `Database error: ${upsertError.message}` };
            }

            console.log(`Successfully synced ${projects.length} projects`);
            return { success: true, data: { count: projects.length } };
          }
          return response;
        });
        break;
      }

      case 'sync-activities': {
        result = await exponentialBackoff(async () => {
          const response = await callTripletexAPI('/activity?count=1000', 'GET', undefined, orgId);
          if (response.success && response.data?.values) {
            // Cache activities in database
            const activities = response.data.values.map((act: unknown) => {
              const activity = act as { id: number; name?: string; isActive?: boolean };
              return {
                org_id: orgId,
                ttx_id: activity.id,
                navn: activity.name,
                aktiv: activity.isActive,
                last_synced: new Date().toISOString()
              };
            });

            const { error: upsertError } = await supabase
              .from('ttx_activity_cache')
              .upsert(activities, { 
                onConflict: 'org_id,ttx_id',
                ignoreDuplicates: false 
              });

            if (upsertError) {
              console.error('Error upserting activities:', upsertError);
              return { success: false, error: upsertError.message };
            }

            return { success: true, data: { count: activities.length } };
          }
          return response;
        });
        break;
      }

      case 'search-projects': {
        const query = url.searchParams.get('q') || '';
        result = await callTripletexAPI(`/project?count=50&displayName=${encodeURIComponent(query)}`, 'GET', undefined, orgId);
        
        // Cache search results
        if (result.success && result.data?.values) {
          const projects = result.data.values.map((proj: unknown) => {
            const project = proj as { id: number; number?: string; displayName?: string; name?: string; customer?: { name?: string }; isActive?: boolean };
            return {
              org_id: orgId,
              tripletex_project_id: project.id,
              project_number: project.number,
              project_name: project.displayName || project.name,
              customer_name: project.customer?.name,
              is_active: project.isActive,
              last_synced: new Date().toISOString()
            };
          });

          await supabase
            .from('ttx_project_cache')
            .upsert(projects, { 
              onConflict: 'org_id,tripletex_project_id',
              ignoreDuplicates: false 
            });
        }
        break;
      }

      case 'export-timesheet': {
        const timesheetEntries = payload?.timesheetEntries;
        const dryRun = payload?.dryRun === true;

        if (!timesheetEntries || !Array.isArray(timesheetEntries)) {
          return new Response(JSON.stringify({ error: 'Missing timesheetEntries array' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const exportResults = [];

        for (const entry of timesheetEntries) {
          try {
            // Map employee and activity IDs from cache tables
            const { data: employeeData } = await supabase
              .from('person')
              .select('tripletex_employee_id')
              .eq('id', entry.personId)
              .eq('org_id', orgId)
              .single();

            // Query activity data from cache
            const { data: activityData } = await supabase
              .from('ttx_activity_cache')
              .select('ttx_id')
              .eq('ttx_id', entry.activityId)
              .eq('org_id', orgId)
              .single();

            if (!employeeData?.tripletex_employee_id) {
              exportResults.push({ 
                id: entry.id, 
                success: false, 
                error: 'Ansatt ikke koblet til Tripletex - synkroniser ansatte først' 
              });
              continue;
            }

            if (!activityData?.ttx_id) {
              exportResults.push({ 
                id: entry.id, 
                success: false, 
                error: 'Aktivitet ikke funnet - synkroniser aktiviteter først' 
              });
              continue;
            }

            // Bygg Tripletex-entry for /timesheet/entry (ett og ett objekt)
            const entryDate = entry.date;
            const entryBody = {
              date: entryDate,
              employee: { id: parseInt(employeeData.tripletex_employee_id.toString()) },
              project:  { id: parseInt(entry.projectId.toString()) },
              activity: { id: parseInt(activityData.ttx_id.toString()) },
              hours: parseFloat(entry.hours.toString()),
              comment: entry.comment || ''
            };

            if (dryRun) {
              exportResults.push({ id: entry.id, success: true, dryRun: true, payload: entryBody });
              continue;
            }

            // Viktig: riktig endpoint
            const exportResult = await exponentialBackoff(async () => {
              return await callTripletexAPI('/timesheet/entry', 'POST', entryBody, orgId);
            });

            if (exportResult.success) {
              await supabase
                .from('vakt_timer')
                .update({
                  tripletex_entry_id: exportResult.data?.value?.id,
                  status: 'sendt'
                })
                .eq('id', entry.id);

              exportResults.push({ id: entry.id, success: true, tripletexId: exportResult.data?.value?.id });
            } else {
              if (exportResult.error?.includes('locked') || exportResult.error?.includes('låst') || exportResult.error?.includes('period is closed')) {
                exportResults.push({ id: entry.id, success: false, error: 'Periode er låst i Tripletex - kontakt lønn', errorType: 'period_locked' });
              } else {
                exportResults.push({ id: entry.id, success: false, error: exportResult.error });
              }
            }
          } catch (error: unknown) {
            console.error(`Error exporting timesheet entry ${entry.id}:`, error);
            exportResults.push({ 
              id: entry.id, 
              success: false, 
              error: error.message 
            });
          }
        }

        result = { success: true, data: { results: exportResults } };
        break;
      }

      case 'verify-timesheet-entry': {
        const tripletexEntryId = payload?.tripletexEntryId;

        if (!tripletexEntryId) {
          return new Response(JSON.stringify({ error: 'Missing tripletexEntryId' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const verifyResult = await callTripletexAPI(`/timesheet/entry/${tripletexEntryId}`, 'GET', undefined, orgId);
        result = { 
          success: true, 
          data: { 
            exists: verifyResult.success,
            entry: verifyResult.data?.value || null 
          }
        };
        break;
      }

      case 'send_timesheet_entry': {
        const { vakt_timer_id, employee_id, project_id, activity_id, hours, date, is_overtime, description } = payload;
        
        if (!vakt_timer_id || !employee_id || !project_id || !hours || !date) {
          result = { success: false, error: 'Missing required fields for timesheet entry' };
          break;
        }

        result = await exponentialBackoff(async () => {
          console.log('Preflight IDs', { employeeId: employee_id, projectId: project_id, activityId: activity_id });

          // 1) Finnes entiteter?
          const employeeCheck = await callTripletexAPI(`/employee/${employee_id}`, 'GET', undefined, orgId);
          if (!employeeCheck.success) {
            return { success: false, error: 'Tripletex-ID finnes ikke', missing: 'employee', id: employee_id };
          }
          const projectCheck = await callTripletexAPI(`/project/${project_id}`, 'GET', undefined, orgId);
          if (!projectCheck.success) {
            return { success: false, error: 'Tripletex-ID finnes ikke', missing: 'project', id: project_id };
          }
          if (activity_id) {
            const activityCheck = await callTripletexAPI(`/activity/${activity_id}`, 'GET', undefined, orgId);
            if (!activityCheck.success) {
              return { success: false, error: 'Tripletex-ID finnes ikke', missing: 'activity', id: activity_id };
            }
          }

          // 2) Sørg for deltaker
          const part = await ensureParticipant(orgId, Number(project_id), Number(employee_id));
          if (!part.ok) {
            return { success: false, error: 'employee_not_participant', projectId: project_id, employeeId: employee_id, details: part.reason };
          }

          // 3) Sjekk at aktiviteten hører til prosjektet (hvis satt)
          if (activity_id) {
            const actOk = await ensureActivityOnProject(orgId, Number(project_id), Number(activity_id));
            if (!actOk.ok) {
              return { success: false, error: 'activity_not_on_project', projectId: project_id, activityId: activity_id, details: actOk.reason };
            }
          }

          console.log('All preflight checks passed - proceeding with timesheet submission');

          // 4) Bygg korrekt payload for /timesheet/entry (IKKE array, IKKE clientReference, IKKE count/description)
          const entryDate = new Date(date).toISOString().split('T')[0];
          const hoursNumber = parseFloat(hours.toString().replace(',', '.'));

          // For overtime entries, use the correct wageTypeCode
          // 2007 = Overtid 50%, 2008 = Overtid 100%
          let wageTypeCode = undefined;
          
          if (is_overtime) {
            // For now, default to 100% overtime (2008)
            // TODO: Determine overtime percentage based on system logic
            wageTypeCode = '2008'; // Overtid 100%
            console.log('Overtime entry detected - using wageTypeCode:', wageTypeCode);
          }

          const entryPayload = {
            date: entryDate,
            employee: { id: Number(employee_id) },
            project:  { id: Number(project_id) },
            ...(activity_id ? { activity: { id: Number(activity_id) } } : {}),
            hours: hoursNumber,
            comment: description || '',
            // Add wageTypeCode for overtime entries using existing Tripletex wage types
            ...(wageTypeCode ? { wageTypeCode: wageTypeCode } : {})
          };

          console.log('POST /timesheet/entry with payload:', { 
            ...entryPayload, 
            employee: '***', 
            project: '***',
            is_overtime: is_overtime,
            wageTypeCode: wageTypeCode,
            note: 'Using existing Tripletex wage types: 2007=50% overtime, 2008=100% overtime'
          });

          const response = await callTripletexAPI('/timesheet/entry', 'POST', entryPayload, orgId);

          console.log('Tripletex API response:', { 
            success: response.success, 
            status: response.status,
            hasData: !!response.data,
            isOvertime: is_overtime,
            wageTypeCode: wageTypeCode,
            error: response.error,
            fullResponse: response,
            note: 'Testing wageTypeCode parameter with existing Tripletex wage types'
          });

          const createdId = response?.data?.value?.id;
          if (response.success && createdId) {
            const { error: updateError } = await supabase
              .from('vakt_timer')
              .update({
                tripletex_entry_id: createdId,
                tripletex_synced_at: new Date().toISOString(),
                sync_error: null,
                status: 'sendt'
              })
              .eq('id', vakt_timer_id);

            if (updateError) {
              console.error('Failed to update vakt_timer after sync:', updateError);
              return { success: true, data: response.data, warning: 'Tripletex ok, men lokal status ikke oppdatert' };
            }

            return { success: true, data: { tripletex_id: createdId, message: 'Timesheet entry created' } };
          }

          await supabase
            .from('vakt_timer')
            .update({ sync_error: response.error || 'Unknown error', tripletex_synced_at: null })
            .eq('id', vakt_timer_id);

          return response;
        });
        break;
      }

      case 'approve_timesheet_entries': {
        const { entry_ids, approved_by_user_id } = payload;
        
        if (!entry_ids || !Array.isArray(entry_ids) || entry_ids.length === 0) {
          result = { success: false, error: 'Missing or invalid entry_ids array' };
          break;
        }

        try {
          const { error: approveError } = await supabase
            .from('vakt_timer')
            .update({
              status: 'godkjent',
              approved_at: new Date().toISOString(),
              approved_by: approved_by_user_id
            })
            .in('id', entry_ids)
            .eq('org_id', orgId);

          if (approveError) {
            result = { success: false, error: `Failed to approve entries: ${approveError.message}` };
          } else {
            result = { 
              success: true, 
              data: { 
                approved_count: entry_ids.length,
                message: `${entry_ids.length} timesheet entries approved`
              } 
            };
          }
        } catch (e: unknown) {
          result = { success: false, error: e instanceof Error ? e.message : 'Failed to approve entries' };
        }
        break;
      }

      case 'unapprove_timesheet_entries': {
        const { entry_ids: unapproveIds } = payload;
        
        if (!unapproveIds || !Array.isArray(unapproveIds) || unapproveIds.length === 0) {
          result = { success: false, error: 'Missing or invalid entry_ids array' };
          break;
        }

        try {
          const { error: unapproveError } = await supabase
            .from('vakt_timer')
            .update({
              status: 'utkast',
              approved_at: null,
              approved_by: null
            })
            .in('id', unapproveIds)
            .eq('org_id', orgId);

          if (unapproveError) {
            result = { success: false, error: `Failed to unapprove entries: ${unapproveError.message}` };
          } else {
            result = { 
              success: true, 
              data: { 
                unapproved_count: unapproveIds.length,
                message: `${unapproveIds.length} timesheet entries set back to draft`
              } 
            };
          }
        } catch (e: unknown) {
          result = { success: false, error: e instanceof Error ? e.message : 'Failed to unapprove entries' };
        }
        break;
      }

      case 'delete_timesheet_entry': {
        const { tripletex_entry_id, vakt_timer_id: deleteVaktTimerId } = payload;
        
        if (!tripletex_entry_id && !deleteVaktTimerId) {
          result = { success: false, error: 'Missing tripletex_entry_id or vakt_timer_id' };
          break;
        }

        result = await exponentialBackoff(async () => {
          let deleteResponse = { success: true };
          
          // Delete from Tripletex if we have the ID
          if (tripletex_entry_id) {
            deleteResponse = await callTripletexAPI(`/timesheet/entry/${tripletex_entry_id}`, 'DELETE', undefined, orgId);
          }

          if (deleteResponse.success && deleteVaktTimerId) {
            // Update local entry to mark as deleted/reset sync status
            const { error: updateError } = await supabase
              .from('vakt_timer')
              .update({
                tripletex_entry_id: null,
                tripletex_synced_at: null,
                sync_error: null,
                status: 'utkast'
              })
              .eq('id', deleteVaktTimerId);

            if (updateError) {
              console.error('Failed to update local entry after Tripletex deletion:', updateError);
              return { 
                success: true,
                warning: 'Entry deleted from Tripletex but local status not updated'
              };
            }
          }

          return deleteResponse.success 
            ? { success: true, data: { message: 'Timesheet entry deleted successfully' } }
            : deleteResponse;
        });
        break;
      }

      case 'get_project_details': {
        const projectId = payload?.project_id;
        
        if (!projectId) {
          return new Response(JSON.stringify({ error: 'Missing project_id' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        result = await exponentialBackoff(async () => {
          // Get project details
          const projectResponse = await callTripletexAPI(`/project/${projectId}`, 'GET', undefined, orgId);
          
          if (!projectResponse.success) {
            return { success: false, error: 'Failed to fetch project details from Tripletex' };
          }

          const project = projectResponse.data?.value;
          if (!project) {
            return { success: false, error: 'Project not found' };
          }

          // Get customer details if available
          let customerDetails = null;
          if (project.customer?.id) {
            const customerResponse = await callTripletexAPI(`/customer/${project.customer.id}`, 'GET', undefined, orgId);
            if (customerResponse.success) {
              customerDetails = customerResponse.data?.value;
            }
          }

          // Get project manager details if available
          let projectManagerDetails = null;
          if (project.projectManager?.id) {
            const managerResponse = await callTripletexAPI(`/employee/${project.projectManager.id}`, 'GET', undefined, orgId);
            if (managerResponse.success) {
              projectManagerDetails = managerResponse.data?.value;
            }
          }

          // Get department details if available
          let departmentDetails = null;
          if (project.department?.id) {
            const deptResponse = await callTripletexAPI(`/department/${project.department.id}`, 'GET', undefined, orgId);
            if (deptResponse.success) {
              departmentDetails = deptResponse.data?.value;
            }
          }

          // Format response
          const projectDetails = {
            id: project.id,
            name: project.name,
            number: project.number,
            description: project.description,
            startDate: project.startDate,
            endDate: project.endDate,
            customer: {
              name: customerDetails?.name || project.customer?.name || 'Ukjent kunde',
              email: customerDetails?.email,
              phoneNumber: customerDetails?.phoneNumber
            },
            projectManager: projectManagerDetails ? {
              firstName: projectManagerDetails.firstName,
              lastName: projectManagerDetails.lastName,
              email: projectManagerDetails.email,
              phoneNumber: projectManagerDetails.phoneNumber
            } : null,
            department: departmentDetails ? {
              name: departmentDetails.name
            } : null,
            isClosed: project.isClosed || false,
            displayName: project.displayName || `${project.number} - ${project.name}`
          };

          return { success: true, data: projectDetails };
        });
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Error in tripletex-api function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
