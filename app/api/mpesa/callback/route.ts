import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // Catch the raw JSON payload from Safaricom Daraja
    const data = await req.json();

    console.log("\n=====================================");
    console.log("💰 REAL M-PESA CALLBACK RECEIVED 💰");
    console.log("=====================================");
    
    // Check if the transaction was actually successful
    const resultCode = data.Body.stkCallback.ResultCode;
    
    if (resultCode === 0) {
      console.log("✅ TRANSACTION SUCCESSFUL!");
      console.log("Details:");
      console.log(JSON.stringify(data.Body.stkCallback.CallbackMetadata.Item, null, 2));
      
      // NOTE: In Production, this is where you would run a Supabase command 
      // to officially update the user's Escrow balance in the database.
    } else {
      console.log("❌ TRANSACTION FAILED OR CANCELLED.");
      console.log("Reason:", data.Body.stkCallback.ResultDesc);
    }
    console.log("=====================================\n");

    // You MUST reply to Safaricom letting them know you received the message
    return NextResponse.json({ 
      "ResultCode": 0, 
      "ResultDesc": "Confirmation Received Successfully" 
    });

  } catch (error) {
    console.error("Callback Error:", error);
    return NextResponse.json({ error: "Failed to process callback" }, { status: 500 });
  }
}