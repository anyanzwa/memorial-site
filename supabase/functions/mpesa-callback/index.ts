import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const supabaseUrl = "https://fbyudpgnftqsjdavonrk.supabase.co"
const supabaseKey = Deno.env.get('MY_SECRET_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Safaricom expects this reply no matter what happens inside
const ack = (desc: string) =>
  new Response(JSON.stringify({ ResultCode: 0, ResultDesc: desc }), {
    headers: { 'Content-Type': 'application/json' },
  })

const dbHeaders = {
  'apikey': supabaseKey,
  'Content-Type': 'application/json',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!supabaseKey) {
      console.error("MY_SECRET_KEY is not set on this function.")
      return ack("Config error logged")
    }

    const body = await req.json()
    console.log("Callback received:", JSON.stringify(body))

    const callback = body.Body.stkCallback
    const checkoutId = callback.CheckoutRequestID

    // 1. Look up the saved transaction
    const checkRes = await fetch(
      `${supabaseUrl}/rest/v1/mpesa_transactions?checkout_request_id=eq.${encodeURIComponent(checkoutId)}&select=status,obituary_id,phone_number`,
      { headers: dbHeaders }
    )
    if (!checkRes.ok) {
      console.error("Lookup failed:", checkRes.status, await checkRes.text())
      return ack("Lookup error logged")
    }
    const existingData = await checkRes.json()
    const existing = existingData[0]

    if (!existing) {
      console.error("No transaction row found for checkout id:", checkoutId)
    }

    if (existing && existing.status === 'paid') {
      return ack("Already processed")
    }

    const resultCode = callback.ResultCode
    const resultDesc = callback.ResultDesc
    let receiptNumber = null
    let amount = 0

    if (resultCode === 0 && callback.CallbackMetadata) {
      const items = callback.CallbackMetadata.Item
      receiptNumber = items.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value
      amount = items.find((i: any) => i.Name === 'Amount')?.Value
    }

    // 2. Update the transaction status to 'paid' or 'failed'
    const patchRes = await fetch(
      `${supabaseUrl}/rest/v1/mpesa_transactions?checkout_request_id=eq.${encodeURIComponent(checkoutId)}`,
      {
        method: 'PATCH',
        headers: { ...dbHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          status: resultCode === 0 ? 'paid' : 'failed',
          result_code: resultCode,
          result_desc: resultDesc,
          mpesa_receipt: receiptNumber,
          updated_at: new Date().toISOString()
        })
      }
    )
    if (!patchRes.ok) {
      // Most common cause: a column name here does not exist in the table
      console.error("Status update failed:", patchRes.status, await patchRes.text())
      return ack("Update error logged")
    }

    // 3. If successful and it's a Contribution (has obituary_id), add to donations table
    if (resultCode === 0 && existing && existing.obituary_id) {
      const donationRes = await fetch(`${supabaseUrl}/rest/v1/donations`, {
        method: 'POST',
        headers: { ...dbHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          obituary_id: existing.obituary_id,
          donor_name: 'M-Pesa User',
          donor_phone: existing.phone_number,
          amount: amount,
          pledge_amount: amount,
          paid_amount: amount,
          status: 'paid',
          mpesa_receipt: receiptNumber
        })
      })
      if (!donationRes.ok) {
        console.error("Donation insert failed:", donationRes.status, await donationRes.text())
      }
    }

    return ack("Accepted")

  } catch (error) {
    console.error("Callback Error:", error)
    return ack("Error logged")
  }
})