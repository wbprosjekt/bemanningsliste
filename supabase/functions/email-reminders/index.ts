import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { 
  requireOrgAccess, 
  requireAdminOrManager,
  isServiceRoleRequest,
  validateTriggerSecret,
  createErrorResponse 
} from '../_shared/auth-helpers.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface EmailTemplate {
  id: string;
  org_id: string;
  template_type: 'payroll' | 'weekly' | 'test';
  subject: string;
  body_html: string;
  body_text: string;
  variables: string[];
}

interface ReminderSettings {
  id: string;
  org_id: string;
  payroll_enabled: boolean;
  payroll_days_before: number;
  payroll_day_of_month: number;
  weekly_enabled: boolean;
  weekly_day: number;
  weekly_time: string;
  send_to_all: boolean;
}

interface Profile {
  id: string;
  user_id: string;
  org_id: string;
  display_name: string;
  role: string;
  email?: string;
}

// Get email settings from database
async function getEmailSettings(orgId: string) {
  const { data, error } = await supabase
    .from('email_settings')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (error || !data) {
    console.error('Error fetching email settings:', error);
    return null;
  }

  return data;
}

// Send email using configured service
async function sendEmail(to: string, subject: string, htmlContent: string, textContent: string, emailSettings: any): Promise<{ success: boolean; error?: string; messageId?: string; providerResponse?: any }> {
  if (!emailSettings) {
    return { success: false, error: 'Email settings not configured' };
  }

  if (!emailSettings.api_key) {
    return { success: false, error: 'API key not configured' };
  }

  try {
    let response;
    
    if (emailSettings.provider === 'resend') {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${emailSettings.api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${emailSettings.from_name} <${emailSettings.from_email}>`,
          to: [to],
          subject: subject,
          html: htmlContent,
          text: textContent,
        }),
      });
    } else {
      return { success: false, error: `Provider ${emailSettings.provider} not implemented yet` };
    }

    const data = await response.json();

    if (!response.ok) {
      console.error('Email API error:', data);
      return { success: false, error: data.message || 'Failed to send email', providerResponse: data };
    }

    console.log('Email sent successfully:', data);
    return { success: true, messageId: data.id, providerResponse: data };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

// Replace template variables with actual values
function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

// Get recipients for email sending
async function getEmailRecipients(orgId: string, sendToAll: boolean): Promise<Profile[]> {
  let query = supabase
    .from('profiles')
    .select('id, user_id, org_id, display_name, role, email')
    .eq('org_id', orgId);

  // If not sending to all, only send to regular users (not admins/managers)
  if (!sendToAll) {
    query = query.eq('role', 'user');
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching recipients:', error);
    return [];
  }

  // Filter out profiles without email addresses
  return (data || []).filter(profile => profile.email && profile.email.includes('@'));
}

// Send test email to specific email address
async function sendTestEmail(orgId: string, testEmail: string): Promise<{ success: boolean; error?: string; sentTo?: string }> {
  try {
    // Get email settings
    const emailSettings = await getEmailSettings(orgId);
    if (!emailSettings) {
      return { success: false, error: 'Email settings not configured' };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      return { success: false, error: 'Invalid email address format' };
    }

    // Get test email template
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('org_id', orgId)
      .eq('template_type', 'test')
      .single();

    if (templateError || !template) {
      return { success: false, error: 'Test email template not found' };
    }

    // Prepare variables
    const variables = {
      navn: 'Test Bruker', // Default name for test emails
      dato: new Date().toLocaleDateString('no-NO', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    };

    // Replace variables in template
    const subject = replaceTemplateVariables(template.subject, variables);
    const htmlContent = replaceTemplateVariables(template.body_html, variables);
    const textContent = replaceTemplateVariables(template.body_text, variables);

    // Send email
    const emailResult = await sendEmail(testEmail, subject, htmlContent, textContent, emailSettings);

    // Log email attempt
    await supabase
      .from('email_logs')
      .insert({
        org_id: orgId,
        recipient_email: testEmail,
        recipient_name: 'Test Recipient',
        subject: subject,
        template_type: 'test',
        status: emailResult.success ? 'sent' : 'failed',
        error_message: emailResult.success ? null : emailResult.error,
        message_id: emailResult.messageId || null,
        provider_response: emailResult.providerResponse || null,
        triggered_by: 'manual',
        reminder_type: 'test',
        sent_at: new Date().toISOString()
      });

    if (emailResult.success) {
      return { success: true, sentTo: testEmail };
    } else {
      return { success: false, error: emailResult.error };
    }
  } catch (error) {
    console.error('Error in sendTestEmail:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

// Send reminder emails to all recipients
async function sendReminderEmails(orgId: string, reminderType: 'payroll' | 'weekly'): Promise<{ success: boolean; sent: number; failed: number; errors: string[] }> {
  try {
    // Get email settings
    const emailSettings = await getEmailSettings(orgId);
    if (!emailSettings) {
      return { success: false, sent: 0, failed: 0, errors: ['Email settings not configured'] };
    }

    // Get reminder settings
    const { data: settings, error: settingsError } = await supabase
      .from('reminder_settings')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (settingsError || !settings) {
      return { success: false, sent: 0, failed: 0, errors: ['Reminder settings not found'] };
    }

    // Get email template
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('org_id', orgId)
      .eq('template_type', reminderType)
      .single();

    if (templateError || !template) {
      return { success: false, sent: 0, failed: 0, errors: [`${reminderType} email template not found`] };
    }

    // Get recipients
    const recipients = await getEmailRecipients(orgId, settings.send_to_all);

    if (recipients.length === 0) {
      return { success: false, sent: 0, failed: 0, errors: ['No recipients found'] };
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Send emails to all recipients
    for (const recipient of recipients) {
      try {
        // Prepare variables based on reminder type
        const variables: Record<string, string> = {
          navn: recipient.display_name,
          link: `${Deno.env.get('SITE_URL') || 'https://bemanningsliste.vercel.app'}/min/uke`
        };
        
        // Log email attempt
        const logEntry = {
          org_id: orgId,
          recipient_email: recipient.email,
          recipient_name: recipient.display_name,
          subject: template.subject,
          template_type: reminderType,
          status: 'pending',
          triggered_by: 'cron',
          reminder_type: reminderType,
          sent_at: new Date().toISOString()
        };

        if (reminderType === 'payroll') {
          const payrollDate = new Date();
          payrollDate.setDate(settings.payroll_day_of_month);
          variables.frist = payrollDate.toLocaleDateString('no-NO', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        } else if (reminderType === 'weekly') {
          const now = new Date();
          const weekNumber = getWeekNumber(now);
          variables.uke = weekNumber.toString();
        }

        // Replace variables in template
        const subject = replaceTemplateVariables(template.subject, variables);
        const htmlContent = replaceTemplateVariables(template.body_html, variables);
        const textContent = replaceTemplateVariables(template.body_text, variables);

        // Send email
        const emailResult = await sendEmail(recipient.email!, subject, htmlContent, textContent, emailSettings);

        // Update log entry with result
        const updatedLogEntry = {
          ...logEntry,
          status: emailResult.success ? 'sent' : 'failed',
          error_message: emailResult.success ? null : emailResult.error,
          message_id: emailResult.messageId || null,
          provider_response: emailResult.providerResponse || null
        };

        // Insert email log
        await supabase.from('email_logs').insert(updatedLogEntry);

        if (emailResult.success) {
          sent++;
        } else {
          failed++;
          errors.push(`${recipient.display_name}: ${emailResult.error}`);
        }
      } catch (error) {
        failed++;
        errors.push(`${recipient.display_name}: ${error.message}`);
      }
    }

    // Log results
    const status = failed === 0 ? 'success' : (sent === 0 ? 'failed' : 'partial');
    await supabase
      .from('reminder_logs')
      .insert({
        org_id: orgId,
        reminder_type: reminderType,
        recipients_count: sent,
        status: status,
        error_message: errors.length > 0 ? errors.join('; ') : null
      });

    return { success: sent > 0, sent, failed, errors };
  } catch (error) {
    console.error('Error in sendReminderEmails:', error);
    return { success: false, sent: 0, failed: 0, errors: [error.message || 'Unknown error'] };
  }
}

// Send reminder emails to all organizations (for cron jobs)
async function sendReminderEmailsToAllOrgs(reminderType: 'payroll' | 'weekly'): Promise<{ success: boolean; processedOrgs: number; totalSent: number; totalFailed: number; errors: string[] }> {
  try {
    console.log(`Starting ${reminderType} reminder job for all organizations`);

    // Get all organizations with active email settings and reminder settings
    const { data: orgs, error: orgsError } = await supabase
      .from('email_settings')
      .select(`
        org_id,
        is_active,
        reminder_settings!inner(
          id,
          payroll_enabled,
          weekly_enabled,
          payroll_days_before,
          weekly_day_of_week,
          weekly_time,
          send_to_all
        )
      `)
      .eq('is_active', true);

    if (orgsError) {
      console.error('Error fetching organizations:', orgsError);
      return { success: false, processedOrgs: 0, totalSent: 0, totalFailed: 0, errors: [orgsError.message] };
    }

    if (!orgs || orgs.length === 0) {
      console.log('No organizations with active email settings found');
      return { success: true, processedOrgs: 0, totalSent: 0, totalFailed: 0, errors: [] };
    }

    let processedOrgs = 0;
    let totalSent = 0;
    let totalFailed = 0;
    const errors: string[] = [];

    // Process each organization
    for (const org of orgs) {
      try {
        const settings = org.reminder_settings;
        
        // Check if this reminder type is enabled for this org
        if (reminderType === 'payroll' && !settings.payroll_enabled) {
          console.log(`Skipping ${org.org_id} - payroll reminders disabled`);
          continue;
        }
        
        if (reminderType === 'weekly' && !settings.weekly_enabled) {
          console.log(`Skipping ${org.org_id} - weekly reminders disabled`);
          continue;
        }

        // Check timing for payroll reminders
        if (reminderType === 'payroll') {
          const today = new Date();
          const payrollDay = settings.payroll_day_of_month; // Day of month for payroll (1-31)
          const daysBefore = settings.payroll_days_before; // Days before payroll to send reminder
          
          // Calculate when payroll reminder should be sent
          const reminderDate = new Date(today.getFullYear(), today.getMonth(), payrollDay);
          reminderDate.setDate(reminderDate.getDate() - daysBefore);
          
          // Check if today is the reminder day (within 1 day window)
          const todayStr = today.toISOString().split('T')[0];
          const reminderStr = reminderDate.toISOString().split('T')[0];
          
          if (todayStr !== reminderStr) {
            console.log(`Skipping ${org.org_id} - not payroll reminder day (today: ${todayStr}, reminder: ${reminderStr})`);
            continue;
          }
        }

        // Check timing for weekly reminders
        if (reminderType === 'weekly') {
          const today = new Date();
          const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
          const currentTime = today.getHours() * 60 + today.getMinutes(); // minutes since midnight
          
          // Parse weekly_time (format: "HH:MM:SS")
          const [hours, minutes] = settings.weekly_time.split(':').map(Number);
          const reminderTime = hours * 60 + minutes;
          
          // Check if today is the correct day and time (within 1 hour window)
          const weeklyDay = settings.weekly_day; // 1=Monday, 2=Tuesday, etc.
          const dayMatch = (dayOfWeek === 0 && weeklyDay === 7) || (dayOfWeek === weeklyDay); // Handle Sunday=0 vs 7
          const timeMatch = Math.abs(currentTime - reminderTime) <= 60; // Within 1 hour
          
          if (!dayMatch || !timeMatch) {
            console.log(`Skipping ${org.org_id} - not weekly reminder time (today: ${dayOfWeek}, reminder day: ${weeklyDay}, current time: ${currentTime}, reminder time: ${reminderTime})`);
            continue;
          }
        }

        console.log(`Processing ${reminderType} reminders for org ${org.org_id}`);
        
        // Send reminders for this organization
        const result = await sendReminderEmails(org.org_id, reminderType);
        
        processedOrgs++;
        totalSent += result.sent;
        totalFailed += result.failed;
        
        if (result.errors.length > 0) {
          errors.push(`Org ${org.org_id}: ${result.errors.join(', ')}`);
        }
        
        console.log(`Completed ${org.org_id}: sent=${result.sent}, failed=${result.failed}`);
        
      } catch (orgError) {
        console.error(`Error processing org ${org.org_id}:`, orgError);
        errors.push(`Org ${org.org_id}: ${orgError.message}`);
        processedOrgs++;
      }
    }

    console.log(`Completed ${reminderType} reminder job: processed=${processedOrgs}, sent=${totalSent}, failed=${totalFailed}`);
    
    return {
      success: processedOrgs > 0,
      processedOrgs,
      totalSent,
      totalFailed,
      errors
    };
    
  } catch (error) {
    console.error('Error in sendReminderEmailsToAllOrgs:', error);
    return { success: false, processedOrgs: 0, totalSent: 0, totalFailed: 0, errors: [error.message || 'Unknown error'] };
  }
}

// Helper function to get week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  const preflightResponse = handleCorsPreflight(req);
  if (preflightResponse) {
    return preflightResponse;
  }

  // Get CORS headers for the request
  const requestOrigin = req.headers.get('origin') || undefined;
  const corsHeaders = getCorsHeaders(requestOrigin);

  // Authentication check - verify JWT token
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ 
        error: 'Unauthorized', 
        message: 'Missing authorization header' 
      }),
      {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Create Supabase client with auth header
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: authHeader },
      },
    }
  );

  // Verify the user is authenticated
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  
  if (authError || !user) {
    console.error('Authentication failed:', authError?.message);
    return new Response(
      JSON.stringify({ 
        error: 'Unauthorized', 
        message: 'Invalid or expired token' 
      }),
      {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  console.log('✅ Authenticated user:', user.email);

  try {
    // Parse request body for parameters
    const body = await req.json();
    const { action, orgId, userId, testEmail } = body;

    if (!action || !orgId) {
      return new Response(JSON.stringify({ error: 'Missing action or orgId parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('email-reminders invoked', { action, orgId, userId });

    // ==================== AUTHORIZATION CHECK ====================
    // Special handling for orgId === "all" (system-wide operations)
    if (orgId === 'all') {
      // Only allow from service role or with valid trigger secret
      const isServiceRole = isServiceRoleRequest(req);
      const hasValidSecret = await validateTriggerSecret(req, 'email_reminders_secret');
      
      if (!isServiceRole && !hasValidSecret) {
        console.warn('Access denied: orgId="all" requires service role or valid secret');
        return createErrorResponse({
          error: 'Forbidden',
          message: 'System-wide operations can only be triggered by internal services',
          code: 'FORBIDDEN',
          httpStatus: 403
        }, corsHeaders);
      }
      
      console.log('✅ System-wide operation authorized (service role or valid secret)');
    } else {
      // Single organization operations require proper authorization
      if (action === 'send-test') {
        // Test emails: any user in the org can send to themselves
        const profileOrError = await requireOrgAccess(authHeader, orgId, 'user');
        
        if ('error' in profileOrError) {
          return createErrorResponse(profileOrError, corsHeaders);
        }
        
        console.log('✅ Test email authorized for user:', user.email);
      } else {
        // Reminder operations require admin/manager role
        const adminCheckOrError = await requireAdminOrManager(authHeader, orgId);
        
        if ('error' in adminCheckOrError) {
          console.warn(`Access denied: ${action} requires admin/manager role`);
          return createErrorResponse(adminCheckOrError, corsHeaders);
        }
        
        console.log(`✅ Reminder operation authorized: ${action}`);
      }
    }
    // ==================== END AUTHORIZATION CHECK ====================

    let result;

    switch (action) {
      case 'send-test':
        if (!testEmail) {
          return new Response(JSON.stringify({ error: 'Missing testEmail parameter' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        result = await sendTestEmail(orgId, testEmail);
        break;

      case 'send-payroll-reminder':
        if (orgId === 'all') {
          result = await sendReminderEmailsToAllOrgs('payroll');
        } else {
          result = await sendReminderEmails(orgId, 'payroll');
        }
        break;

      case 'send-weekly-reminder':
        if (orgId === 'all') {
          result = await sendReminderEmailsToAllOrgs('weekly');
        } else {
          result = await sendReminderEmails(orgId, 'weekly');
        }
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

  } catch (error: unknown) {
    console.error('Error in email-reminders function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
