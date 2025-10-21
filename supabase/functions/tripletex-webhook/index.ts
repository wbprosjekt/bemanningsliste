import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface TripletexWebhookPayload {
  eventType: string;
  entityType: string;
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
      const { method } = req;
      
      if (method !== 'POST') {
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { 
            status: 405, 
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
          }
        );
      }

      // Parse webhook payload
      const payload: TripletexWebhookPayload = await req.json();
      
      console.log('🔔 Tripletex webhook received:', {
        eventType: payload.eventType,
        entityType: payload.entityType,
        entityId: payload.entityId,
        timestamp: payload.timestamp,
        hasChecksum: !!payload.checksum,
        hasOrgId: !!payload.organizationId
      });

      // Validate payload
      if (!payload.eventType || !payload.entityType || !payload.entityId) {
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
    const { eventType, entityType, entityId, timestamp, checksum } = payload;

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
      
      case 'activity':
        return await handleActivityWebhook(eventType, entityId, timestamp);
      
      case 'timesheet/entry':
        return await handleTimesheetWebhook(eventType, entityId, timestamp);
      
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

async function handleActivityWebhook(eventType: string, entityId: number, timestamp: string) {
  console.log(`⚡ Activity webhook: ${eventType} for activity ${entityId}`);
  
  // Mark activity for re-sync
  await supabase
    .from('ttx_activity_cache')
    .update({ 
      last_synced: timestamp,
      needs_sync: true 
    })
    .eq('ttx_id', entityId);

  return { success: true };
}

async function handleTimesheetWebhook(eventType: string, entityId: number, timestamp: string) {
  console.log(`⏰ Timesheet webhook: ${eventType} for entry ${entityId}`);
  
  // For timesheet entries, we might want to trigger a re-sync of related data
  // or update specific timesheet cache if we have one
  
  return { success: true };
}
