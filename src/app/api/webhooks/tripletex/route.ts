import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🔔 FieldNote webhook received from Tripletex');
    
    // Parse the webhook payload
    const payload = await request.json();
    console.log('📥 Webhook payload:', JSON.stringify(payload, null, 2));
    
    // Forward to Supabase Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log('🔧 Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      serviceKeyLength: supabaseServiceKey?.length || 0
    });
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase configuration');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const webhookUrl = `${supabaseUrl}/functions/v1/tripletex-webhook`;
    
    console.log('🔄 Forwarding webhook to Supabase:', webhookUrl);
    
    // Forward the webhook to Supabase Edge Function
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(payload),
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
