import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TripletexCreateProfileRequest {
  orgId?: string;
  employeeId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const requestBody = (await req.json()) as TripletexCreateProfileRequest;
    const { orgId, employeeId } = requestBody;

    if (!orgId || !employeeId) {
      return new Response(
        JSON.stringify({ success: false, error: 'orgId og employeeId er påkrevd.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Supabase-konfigurasjon mangler.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const authHeader = req.headers.get('Authorization') ?? '';

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const supabaseWithUser = createClient(supabaseUrl, serviceRoleKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    const {
      data: { user },
      error: userError
    } = await supabaseWithUser.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Kunne ikke identifisere innlogget bruker.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, org_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Feil ved henting av profil for bruker', user.id, profileError);
      return new Response(
        JSON.stringify({ success: false, error: 'Kunne ikke hente profil for innlogget bruker.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!profile || profile.org_id !== orgId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Bruker har ikke tilgang til valgt organisasjon.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    if (!['admin', 'manager'].includes(profile.role)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Du må være admin eller manager for å opprette brukere.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from('ttx_employee_cache')
      .select('*')
      .eq('id', employeeId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (employeeError || !employee) {
      return new Response(
        JSON.stringify({ success: false, error: 'Fant ikke Tripletex-ansatt.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (!employee.epost) {
      return new Response(
        JSON.stringify({ success: false, error: 'Ansatt mangler e-postadresse i Tripletex.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const normalizedEmail = String(employee.epost).toLowerCase();

    const { error: personLookupError } = await supabaseAdmin
      .from('person')
      .select('id')
      .eq('org_id', orgId)
      .eq('tripletex_employee_id', employee.tripletex_employee_id)
      .maybeSingle();

    if (personLookupError) {
      console.error('Feil ved oppslag av person', personLookupError);
      return new Response(
        JSON.stringify({ success: false, error: 'Kunne ikke verifisere ansatt i personregisteret.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const personPayload = {
      org_id: orgId,
      fornavn: employee.fornavn,
      etternavn: employee.etternavn,
      epost: normalizedEmail,
      aktiv: employee.aktiv ?? true,
      tripletex_employee_id: employee.tripletex_employee_id,
    } satisfies Record<string, Json>;

    const { data: upsertedPerson, error: personUpsertError } = await supabaseAdmin
      .from('person')
      .upsert(personPayload, { onConflict: 'org_id,tripletex_employee_id' })
      .select('id')
      .single();

    if (personUpsertError) {
      console.error('Feil ved oppdatering/opprettelse av person', personUpsertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Kunne ikke opprette eller oppdatere person i organisasjonen.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserByEmail(normalizedEmail);

    let authUserId: string | undefined = existingUser?.user?.id;
    let invitationSent = false;

    if (!authUserId) {
      const { data: invitedUser, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        normalizedEmail,
        {
          data: {
            source: 'tripletex-sync',
            orgId
          }
        }
      );

      if (inviteError) {
        console.error('Feil ved utsendelse av invitasjon', inviteError);
        return new Response(
          JSON.stringify({ success: false, error: 'Kunne ikke sende invitasjon til brukeren.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      authUserId = invitedUser?.user?.id;
      invitationSent = true;
    }

    if (!authUserId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Kunne ikke identifisere eller opprette Supabase-bruker.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const { data: existingProfileForUser, error: existingProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id, org_id, role')
      .eq('user_id', authUserId)
      .maybeSingle();

    if (existingProfileError) {
      console.error('Feil ved kontroll av eksisterende profil', existingProfileError);
      return new Response(
        JSON.stringify({ success: false, error: 'Kunne ikke kontrollere eksisterende profil for brukeren.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (existingProfileForUser && existingProfileForUser.org_id !== orgId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Brukeren er allerede tilknyttet en annen organisasjon.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
      );
    }

    const profilePayload = {
      user_id: authUserId,
      org_id: orgId,
      display_name: `${employee.fornavn} ${employee.etternavn}`,
      role: existingProfileForUser?.role ?? 'user'
    } satisfies Record<string, Json>;

    const { error: upsertProfileError } = await supabaseAdmin
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'user_id' });

    if (upsertProfileError) {
      console.error('Feil ved opprettelse av profil', upsertProfileError);
      return new Response(
        JSON.stringify({ success: false, error: 'Kunne ikke opprette profil for brukeren.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        invitationSent,
        personId: upsertedPerson.id,
        userId: authUserId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Uventet feil i tripletex-create-profile', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Uventet feil under opprettelse av bruker.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
