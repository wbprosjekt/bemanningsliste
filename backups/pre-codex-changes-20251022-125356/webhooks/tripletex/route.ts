import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🔔 FieldNote webhook received from Tripletex');
    
    // Read raw payload to preserve signature integrity
    const rawBody = await request.text();
    let payload: unknown = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch (error) {
      console.error('❌ Failed to parse Tripletex webhook body:', error);
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    console.log('📥 Webhook payload:', JSON.stringify(payload, null, 2));
    
    // Forward to Supabase Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const tripletexSignature = request.headers.get('x-tripletex-signature') || request.headers.get('x-hub-signature-256');
    
    console.log('🔧 Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      serviceKeyLength: supabaseServiceKey?.length || 0,
      hasSignature: !!tripletexSignature
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase configuration');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const webhookUrl = `${supabaseUrl}/functions/v1/tripletex-webhook`;
    
    console.log('🔄 Forwarding webhook to Supabase:', webhookUrl);
    
    // Forward the webhook to Supabase Edge Function
    const forwardHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
    };

    if (tripletexSignature) {
      forwardHeaders['X-Tripletex-Signature'] = tripletexSignature;
      forwardHeaders['X-Hub-Signature-256'] = tripletexSignature;
    }

    const forwardBody = rawBody || JSON.stringify(payload);

    // Forward the webhook to Supabase Edge Function
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body: forwardBody,
    });
    
    if (!response.ok) {
      console.error('❌ Failed to forward webhook to Supabase:', response.status, response.statusText);
      return NextResponse.json({ error: 'Webhook forwarding failed' }, { status: 500 });
    }
    
    const result = await response.json();
    console.log('✅ Webhook forwarded successfully:', result);
    
    return NextResponse.json({ success: true, forwarded: true });
    
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
