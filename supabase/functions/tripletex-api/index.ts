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
  data?: any;
  error?: string;
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

function safeBody(body: any) {
  if (!body) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(body)) {
    out[k] = k.toLowerCase().includes('token') ? '***masked***' : (body as any)[k];
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
    const orgSettings = settings.settings as any;
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
async function getOrCreateSession(orgId: string): Promise<{ token: string; expirationDate: string }> {
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

  const currentSettings = (row?.settings as any) || {};
  const now = new Date();

  if (currentSettings.session_token && currentSettings.session_expires_at) {
    const expiresAt = new Date(currentSettings.session_expires_at);
    // Add 60s safety margin
    if (expiresAt.getTime() - 60000 > now.getTime()) {
      return { token: String(currentSettings.session_token), expirationDate: expiresAt.toISOString().split('T')[0] };
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
  let data: any = {};
  try { data = JSON.parse(text); } catch {}

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

  // Extract token from response
  const token = data?.value?.token ?? data?.token ?? data?.value?.[0]?.token;
  const exp = data?.value?.expirationDate ?? data?.expirationDate ?? expirationDate;

  if (!token) {
    console.error('Tripletex session response missing token:', data);
    throw new Error('Tripletex returnerte ikke en session token');
  }

  // Persist session token into settings
  const newSettings = {
    ...currentSettings,
    session_token: token,
    session_expires_at: exp
  };

  const { error: writeErr } = await supabase
    .from('integration_settings')
    .update({ settings: newSettings })
    .eq('id', row?.id as string);

  if (writeErr) {
    console.error('Failed saving session token to settings:', writeErr);
  }

  return { token: String(token), expirationDate: String(exp) };
}

async function callTripletexAPI(endpoint: string, method: string = 'GET', body?: any, orgId?: string): Promise<TripletexResponse> {
  const config = await getTripletexConfig(orgId || '');
  if (!config.consumerToken || !config.employeeToken) {
    return { success: false, error: 'Tripletex tokens not configured for this organization' };
  }
  const url = `${config.baseUrl}${endpoint}`;
  let headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Use session token for all non-session endpoints
  if (!endpoint.startsWith('/token/session')) {
    try {
      const session = await getOrCreateSession(orgId!);
      headers = {
        ...headers,
        Authorization: `Basic ${btoa(`0:${session.token}`)}`
      };
    } catch (e) {
      return { success: false, error: (e as any).message || 'Failed to create session' };
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
    let responseData: any = {};
    try { responseData = JSON.parse(text); } catch {}

    console.log('Tripletex API response', { status: response.status, url });

    if (!response.ok) {
      // Optional: throw on 429/5xx to let exponentialBackoff handle it
      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        const err: any = new Error(responseData?.message || `HTTP ${response.status}`);
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
  } catch (error: any) {
    console.error('Network error calling Tripletex API:', error);
    return { success: false, error: error.message ?? String(error) };
  }
}

async function exponentialBackoff(fn: () => Promise<any>, maxRetries: number = 3): Promise<any> {
  let delay = 1000; // Start with 1 second
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
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

    let payload: any = {};
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
      case 'check-config':
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

      case 'test-session':
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
        } catch (e: any) {
          console.error('Session test failed:', e.message);
          result = { success: false, error: e.message || 'Failed to create session' };
        }
        break;

      case 'sync-employees':
        result = await exponentialBackoff(async () => {
          const response = await callTripletexAPI('/employee?count=100', 'GET', undefined, orgId);
          if (response.success && response.data?.values) {
            console.log(`Syncing ${response.data.values.length} employees for org ${orgId}`);
            
            // Cache employees in database
            const employees = response.data.values.map((emp: any) => ({
              org_id: orgId,
              tripletex_employee_id: emp.id,
              fornavn: emp.firstName || '',
              etternavn: emp.lastName || '',
              epost: emp.email,
              aktiv: emp.isActive !== false, // Default to true if undefined
              last_synced: new Date().toISOString()
            }));

            // Upsert employees with proper conflict resolution
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
            const persons = employees.map((emp: any) => ({
              org_id: orgId,
              fornavn: emp.fornavn,
              etternavn: emp.etternavn,
              epost: emp.epost,
              tripletex_employee_id: emp.tripletex_employee_id,
              aktiv: emp.aktiv,
              person_type: 'ansatt'
            }));

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
          }
          return response;
        });
        break;

            if (upsertError) {
              console.error('Error upserting employees:', upsertError);
              return { success: false, error: `Database error: ${upsertError.message}` };
            }

            console.log(`Successfully synced ${employees.length} employees`);
            return { success: true, data: { count: employees.length } };
          }
          return response;
        });
        break;

      case 'sync-projects':
        result = await exponentialBackoff(async () => {
          const response = await callTripletexAPI('/project?count=100', 'GET', undefined, orgId);
          if (response.success && response.data?.values) {
            console.log(`Syncing ${response.data.values.length} projects for org ${orgId}`);
            
            // Cache projects in database
            const projects = response.data.values.map((proj: any) => ({
              org_id: orgId,
              tripletex_project_id: proj.id,
              project_number: proj.number,
              project_name: proj.displayName || proj.name,
              customer_name: proj.customer?.name,
              is_active: proj.isActive !== false, // Default to true if undefined
              last_synced: new Date().toISOString()
            }));

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

      case 'sync-activities':
        result = await exponentialBackoff(async () => {
          const response = await callTripletexAPI('/activity?count=1000', 'GET', undefined, orgId);
          if (response.success && response.data?.values) {
            // Cache activities in database
            const activities = response.data.values.map((act: any) => ({
              org_id: orgId,
              ttx_id: act.id,
              navn: act.name,
              aktiv: act.isActive,
              last_synced: new Date().toISOString()
            }));

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

      case 'search-projects':
        const query = url.searchParams.get('q') || '';
        result = await callTripletexAPI(`/project?count=50&displayName=${encodeURIComponent(query)}`, 'GET', undefined, orgId);
        
        // Cache search results
        if (result.success && result.data?.values) {
          const projects = result.data.values.map((proj: any) => ({
            org_id: orgId,
            tripletex_project_id: proj.id,
            project_number: proj.number,
            project_name: proj.displayName || proj.name,
            customer_name: proj.customer?.name,
            is_active: proj.isActive,
            last_synced: new Date().toISOString()
          }));

          await supabase
            .from('ttx_project_cache')
            .upsert(projects, { 
              onConflict: 'org_id,tripletex_project_id',
              ignoreDuplicates: false 
            });
        }
        break;

      case 'export-timesheet':
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

            const clientReference = `${orgId}-${entry.id}`;
            
            const timesheetData = {
              employee: { id: employeeData.tripletex_employee_id },
              project: { id: entry.projectId },
              activity: { id: activityData.ttx_id },
              date: entry.date,
              hours: entry.hours,
              comment: entry.comment || '',
              clientReference: clientReference
            };

            if (dryRun) {
              exportResults.push({ 
                id: entry.id, 
                success: true, 
                dryRun: true,
                payload: timesheetData
              });
              continue;
            }

            const exportResult = await exponentialBackoff(async () => {
              return await callTripletexAPI('/timesheet/hours', 'POST', timesheetData, orgId);
            });

            if (exportResult.success) {
              // Update vakt_timer with Tripletex entry ID and status
              await supabase
                .from('vakt_timer')
                .update({
                  tripletex_entry_id: exportResult.data.value?.id,
                  client_reference: clientReference,
                  status: 'sendt'
                })
                .eq('id', entry.id);

              exportResults.push({ 
                id: entry.id, 
                success: true, 
                tripletexId: exportResult.data.value?.id 
              });
            } else {
              // Handle period locked error specifically
              if (exportResult.error?.includes('locked') || exportResult.error?.includes('låst') || 
                  exportResult.error?.includes('period is closed')) {
                exportResults.push({ 
                  id: entry.id, 
                  success: false, 
                  error: 'Periode er låst i Tripletex - kontakt lønn',
                  errorType: 'period_locked'
                });
              } else {
                exportResults.push({ 
                  id: entry.id, 
                  success: false, 
                  error: exportResult.error 
                });
              }
            }
          } catch (error: any) {
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

      case 'verify-timesheet-entry':
        const tripletexEntryId = payload?.tripletexEntryId;

        if (!tripletexEntryId) {
          return new Response(JSON.stringify({ error: 'Missing tripletexEntryId' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const verifyResult = await callTripletexAPI(`/timesheet/hours/${tripletexEntryId}`, 'GET', undefined, orgId);
        result = { 
          success: true, 
          data: { 
            exists: verifyResult.success,
            entry: verifyResult.data?.value || null 
          }
        };
        break;

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in tripletex-api function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});