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

    console.log('tripletex-create-profile called with:', { orgId, employeeId });

    if (!orgId || !employeeId) {
      console.log('❌ RETURN 400: Missing required parameters:', { orgId, employeeId });
      return new Response(
        JSON.stringify({ success: false, error: 'orgId og employeeId er påkrevd.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    console.log('Environment check:', { 
      hasSupabaseUrl: !!supabaseUrl, 
      hasServiceRoleKey: !!serviceRoleKey,
      supabaseUrlLength: supabaseUrl.length,
      serviceRoleKeyLength: serviceRoleKey.length
    });

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ RETURN 500: Missing Supabase configuration:', { supabaseUrl, serviceRoleKey });
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

    console.log('User auth check:', { user: user?.id, error: userError?.message });

    if (userError || !user) {
      console.log('❌ RETURN 401: Authentication failed:', userError);
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

    console.log('Profile lookup:', { profile, error: profileError?.message });

    if (profileError) {
      console.error('❌ RETURN 500: Feil ved henting av profil for bruker', user.id, profileError);
      return new Response(
        JSON.stringify({ success: false, error: 'Kunne ikke hente profil for innlogget bruker.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!profile || profile.org_id !== orgId) {
      console.log('❌ RETURN 403: Access denied - profile check:', { 
        hasProfile: !!profile, 
        profileOrgId: profile?.org_id, 
        requestedOrgId: orgId 
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Bruker har ikke tilgang til valgt organisasjon.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    if (!['admin', 'manager'].includes(profile.role)) {
      console.log('❌ RETURN 403: Access denied - role check:', { role: profile.role });
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

    console.log('Employee lookup:', { 
      employeeId, 
      orgId, 
      employee: employee ? {
        id: employee.id,
        fornavn: employee.fornavn,
        etternavn: employee.etternavn,
        epost: employee.epost,
        tripletex_employee_id: employee.tripletex_employee_id,
        aktiv: employee.aktiv
      } : null,
      error: employeeError?.message 
    });

    if (employeeError) {
      console.error('❌ RETURN 500: Database error during employee lookup:', employeeError);
      return new Response(
        JSON.stringify({ success: false, error: 'Database-feil ved oppslag av ansatt.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!employee) {
      console.log('❌ RETURN 404: Employee not found:', { employeeId, orgId });
      return new Response(
        JSON.stringify({ success: false, error: 'Fant ikke Tripletex-ansatt.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (!employee.epost) {
      console.log('❌ RETURN 400: Employee missing email:', { employeeId, epost: employee.epost });
      return new Response(
        JSON.stringify({ success: false, error: 'Ansatt mangler e-postadresse i Tripletex.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!employee.tripletex_employee_id) {
      console.log('❌ RETURN 400: Employee missing tripletex_employee_id:', { employeeId, tripletex_employee_id: employee.tripletex_employee_id });
      return new Response(
        JSON.stringify({ success: false, error: 'Ansatt mangler Tripletex ID.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const normalizedEmail = String(employee.epost).trim().toLowerCase();

    const isLikelyValidEmail = (email: string) => {
      // Simple RFC5322-inspired validation to fail fast before calling Supabase
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    if (!isLikelyValidEmail(normalizedEmail)) {
      console.log('❌ RETURN 400: Invalid email format from Tripletex', { employeeId, email: employee.epost });
      return new Response(
        JSON.stringify({ success: false, error: 'Ansatt mangler gyldig e-postadresse.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { error: personLookupError } = await supabaseAdmin
      .from('person')
      .select('id')
      .eq('org_id', orgId)
      .eq('tripletex_employee_id', employee.tripletex_employee_id)
      .maybeSingle();

    if (personLookupError) {
      console.error('❌ RETURN 500: Feil ved oppslag av person', personLookupError);
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

    console.log('Person payload:', personPayload);

    const { data: upsertedPerson, error: personUpsertError } = await supabaseAdmin
      .from('person')
      .upsert(personPayload, { onConflict: 'org_id,tripletex_employee_id' })
      .select('id')
      .single();

    console.log('Person upsert result:', { 
      upsertedPerson, 
      error: personUpsertError?.message,
      errorDetails: personUpsertError 
    });

    if (personUpsertError) {
      console.error('❌ RETURN 500: Feil ved oppdatering/opprettelse av person', personUpsertError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Kunne ikke opprette eller oppdatere person i organisasjonen (${personUpsertError.message}).`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Check if user already exists using listUsers and match on normalized email
    const { data: usersList, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
      email: normalizedEmail
    });

    if (listUsersError) {
      console.error('❌ RETURN 500: Feil ved oppslag av eksisterende bruker', listUsersError);
      return new Response(
        JSON.stringify({ success: false, error: `Kunne ikke sjekke om bruker allerede eksisterer (${listUsersError.message}).` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const existingUser = usersList?.users?.find(user => user.email?.toLowerCase() === normalizedEmail) ?? null;

    console.log('User lookup result:', { 
      searchedEmail: normalizedEmail,
      foundUser: existingUser ? { id: existingUser.id, email: existingUser.email } : null,
      usersReturned: usersList?.users?.length || 0
    });

    let authUserId: string | undefined = existingUser?.id;
    let invitationSent = false;

    console.log('User ID from lookup:', { existingUserId: authUserId });

    if (!authUserId) {
      console.log('Creating new user invitation for:', normalizedEmail);
      const { data: invitedUser, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        normalizedEmail,
        {
          data: {
            source: 'tripletex-sync',
            orgId
          }
        }
      );

      console.log('Invitation result:', { invitedUserId: invitedUser?.user?.id, error: inviteError?.message });

      if (inviteError) {
        console.error('❌ RETURN 500: Feil ved utsendelse av invitasjon', inviteError);
        const statusCode = inviteError.status === 400 ? 400 : 500;
        const errorMessage = inviteError.code === 'email_address_invalid'
          ? 'Supabase godtar ikke e-postadressen. Kontroller at den er gyldig og ikke inneholder spesialtegn.'
          : `Kunne ikke sende invitasjon til brukeren (${inviteError.message}).`;

        return new Response(
          JSON.stringify({ success: false, error: errorMessage }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: statusCode }
        );
      }

      authUserId = invitedUser?.user?.id;
      invitationSent = true;
    }

    if (!authUserId) {
      console.log('❌ RETURN 500: Kunne ikke identifisere eller opprette Supabase-bruker');
      return new Response(
        JSON.stringify({ success: false, error: 'Kunne ikke identifisere eller opprette Supabase-bruker.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Ensure user is not already tied to another organization
    const { data: existingProfileAnyOrg, error: profileAnyOrgError } = await supabaseAdmin
      .from('profiles')
      .select('id, org_id')
      .eq('user_id', authUserId)
      .maybeSingle();

    if (profileAnyOrgError) {
      console.error('❌ RETURN 500: Feil ved oppslag av eksisterende profil (alle org)', profileAnyOrgError);
      return new Response(
        JSON.stringify({ success: false, error: `Kunne ikke verifisere eksisterende brukerprofil (${profileAnyOrgError.message}).` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (existingProfileAnyOrg && existingProfileAnyOrg.org_id !== orgId) {
      console.log('❌ RETURN 409: User already attached to another organization', {
        authUserId,
        existingOrg: existingProfileAnyOrg.org_id,
        requestedOrg: orgId
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Bruker er allerede tilknyttet en annen organisasjon.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
      );
    }

    const { data: existingProfileForUser, error: existingProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id, org_id, role')
      .eq('user_id', authUserId)
      .eq('org_id', orgId)
      .maybeSingle();

    console.log('Checking for existing profile:', { 
      authUserId, 
      orgId, 
      existingProfile: existingProfileForUser 
    });

    if (existingProfileError && existingProfileError.code !== 'PGRST116') {
      console.error('❌ RETURN 500: Feil ved oppslag av eksisterende profil for org', existingProfileError);
      return new Response(
        JSON.stringify({ success: false, error: `Kunne ikke hente eksisterende profil (${existingProfileError.message}).` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // If user already has a profile in this org, skip further processing
    if (existingProfileForUser) {
      console.log('✅ RETURN 200: User already exists in this organization:', {
        userId: authUserId,
        email: normalizedEmail,
        existingRole: existingProfileForUser.role,
        personId: upsertedPerson.id
      });

      return new Response(
        JSON.stringify({
          success: true,
          alreadyExists: true,
          personId: upsertedPerson.id,
          userId: authUserId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // For new Tripletex-ansatte, create new profile with 'user' role
    // Admin can later change the role in user management
    const profilePayload = {
      user_id: authUserId,
      org_id: orgId,
      display_name: `${employee.fornavn} ${employee.etternavn}`,
      role: 'user' // Always start with 'user' role for new Tripletex employees
    } satisfies Record<string, Json>;

    console.log('Creating new profile for user:', authUserId);
    console.log('Profile payload:', profilePayload);

    const { error: insertProfileError } = await supabaseAdmin
      .from('profiles')
      .insert(profilePayload);

    if (insertProfileError) {
      console.error('❌ RETURN 500: Feil ved opprettelse av ny profil', insertProfileError);
      return new Response(
        JSON.stringify({ success: false, error: `Kunne ikke opprette profil for brukeren (${insertProfileError.message}).` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('✅ RETURN 200: Success - new user created:', { 
      invitationSent, 
      personId: upsertedPerson.id, 
      userId: authUserId,
      email: normalizedEmail,
      wasExistingUser: !!existingUser,
      profileAction: 'created'
    });

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
    console.error('❌ RETURN 500: Uventet feil i tripletex-create-profile', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Uventet feil under opprettelse av bruker.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
