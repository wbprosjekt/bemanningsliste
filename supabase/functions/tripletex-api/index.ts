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
    console.log('Processing org settings:', orgSettings);
    if (orgSettings.consumer_token && orgSettings.employee_token) {
      const config = {
        consumerToken: orgSettings.consumer_token,
        employeeToken: orgSettings.employee_token,
        baseUrl: orgSettings.api_base_url || 'https://api-test.tripletex.tech/v2'
      };
      console.log('Returning config:', config);
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

async function callTripletexAPI(endpoint: string, method: string = 'GET', body?: any, orgId?: string): Promise<TripletexResponse> {
  const config = await getTripletexConfig(orgId || '');
  
  if (!config.consumerToken || !config.employeeToken) {
    return { success: false, error: 'Tripletex tokens not configured for this organization' };
  }

  const url = `${config.baseUrl}${endpoint}`;
  const headers: Record<string, string> = {
    'Authorization': `Basic ${btoa(`${config.consumerToken}:${config.employeeToken}`)}`,
    'Content-Type': 'application/json'
  };

  try {
    console.log(`Calling Tripletex API: ${method} ${url}`);
    
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('Tripletex API error:', response.status, responseData);
      return { 
        success: false, 
        error: responseData.message || `HTTP ${response.status}` 
      };
    }

    return { success: true, data: responseData };
  } catch (error) {
    console.error('Network error calling Tripletex API:', error);
    return { success: false, error: error.message };
  }
}

async function exponentialBackoff(fn: () => Promise<any>, maxRetries: number = 3): Promise<any> {
  let delay = 1000; // Start with 1 second
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Check if it's a rate limit error (429) or server error (5xx)
      if (error.status === 429 || (error.status >= 500 && error.status < 600)) {
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
        const sessionConfig = await getTripletexConfig(orgId);
        console.log('Config for test-session:', sessionConfig);
        
        result = await callTripletexAPI('/token/session/:create', 'PUT', {
          consumerToken: sessionConfig.consumerToken,
          employeeToken: sessionConfig.employeeToken,
          expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 24 hours
        }, orgId);
        break;

      case 'sync-employees':
        result = await exponentialBackoff(async () => {
          const response = await callTripletexAPI('/employee?count=1000', 'GET', undefined, orgId);
          if (response.success && response.data?.values) {
            // Cache employees in database
            const employees = response.data.values.map((emp: any) => ({
              org_id: orgId,
              tripletex_employee_id: emp.id,
              fornavn: emp.firstName || '',
              etternavn: emp.lastName || '',
              epost: emp.email,
              aktiv: emp.isActive,
              last_synced: new Date().toISOString()
            }));

            // Upsert employees
            const { error: upsertError } = await supabase
              .from('ttx_employee_cache')
              .upsert(employees, { 
                onConflict: 'org_id,tripletex_employee_id',
                ignoreDuplicates: false 
              });

            if (upsertError) {
              console.error('Error upserting employees:', upsertError);
              return { success: false, error: upsertError.message };
            }

            return { success: true, data: { count: employees.length } };
          }
          return response;
        });
        break;

      case 'sync-projects':
        result = await exponentialBackoff(async () => {
          const response = await callTripletexAPI('/project?count=1000');
          if (response.success && response.data?.values) {
            // Cache projects in database
            const projects = response.data.values.map((proj: any) => ({
              org_id: orgId,
              tripletex_project_id: proj.id,
              project_number: proj.number,
              project_name: proj.displayName || proj.name,
              customer_name: proj.customer?.name,
              is_active: proj.isActive,
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
              return { success: false, error: upsertError.message };
            }

            return { success: true, data: { count: projects.length } };
          }
          return response;
        });
        break;

      case 'sync-activities':
        result = await exponentialBackoff(async () => {
          const response = await callTripletexAPI('/activity?count=1000');
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

            const { data: activityData } = await supabase
              .from('ttx_activity_cache')
              .select('ttx_id')
              .eq('id', entry.activityId)
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
              return await callTripletexAPI('/timesheet/hours', 'POST', timesheetData);
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
          } catch (error) {
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

  } catch (error) {
    console.error('Error in tripletex-api function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});