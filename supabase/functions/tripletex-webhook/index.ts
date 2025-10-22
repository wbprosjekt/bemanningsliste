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

      // Validate webhook signature for security
      const signature = req.headers.get('X-Tripletex-Signature') || req.headers.get('X-Hub-Signature-256');
      const webhookSecret = Deno.env.get('TRIPLETEX_WEBHOOK_SECRET');
      
      // Get raw body for signature validation
      const rawBody = await req.text();
      
      // Log the origin for debugging
      const origin = req.headers.get('origin');
      console.log('🔍 Webhook origin:', origin);
      
      if (webhookSecret && !signature) {
        console.warn('⚠️ Webhook signature missing but secret configured');
        return new Response(
          JSON.stringify({ error: 'Webhook signature required' }),
          { 
            status: 401, 
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      if (webhookSecret && signature) {
        // Validate signature (Tripletex typically uses HMAC-SHA256)
        const crypto = await import('https://deno.land/std@0.208.0/crypto/mod.ts');
        const expectedSignature = await crypto.hmac('sha256', webhookSecret, rawBody, 'hex');
        const providedSignature = signature.replace('sha256=', '');
        
        if (expectedSignature !== providedSignature) {
          console.warn('⚠️ Invalid webhook signature');
          return new Response(
            JSON.stringify({ error: 'Invalid signature' }),
            { 
              status: 401, 
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
        
        console.log('✅ Webhook signature validated');
      }

      // Parse webhook payload
      let payload: TripletexWebhookPayload;
      try {
        payload = JSON.parse(rawBody);
        console.log('📥 Raw webhook payload received:', JSON.stringify(payload, null, 2));
      } catch (error) {
        console.error('❌ Failed to parse webhook payload:', error);
        return new Response(
          JSON.stringify({ error: 'Invalid JSON payload' }),
          { 
            status: 400, 
            headers: { ...getCorsHeaders(req.headers.get('origin') || undefined), 'Content-Type': 'application/json' }
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
            headers: { ...getCorsHeaders(req.headers.get('origin') || undefined), 'Content-Type': 'application/json' }
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
            headers: { ...getCorsHeaders(req.headers.get('origin') || undefined), 'Content-Type': 'application/json' }
          }
        );
      } else {
        console.error('❌ Webhook processing failed:', result.error);
        return new Response(
          JSON.stringify({ error: result.error }),
          { 
            status: 500, 
            headers: { ...getCorsHeaders(req.headers.get('origin') || undefined), 'Content-Type': 'application/json' }
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

    // Handle specific entity types and events
    switch (entityType) {
      case 'employee':
        return await handleEmployeeWebhook(event, id, payload.value);
      
      case 'project':
        return await handleProjectWebhook(event, id, payload.value);
      
      case 'product':
        return await handleProductWebhook(event, id, payload.value);
      
      case 'customer':
        return await handleCustomerWebhook(event, id, payload.value);
      
      case 'timesheetEntry':
        return await handleTimesheetWebhook(event, id, payload.value);
      
      default:
        console.log(`ℹ️ Unhandled webhook entity type: ${entityType}`);
        return { success: true };
    }

  } catch (error) {
    console.error('Error handling webhook event:', error);
    return { success: false, error: error.message };
  }
}

async function handleEmployeeWebhook(event: string, id: number, employeeData?: any) {
  console.log(`👤 Employee webhook: ${event} for employee ${id}`);
  
  try {
    if (event === 'employee.create' && employeeData) {
      console.log(`🔄 Creating new employee from webhook data for employee ${id}:`, employeeData.firstName, employeeData.lastName);
      
      // Get org_id from any existing employee in the cache
      const { data: existingEmployees } = await supabase
        .from('ttx_employee_cache')
        .select('org_id')
        .limit(1);

      const orgId = existingEmployees?.[0]?.org_id || null;

      // Insert the employee in cache using webhook data
      const { error: insertError } = await supabase
        .from('ttx_employee_cache')
        .insert({
          tripletex_employee_id: id,
          first_name: employeeData.firstName || 'Unknown',
          last_name: employeeData.lastName || 'Unknown',
          email: employeeData.email || null,
          is_active: true,
          last_synced: new Date().toISOString(),
          needs_sync: false,
          org_id: orgId
        });
      
      if (insertError) {
        console.error(`❌ Failed to insert employee ${id}:`, insertError);
      } else {
        console.log(`✅ Employee ${id} created successfully from webhook data`);
      }
    } else {
      // For updates or deletes, mark for re-sync
      await supabase
        .from('ttx_employee_cache')
        .update({ 
          last_synced: new Date().toISOString(),
          needs_sync: true 
        })
        .eq('tripletex_employee_id', id);
      
      console.log(`✅ Employee ${id} marked for re-sync`);
    }
  } catch (error) {
    console.error(`❌ Error handling employee webhook for ${id}:`, error);
  }
  
  return { success: true };
}

async function handleProjectWebhook(event: string, id: number, projectData?: any) {
  console.log(`📁 Project webhook: ${event} for project ${id}`);
  
  try {
    // For new projects, use the data from webhook payload
    if (event === 'project.create' && projectData) {
      console.log(`🔄 Creating new project from webhook data for project ${id}:`, projectData.name);
      
      // Get org_id from any existing project in the cache
      const { data: existingProjects } = await supabase
        .from('ttx_project_cache')
        .select('org_id')
        .limit(1);

      const orgId = existingProjects?.[0]?.org_id || null;

      // First check if project already exists
      const { data: existingProject } = await supabase
        .from('ttx_project_cache')
        .select('id')
        .eq('tripletex_project_id', id)
        .single();

      if (existingProject) {
        console.log(`ℹ️ Project ${id} already exists, updating instead of creating`);
        
        // Update existing project
        const projectName = projectData.name || 'Unknown';
        const projectNumber = projectData.number || '';
        
        // Combine number and name if number is not already in the name
        const displayName = projectNumber && !projectName.startsWith(projectNumber) 
          ? `${projectNumber} ${projectName}` 
          : projectName;
        
        const { error: updateError } = await supabase
          .from('ttx_project_cache')
          .update({
            project_name: displayName,
            project_number: projectNumber,
            customer_name: projectData.customer?.name || null,
            is_active: !projectData.isClosed,
            last_synced: new Date().toISOString(),
            needs_sync: false
          })
          .eq('tripletex_project_id', id);
        
        if (updateError) {
          console.error(`❌ Failed to update project ${id}:`, updateError);
          return { success: false, error: updateError.message };
        }
        
        console.log(`✅ Project ${id} updated successfully`);
      } else {
        // Insert new project
        const projectName = projectData.name || 'Unknown';
        const projectNumber = projectData.number || '';
        
        // Combine number and name if number is not already in the name
        const displayName = projectNumber && !projectName.startsWith(projectNumber) 
          ? `${projectNumber} ${projectName}` 
          : projectName;
        
        const { data: insertedData, error: insertError } = await supabase
          .from('ttx_project_cache')
          .insert({
            tripletex_project_id: id,
            project_name: displayName,
            project_number: projectNumber,
            customer_name: projectData.customer?.name || null,
            is_active: !projectData.isClosed,
            last_synced: new Date().toISOString(),
            org_id: orgId
          });
        
        if (insertError) {
          console.error(`❌ Failed to insert project ${id}:`, insertError);
          return { success: false, error: insertError.message };
        }
        
        console.log(`✅ Project ${id} created successfully from webhook data with org_id: ${orgId}`);
      }
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

async function handleCustomerWebhook(event: string, id: number, customerData?: any) {
  console.log(`👤 Customer webhook: ${event} for customer ${id}`);
  
  // Mark customer for re-sync if we have a customer cache table
  // For now, just log the event
  
  return { success: true };
}

async function handleTimesheetWebhook(event: string, id: number, timesheetData?: any) {
  console.log(`⏰ Timesheet webhook: ${event} for timesheet entry ${id}`);
  
  try {
    // For timesheet entries, we typically don't cache them
    // but we can log the event and mark related projects/employees for re-sync
    
    if (timesheetData?.project?.id) {
      // Mark related project for re-sync
      await supabase
        .from('ttx_project_cache')
        .update({ 
          last_synced: new Date().toISOString(),
          needs_sync: true 
        })
        .eq('tripletex_project_id', timesheetData.project.id);
      
      console.log(`✅ Project ${timesheetData.project.id} marked for re-sync due to timesheet update`);
    }
    
    if (timesheetData?.employee?.id) {
      // Mark related employee for re-sync
      await supabase
        .from('ttx_employee_cache')
        .update({ 
          last_synced: new Date().toISOString(),
          needs_sync: true 
        })
        .eq('tripletex_employee_id', timesheetData.employee.id);
      
      console.log(`✅ Employee ${timesheetData.employee.id} marked for re-sync due to timesheet update`);
    }
  } catch (error) {
    console.error(`❌ Error handling timesheet webhook for ${id}:`, error);
  }
  
  return { success: true };
}
