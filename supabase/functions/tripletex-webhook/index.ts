import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface TripletexWebhookPayload {
  eventType: string;
  entityId: number;
  timestamp: string;
  checksum?: string;
  organizationId?: string;
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
        eventType: payload.eventType,
        entityId: payload.entityId,
        timestamp: payload.timestamp,
        hasChecksum: !!payload.checksum,
        hasOrgId: !!payload.organizationId,
        fullPayload: JSON.stringify(payload, null, 2)
      });

      // Validate payload
      if (!payload.eventType || !payload.entityId) {
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
        console.log(`✅ Webhook processed successfully: ${payload.entityType}:${payload.entityId}`);
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
    const { eventType, entityId, timestamp, checksum } = payload;

    // Extract entity type from event type (e.g., 'employee.create' -> 'employee')
    const entityType = eventType.split('.')[0];

    // Update sync state to mark resource as changed
    if (checksum) {
      await supabase.rpc('update_tripletex_sync_state', {
        p_org_id: payload.organizationId || null,
        p_resource_type: entityType,
        p_resource_id: entityId.toString(),
        p_checksum: checksum,
        p_last_modified: timestamp
      });
    }

    // Handle specific entity types
    switch (entityType) {
      case 'employee':
        return await handleEmployeeWebhook(eventType, entityId, timestamp);
      
      case 'project':
        return await handleProjectWebhook(eventType, entityId, timestamp);
      
      case 'product':
        return await handleProductWebhook(eventType, entityId, timestamp);
      
      case 'customer':
        return await handleCustomerWebhook(eventType, entityId, timestamp);
      
      default:
        console.log(`ℹ️ Unhandled webhook entity type: ${entityType}`);
        return { success: true };
    }

  } catch (error) {
    console.error('Error handling webhook event:', error);
    return { success: false, error: error.message };
  }
}

async function handleEmployeeWebhook(eventType: string, entityId: number, timestamp: string) {
  console.log(`👤 Employee webhook: ${eventType} for employee ${entityId}`);
  
  // Mark employee for re-sync
  await supabase
    .from('ttx_employee_cache')
    .update({ 
      last_synced: timestamp,
      needs_sync: true 
    })
    .eq('tripletex_employee_id', entityId);

  return { success: true };
}

async function handleProjectWebhook(eventType: string, entityId: number, timestamp: string) {
  console.log(`📁 Project webhook: ${eventType} for project ${entityId}`);
  
  // Mark project for re-sync
  await supabase
    .from('ttx_project_cache')
    .update({ 
      last_synced: timestamp,
      needs_sync: true 
    })
    .eq('tripletex_project_id', entityId);

  return { success: true };
}

async function handleProductWebhook(eventType: string, entityId: number, timestamp: string) {
  console.log(`📦 Product webhook: ${eventType} for product ${entityId}`);
  
  // Mark product for re-sync if we have a product cache table
  // For now, just log the event
  
  return { success: true };
}

async function handleCustomerWebhook(eventType: string, entityId: number, timestamp: string) {
  console.log(`👤 Customer webhook: ${eventType} for customer ${entityId}`);
  
  // Mark customer for re-sync if we have a customer cache table
  // For now, just log the event
  
  return { success: true };
}
