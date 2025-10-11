import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateTriggerSecret } from '../_shared/auth-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-trigger-secret',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function syncOrganizationData(orgId: string): Promise<{ success: boolean; results: unknown }> {
  console.log(`Starting nightly sync for organization: ${orgId}`);
  
  const results = {
    employees: { success: false, count: 0, error: null },
    projects: { success: false, count: 0, error: null },
    activities: { success: false, count: 0, error: null }
  };

  try {
    // Call the main Tripletex API function for each sync operation
    const syncOperations = [
      { action: 'sync-employees', key: 'employees' },
      { action: 'sync-projects', key: 'projects' },
      { action: 'sync-activities', key: 'activities' }
    ];

    for (const operation of syncOperations) {
      try {
        console.log(`Syncing ${operation.key} for org ${orgId}`);
        
        const { data, error } = await supabase.functions.invoke('tripletex-api', {
          body: { 
            action: operation.action,
            orgId: orgId
          }
        });

        if (error) {
          console.error(`Error syncing ${operation.key}:`, error);
          results[operation.key as keyof typeof results].error = error.message;
        } else if (data?.success) {
          results[operation.key as keyof typeof results].success = true;
          results[operation.key as keyof typeof results].count = data.data?.count || 0;
          console.log(`Successfully synced ${data.data?.count || 0} ${operation.key}`);
        } else {
          results[operation.key as keyof typeof results].error = data?.error || 'Unknown error';
        }
      } catch (syncError) {
        console.error(`Exception during ${operation.key} sync:`, syncError);
        results[operation.key as keyof typeof results].error = syncError.message;
      }
    }

    // Log sync results to database
    const logData = {
      org_id: orgId,
      sync_type: 'nightly_auto',
      results: results,
      completed_at: new Date().toISOString()
    };

    const { error: logError } = await supabase
      .from('sync_log')
      .insert(logData);

    if (logError) {
      console.error('Error logging sync results:', logError);
    }

  } catch (error) {
    console.error(`Error in nightly sync for org ${orgId}:`, error);
    return { success: false, results };
  }

  const overallSuccess = results.employees.success && results.projects.success && results.activities.success;
  return { success: overallSuccess, results };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ==================== SECURITY CHECK ====================
  // This function should ONLY be called by cron jobs with a valid secret
  if (!(await validateTriggerSecret(req, 'nightly_sync_secret'))) {
    console.error('Unauthorized nightly sync attempt - invalid or missing secret');
    return new Response(
      JSON.stringify({ 
        error: 'Forbidden',
        message: 'Invalid or missing trigger secret. This endpoint is for internal use only.' 
      }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
  
  console.log('✅ Nightly sync authorized via trigger secret');
  // ==================== END SECURITY CHECK ====================

  try {
    console.log('Starting nightly sync job at:', new Date().toISOString());

    // Get all organizations with active Tripletex integration
    const { data: integrations, error } = await supabase
      .from('integration_settings')
      .select(`
        org_id,
        settings,
        org:org_id (
          name
        )
      `)
      .eq('integration_type', 'tripletex')
      .eq('aktiv', true);

    if (error) {
      console.error('Error loading active integrations:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!integrations || integrations.length === 0) {
      console.log('No active Tripletex integrations found');
      return new Response(JSON.stringify({ 
        message: 'No active integrations to sync',
        processedOrganizations: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Filter organizations that have nightly sync enabled
    const nightlySyncOrgs = integrations.filter(integration => {
      const settings = integration.settings as { nightly_sync?: boolean };
      return settings && settings.nightly_sync === true;
    });

    console.log(`Found ${nightlySyncOrgs.length} organizations with nightly sync enabled`);

    const syncResults = [];

    // Process each organization
    for (const integration of nightlySyncOrgs) {
      try {
        const result = await syncOrganizationData(integration.org_id);
        syncResults.push({
          orgId: integration.org_id,
          orgName: (integration.org as { name?: string })?.name || 'Unknown',
          ...result
        });
      } catch (error) {
        console.error(`Failed to sync organization ${integration.org_id}:`, error);
        syncResults.push({
          orgId: integration.org_id,
          orgName: (integration.org as { name?: string })?.name || 'Unknown',
          success: false,
          error: error.message
        });
      }
    }

    console.log('Nightly sync completed at:', new Date().toISOString());
    console.log('Sync results:', syncResults);

    const successfulSyncs = syncResults.filter(r => r.success).length;
    const totalSyncs = syncResults.length;

    return new Response(JSON.stringify({
      message: 'Nightly sync completed',
      processedOrganizations: totalSyncs,
      successfulSyncs: successfulSyncs,
      results: syncResults,
      completedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in nightly sync job:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});