import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { amount, phone } = await req.json();

    // 1. Get Safaricom OAuth Token
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    const tokenRes = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: `Basic ${auth}` },
      cache: 'no-store'
    });
    const tokenData = await tokenRes.json();
    
    if (!tokenData.access_token) {
        throw new Error("Failed to get Daraja Token. Check your Consumer Key/Secret.");
    }
    const token = tokenData.access_token;

    // 2. Format Request Data
    const shortcode = process.env.MPESA_SHORTCODE || '174379';
    const passkey = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
    
    // Format timestamp to YYYYMMDDHHmmss
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    // Format phone number (Daraja expects 2547XXXXXXXX)
    let formattedPhone = phone.replace(/\s+/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.slice(1);
    } else if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.slice(1);
    }

    // 3. Trigger STK Push
    const stkRes = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.ceil(Number(amount)),
        PartyA: formattedPhone,
        PartyB: shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: 'https://rubbisy-karole-consentedly.ngrok-free.dev/api/mpesa/callback', // YOUR LIVE NGROK URL
        AccountReference: 'Agrimove Escrow',
        TransactionDesc: 'Escrow Top Up'
      })
    });

    const stkData = await stkRes.json();

    if (stkData.ResponseCode === '0') {
       return NextResponse.json({ success: true, message: 'STK Push sent successfully!' });
    } else {
       return NextResponse.json({ success: false, error: stkData.errorMessage || stkData.CustomerMessage }, { status: 400 });
    }

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}