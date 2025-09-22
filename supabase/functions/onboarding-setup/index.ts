import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth-bound client to get current user from the incoming request
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { orgName, orgNumber, displayName, role } = await req.json();

    if (!orgName || !displayName) {
      return new Response(
        JSON.stringify({ ok: false, message: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Service-role client to bypass RLS for setup operations
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1) Create organization
    const { data: orgInsert, error: orgError } = await serviceClient
      .from('org')
      .insert({ name: String(orgName).trim(), org_nr: orgNumber ? String(orgNumber).trim() : null })
      .select('id, name')
      .single();

    if (orgError) {
      console.error('onboarding-setup org insert error:', orgError);
      return new Response(
        JSON.stringify({ ok: false, message: 'Failed to create organization', details: orgError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orgId = orgInsert.id;

    // 2) Create or update profile for current user
    const { data: existingProfile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingProfile) {
      const { error: updateError } = await serviceClient
        .from('profiles')
        .update({ org_id: orgId, display_name: String(displayName).trim(), role: role || 'admin' })
        .eq('id', existingProfile.id);

      if (updateError) {
        console.error('onboarding-setup profile update error:', updateError);
        return new Response(
          JSON.stringify({ ok: false, message: 'Failed to update profile', details: updateError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      const { error: insertError } = await serviceClient
        .from('profiles')
        .insert({
          user_id: user.id,
          org_id: orgId,
          display_name: String(displayName).trim(),
          role: role || 'admin',
        });

      if (insertError) {
        console.error('onboarding-setup profile insert error:', insertError);
        return new Response(
          JSON.stringify({ ok: false, message: 'Failed to create profile', details: insertError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ ok: true, orgId, organization: orgInsert }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: unknown) {
    console.error('onboarding-setup unexpected error:', e);
    return new Response(
      JSON.stringify({ ok: false, message: 'Unexpected error', details: e?.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Deno serve
Deno.serve(handler);