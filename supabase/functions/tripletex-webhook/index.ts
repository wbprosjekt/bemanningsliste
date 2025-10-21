import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface TripletexWebhookPayload {
  event: string;
  value: any;
  id: number;
  subscriptionId?: number;
}

// Handle CORS preflight
if (Deno.serve) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
      return handleCorsPreflight(req);
    }

    try {
      console.log('🚀 Tripletex webhook function started');
      const { method } = req;
      
      if (method !== 'POST') {
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { 
            status: 405, 
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Parse webhook payload
      let payload: TripletexWebhookPayload;
      try {
        payload = await req.json();
        console.log('📥 Raw webhook payload received:', JSON.stringify(payload, null, 2));
      } catch (error) {
        console.error('❌ Failed to parse webhook payload:', error);
        return new Response(
          JSON.stringify({ error: 'Invalid JSON payload' }),
          { 
            status: 400, 
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
          }
        );
      }
      
      console.log('🔔 Tripletex webhook received:', {
        event: payload.event,
        id: payload.id,
        subscriptionId: payload.subscriptionId,
        hasValue: !!payload.value,
        fullPayload: JSON.stringify(payload, null, 2)
      });

      // Validate payload
      if (!payload.event || !payload.id) {
        console.error('❌ Invalid webhook payload:', payload);
        return new Response(
          JSON.stringify({ error: 'Invalid payload' }),
          { 
            status: 400, 
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
          }
        );
      }

      // Handle different webhook events
      const result = await handleWebhookEvent(payload);

      if (result.success) {
        const entityType = payload.event.split('.')[0];
        console.log(`✅ Webhook processed successfully: ${entityType}:${payload.id}`);
        return new Response(
          JSON.stringify({ success: true, message: 'Webhook processed' }),
          { 
            status: 200, 
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
          }
        );
      } else {
        console.error('❌ Webhook processing failed:', result.error);
        return new Response(
          JSON.stringify({ error: result.error }),
          { 
            status: 500, 
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
          }
        );
      }

    } catch (error) {
      console.error('❌ Webhook handler error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { 
          status: 500, 
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
        }
      );
    }
  });
}

async function handleWebhookEvent(payload: TripletexWebhookPayload) {
  try {
    const { event, id } = payload;

    // Extract entity type from event (e.g., 'project.create' -> 'project')
    const entityType = event.split('.')[0];

    console.log(`🔄 Processing webhook: ${event} for ${entityType} ID ${id}`);

    // Handle specific entity types
    switch (entityType) {
      case 'employee':
        return await handleEmployeeWebhook(event, id);
      
      case 'project':
        return await handleProjectWebhook(event, id, payload.value);
      
      case 'product':
        return await handleProductWebhook(event, id);
      
      case 'customer':
        return await handleCustomerWebhook(event, id);
      
      default:
        console.log(`ℹ️ Unhandled webhook entity type: ${entityType}`);
        return { success: true };
    }

  } catch (error) {
    console.error('Error handling webhook event:', error);
    return { success: false, error: error.message };
  }
}

async function handleEmployeeWebhook(event: string, id: number) {
  console.log(`👤 Employee webhook: ${event} for employee ${id}`);
  
  // Mark employee for re-sync
  await supabase
    .from('ttx_employee_cache')
    .update({ 
      last_synced: new Date().toISOString(),
      needs_sync: true 
    })
    .eq('tripletex_employee_id', id);

  return { success: true };
}

async function handleProjectWebhook(event: string, id: number, projectData?: any) {
  console.log(`📁 Project webhook: ${event} for project ${id}`);
  
  try {
    // For new projects, use the data from webhook payload
    if (event === 'project.create' && projectData) {
      console.log(`🔄 Creating new project from webhook data for project ${id}:`, projectData.name);
      
      // First, try to find existing project to get org_id
      const { data: existingProject } = await supabase
        .from('ttx_project_cache')
        .select('org_id')
        .eq('tripletex_project_id', id)
        .single();

      // Insert the project in cache using webhook data
      await supabase
        .from('ttx_project_cache')
        .upsert({
          tripletex_project_id: id,
          project_name: projectData.name || 'Unknown',
          project_number: projectData.number || '',
          display_name: projectData.displayName || '',
          customer_name: projectData.customer?.name || null,
          is_active: !projectData.isClosed,
          is_closed: projectData.isClosed || false,
          last_synced: new Date().toISOString(),
          needs_sync: false,
          org_id: existingProject?.org_id || null // Use existing org_id or null
        });
      
      console.log(`✅ Project ${id} created successfully from webhook data`);
    } else {
      // For updates or when no project data is available, mark for re-sync
      await supabase
        .from('ttx_project_cache')
        .update({ 
          last_synced: new Date().toISOString(),
          needs_sync: true 
        })
        .eq('tripletex_project_id', id);
      
      console.log(`✅ Project ${id} marked for re-sync`);
    }
  } catch (error) {
    console.error(`❌ Error handling project webhook for ${id}:`, error);
  }

  return { success: true };
}

async function handleProductWebhook(event: string, id: number) {
  console.log(`📦 Product webhook: ${event} for product ${id}`);
  
  // Mark product for re-sync if we have a product cache table
  // For now, just log the event
  
  return { success: true };
}

async function handleCustomerWebhook(event: string, id: number) {
  console.log(`👤 Customer webhook: ${event} for customer ${id}`);
  
  // Mark customer for re-sync if we have a customer cache table
  // For now, just log the event
  
  return { success: true };
}
