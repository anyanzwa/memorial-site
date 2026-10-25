import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const consumerKey = Deno.env.get('MPESA_CONSUMER_KEY')!
const consumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET')!
const passkey = Deno.env.get('MPESA_PASSKEY')!

const supabaseUrl = "https://fbyudpgnftqsjdavonrk.supabase.co"
// Key now comes from Supabase secrets (set with: npx supabase secrets set MY_SECRET_KEY="...")
const supabaseKey = Deno.env.get('MY_SECRET_KEY')!

const shortcode = "174379";
const partyB = "174379";
const baseUrl = "https://sandbox.safaricom.co.ke";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!supabaseKey) throw new Error("MY_SECRET_KEY secret is not set on the function.");

    const { phone, amount, obituaryId, accountRef, donorName } = await req.json()

    if (!phone) throw new Error("Phone number is missing.");

    const callbackUrl = `${supabaseUrl}/functions/v1/mpesa-callback`

    // 1. Get Safaricom Access Token
    const auth = btoa(`${consumerKey}:${consumerSecret}`)
    const tokenResponse = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` }
    })
    const tokenData = await tokenResponse.json()

    if (!tokenData.access_token) {
      throw new Error("Failed to get Safaricom Access Token.");
    }

    // 2. Format Phone Number
    let formattedPhone = phone.replace(/[^0-9]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.slice(1);
    } else if (formattedPhone.length === 9) {
      formattedPhone = '254' + formattedPhone;
    }

    // 3. STK Push Request
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
    const password = btoa(`${shortcode}${passkey}${timestamp}`)

    const stkResponse = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: formattedPhone,
        PartyB: partyB,
        PhoneNumber: formattedPhone,
        CallBackURL: callbackUrl,
        AccountReference: accountRef || `Tribute`,
        TransactionDesc: `Donation from ${donorName}`
      })
    })

    const stkData = await stkResponse.json()

    if (!stkData.CheckoutRequestID) {
      return new Response(JSON.stringify({ error: stkData.errorMessage || "Safaricom rejected the request" }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    // 4. Save to Database using RAW FETCH
    // sb_secret_ keys are not JWTs, so only the apikey header is sent (no Authorization: Bearer)
    const finalObituaryId = (obituaryId && obituaryId !== 'null') ? obituaryId : null;

    const dbResponse = await fetch(`${supabaseUrl}/rest/v1/mpesa_transactions`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        obituary_id: finalObituaryId,
        checkout_request_id: stkData.CheckoutRequestID,
        merchant_request_id: stkData.MerchantRequestID,
        phone_number: formattedPhone,
        amount: Math.round(amount),
        account_reference: accountRef || `Tribute`,
        status: 'pending'
      })
    })

    if (!dbResponse.ok) {
      const errText = await dbResponse.text();
      throw new Error(`DB Error: ${errText}`);
    }

    return new Response(JSON.stringify(stkData), { headers: { 'Content-Type': 'application/json', ...corsHeaders } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
})