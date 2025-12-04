/**
 * Twilio SMS Integration
 *
 * Handles sending SMS messages via Twilio API.
 * Includes rate limiting and error handling.
 */

import twilio from 'twilio';
import { supabase } from '@/lib/supabase';

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Create client only if credentials are available
const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export interface SendSMSResult {
  success: boolean;
  messageSid?: string;
  status?: string;
  error?: string;
}

export interface BulkSMSResult {
  total: number;
  sent: number;
  failed: number;
  results: Array<{
    leadId: string;
    phone: string;
    success: boolean;
    messageSid?: string;
    error?: string;
  }>;
}

/**
 * Send a single SMS message
 */
export async function sendSMS(
  to: string,
  body: string,
  leadId?: string
): Promise<SendSMSResult> {
  if (!client) {
    return {
      success: false,
      error: 'Twilio client not initialized. Check environment variables.',
    };
  }

  if (!twilioPhoneNumber) {
    return {
      success: false,
      error: 'Twilio phone number not configured.',
    };
  }

  try {
    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(to);
    if (!normalizedPhone) {
      return {
        success: false,
        error: 'Invalid phone number format',
      };
    }

    // Send the message
    const message = await client.messages.create({
      body,
      from: twilioPhoneNumber,
      to: normalizedPhone,
    });

    // Log the message to database if leadId provided
    if (leadId) {
      await logSMSMessage({
        leadId,
        direction: 'outbound',
        fromNumber: twilioPhoneNumber,
        toNumber: normalizedPhone,
        body,
        status: message.status,
        twilioSid: message.sid,
      });

      // Update lead's last contacted timestamp
      await supabase
        .from('leads')
        .update({
          last_contacted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);
    }

    return {
      success: true,
      messageSid: message.sid,
      status: message.status,
    };
  } catch (error: any) {
    const errorMessage = error.message || 'Failed to send SMS';

    // Log failed attempt if leadId provided
    if (leadId) {
      await logSMSMessage({
        leadId,
        direction: 'outbound',
        fromNumber: twilioPhoneNumber!,
        toNumber: to,
        body,
        status: 'failed',
        errorMessage,
      });
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send bulk SMS to multiple leads
 */
export async function sendBulkSMS(
  messages: Array<{
    leadId: string;
    phone: string;
    body: string;
  }>,
  delayMs: number = 1000 // 1 second between messages to avoid rate limiting
): Promise<BulkSMSResult> {
  const result: BulkSMSResult = {
    total: messages.length,
    sent: 0,
    failed: 0,
    results: [],
  };

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    const sendResult = await sendSMS(msg.phone, msg.body, msg.leadId);

    result.results.push({
      leadId: msg.leadId,
      phone: msg.phone,
      success: sendResult.success,
      messageSid: sendResult.messageSid,
      error: sendResult.error,
    });

    if (sendResult.success) {
      result.sent++;
    } else {
      result.failed++;
    }

    // Rate limit - wait between messages (except for last one)
    if (i < messages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return result;
}

/**
 * Process inbound SMS message
 */
export async function processInboundSMS(
  from: string,
  to: string,
  body: string,
  messageSid: string
): Promise<{ leadId?: string; isOptOut: boolean; isHot: boolean }> {
  const result = { leadId: undefined as string | undefined, isOptOut: false, isHot: false };

  // Normalize the phone number
  const normalizedFrom = normalizePhoneNumber(from);
  if (!normalizedFrom) {
    return result;
  }

  // Check for opt-out keywords
  const optOutKeywords = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];
  const upperBody = body.toUpperCase().trim();
  result.isOptOut = optOutKeywords.some(keyword => upperBody === keyword);

  // Find the lead by phone number
  const { data: lead } = await supabase
    .from('leads')
    .select('id, temperature, status')
    .eq('phone', normalizedFrom)
    .single();

  if (lead) {
    result.leadId = lead.id;

    // Log the inbound message
    await logSMSMessage({
      leadId: lead.id,
      direction: 'inbound',
      fromNumber: normalizedFrom,
      toNumber: to,
      body,
      status: 'received',
      twilioSid: messageSid,
    });

    if (result.isOptOut) {
      // Mark lead as opted out / dead
      await supabase
        .from('leads')
        .update({
          status: 'dead',
          notes: `Opted out via SMS: "${body}"`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id);

      // Log opt-out activity
      await supabase
        .from('activities')
        .insert({
          lead_id: lead.id,
          type: 'sms',
          content: `Lead opted out with message: "${body}"`,
          metadata: { opt_out: true, original_message: body },
        });
    } else {
      // Response received - mark as hot if not already
      result.isHot = true;

      await supabase
        .from('leads')
        .update({
          temperature: 'hot',
          score: Math.max(lead.temperature === 'hot' ? 0 : 80, 0), // Bump to at least 80
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id);

      // Log response activity
      await supabase
        .from('activities')
        .insert({
          lead_id: lead.id,
          type: 'sms',
          content: `Lead responded to SMS: "${body}"`,
          metadata: { response: true, message: body },
        });
    }
  }

  return result;
}

/**
 * Log SMS message to database
 */
async function logSMSMessage(data: {
  leadId: string;
  direction: 'inbound' | 'outbound';
  fromNumber: string;
  toNumber: string;
  body: string;
  status: string;
  twilioSid?: string;
  errorMessage?: string;
}): Promise<void> {
  await supabase.from('sms_messages').insert({
    lead_id: data.leadId,
    direction: data.direction,
    from_number: data.fromNumber,
    to_number: data.toNumber,
    body: data.body,
    status: data.status,
    twilio_sid: data.twilioSid,
    error_message: data.errorMessage,
  });
}

/**
 * Normalize phone number to E.164 format
 */
export function normalizePhoneNumber(phone: string): string | null {
  if (!phone) return null;

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // Handle different formats
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  } else if (digits.length === 12 && digits.startsWith('1')) {
    return `+${digits.slice(1)}`;
  }

  return null;
}

/**
 * Calculate SMS segments (each segment is ~160 chars for GSM, ~70 for Unicode)
 */
export function calculateSMSSegments(message: string): {
  segments: number;
  characters: number;
  isUnicode: boolean;
  maxPerSegment: number;
} {
  // Check if message contains non-GSM characters
  const gsmChars = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-.\/0-9:;<=>?¡A-ZÄÖÑܧ¿a-zäöñüà]*$/;
  const isUnicode = !gsmChars.test(message);

  const maxPerSegment = isUnicode ? 70 : 160;
  const characters = message.length;

  // Single segment if under limit
  if (characters <= maxPerSegment) {
    return { segments: 1, characters, isUnicode, maxPerSegment };
  }

  // Multi-part messages have fewer chars per segment due to headers
  const multiPartMax = isUnicode ? 67 : 153;
  const segments = Math.ceil(characters / multiPartMax);

  return { segments, characters, isUnicode, maxPerSegment };
}

/**
 * Get SMS conversation history for a lead
 */
export async function getSMSHistory(leadId: string): Promise<any[]> {
  const { data } = await supabase
    .from('sms_messages')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true });

  return data || [];
}

/**
 * Check if a phone number has opted out
 */
export async function isOptedOut(phone: string): Promise<boolean> {
  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) return false;

  const { data } = await supabase
    .from('leads')
    .select('status')
    .eq('phone', normalizedPhone)
    .single();

  return data?.status === 'dead';
}
