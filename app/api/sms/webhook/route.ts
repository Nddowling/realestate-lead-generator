/**
 * SMS Webhook API Route
 *
 * Receives inbound SMS messages from Twilio
 * Set this URL in Twilio: https://your-domain.com/api/sms/webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { processInboundSMS } from '@/lib/twilio';

// Twilio sends webhooks as form-urlencoded
export async function POST(request: NextRequest) {
  try {
    // Parse form data from Twilio
    const formData = await request.formData();

    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const body = formData.get('Body') as string;
    const messageSid = formData.get('MessageSid') as string;

    // Validate required fields
    if (!from || !body || !messageSid) {
      console.error('Missing required webhook fields:', { from, body, messageSid });
      return new NextResponse('Missing required fields', { status: 400 });
    }

    console.log('Received inbound SMS:', {
      from,
      to,
      body: body.substring(0, 50) + (body.length > 50 ? '...' : ''),
      messageSid,
    });

    // Process the inbound message
    const result = await processInboundSMS(from, to, body, messageSid);

    // Log the result
    if (result.leadId) {
      console.log('Matched to lead:', result.leadId, {
        isOptOut: result.isOptOut,
        isHot: result.isHot,
      });
    } else {
      console.log('No matching lead found for phone:', from);
    }

    // Return TwiML response
    // Empty response is fine - we don't auto-reply
    // To auto-reply, return: `<Response><Message>Your reply here</Message></Response>`
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
</Response>`;

    return new NextResponse(twimlResponse, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  } catch (error) {
    console.error('SMS webhook error:', error);

    // Return empty TwiML on error (don't crash the webhook)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
        },
      }
    );
  }
}

/**
 * GET - Health check for webhook
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'SMS webhook is active',
    timestamp: new Date().toISOString(),
  });
}
