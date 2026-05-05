import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { recipient, subject, body } = await req.json();

    const data = await resend.emails.send({
      from: 'Agrimove <onboarding@resend.dev>', // Use this for sandbox testing
      to: recipient,
      subject: subject,
      text: body,
    });

    // We still log to terminal so you can show the judges even if the email takes a second
    console.log(`✅ REAL EMAIL SENT TO: ${recipient}`);

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Email failed" }, { status: 500 });
  }
}