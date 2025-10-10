import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidateInviteCodeRequest {
  code: string;
}

interface ValidateInviteCodeResponse {
  valid: boolean;
  org_id?: string;
  org_name?: string;
  role?: string;
  error_message?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Create auth client to verify user
    const authClient = createClient(supabaseUrl, serviceRoleKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    const {
      data: { user },
      error: userError
    } = await authClient.auth.getUser();

    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Parse request body
    const body = (await req.json()) as ValidateInviteCodeRequest;
    const { code } = body;

    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Invitasjonskode er påkrevd' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Validating invite code:', { code, userId: user.id });

    // Create admin client for validation
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Call database function to validate and use invite code
    const { data, error } = await adminClient.rpc('validate_and_use_invite_code', {
      p_code: code,
      p_user_id: user.id
    });

    if (error) {
      console.error('Error validating invite code:', error);
      return new Response(
        JSON.stringify({ error: 'Feil ved validering av invitasjonskode' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // data is an array with single result
    const result = Array.isArray(data) ? data[0] : data;

    console.log('Validation result:', result);

    if (!result.valid) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error_message: result.error_message 
        } as ValidateInviteCodeResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // If valid, create profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert({
        user_id: user.id,
        org_id: result.org_id,
        display_name: user.email?.split('@')[0] || 'User',
        role: result.role || 'user'
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Kunne ikke opprette profil' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Profile created successfully for user:', user.id);

    // Return success
    return new Response(
      JSON.stringify({
        valid: true,
        org_id: result.org_id,
        org_name: result.org_name,
        role: result.role
      } as ValidateInviteCodeResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'En ukjent feil oppstod' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

