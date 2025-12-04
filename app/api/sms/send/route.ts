/**
 * SMS Send API Routes
 *
 * POST: Send single SMS to a lead
 * PUT: Send bulk SMS campaign
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendSMS, sendBulkSMS, isOptedOut, normalizePhoneNumber } from '@/lib/twilio';
import { fillTemplate, getTemplateById, SMS_TEMPLATES } from '@/lib/sms-templates';
import { supabase } from '@/lib/supabase';

/**
 * POST - Send SMS to a single lead
 *
 * Body: {
 *   leadId: string,
 *   message?: string,           // Direct message
 *   templateId?: string,        // Or use a template
 *   variables?: object          // Variables for template
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, message, templateId, variables = {} } = body;

    if (!leadId) {
      return NextResponse.json(
        { error: 'leadId is required' },
        { status: 400 }
      );
    }

    // Get lead with property data
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select(`
        id,
        phone,
        status,
        properties!inner (
          address,
          city,
          owner_name
        )
      `)
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    if (!lead.phone) {
      return NextResponse.json(
        { error: 'Lead has no phone number. Run skip trace first.' },
        { status: 400 }
      );
    }

    // Check if lead has opted out
    if (lead.status === 'dead') {
      return NextResponse.json(
        { error: 'Lead has opted out of messages' },
        { status: 400 }
      );
    }

    const optedOut = await isOptedOut(lead.phone);
    if (optedOut) {
      return NextResponse.json(
        { error: 'This phone number has opted out' },
        { status: 400 }
      );
    }

    // Build the message
    let finalMessage = message;

    if (!finalMessage && templateId) {
      const template = getTemplateById(templateId);
      if (!template) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 400 }
        );
      }

      // Build variables from lead data
      const props = lead.properties as any;
      const templateVars = {
        ownerName: props?.owner_name,
        address: props?.address,
        city: props?.city,
        ...variables,
      };

      finalMessage = fillTemplate(template.body, templateVars);
    }

    if (!finalMessage) {
      return NextResponse.json(
        { error: 'Either message or templateId is required' },
        { status: 400 }
      );
    }

    // Send the SMS
    const result = await sendSMS(lead.phone, finalMessage, leadId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send SMS' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageSid: result.messageSid,
      status: result.status,
      to: normalizePhoneNumber(lead.phone),
      message: finalMessage,
    });
  } catch (error) {
    console.error('SMS send error:', error);
    return NextResponse.json(
      { error: 'Failed to send SMS' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Send bulk SMS campaign
 *
 * Body: {
 *   leadIds: string[],          // Array of lead IDs
 *   templateId?: string,        // Use a template
 *   message?: string,           // Or direct message (variables will be replaced)
 *   filter?: {                  // Optional filter instead of leadIds
 *     temperature?: 'hot' | 'warm' | 'cold',
 *     county?: 'Chatham' | 'Effingham',
 *     hasPhone?: boolean,
 *     notContacted?: boolean
 *   }
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadIds, templateId, message, filter } = body;

    // Get template if specified
    let template = templateId ? getTemplateById(templateId) : null;

    if (!message && !template) {
      return NextResponse.json(
        { error: 'Either message or templateId is required' },
        { status: 400 }
      );
    }

    // Build query for leads
    let query = supabase
      .from('leads')
      .select(`
        id,
        phone,
        status,
        properties!inner (
          address,
          city,
          owner_name,
          county
        ),
        distress_indicators:properties(distress_indicators(type, amount_owed, auction_date))
      `)
      .not('phone', 'is', null)
      .neq('status', 'dead'); // Exclude opted-out leads

    // Apply leadIds filter
    if (leadIds && Array.isArray(leadIds) && leadIds.length > 0) {
      query = query.in('id', leadIds);
    }
    // Or apply filter criteria
    else if (filter) {
      if (filter.temperature) {
        query = query.eq('temperature', filter.temperature);
      }
      if (filter.county) {
        query = query.eq('properties.county', filter.county);
      }
      if (filter.notContacted) {
        query = query.is('last_contacted_at', null);
      }
    } else {
      return NextResponse.json(
        { error: 'Either leadIds or filter is required' },
        { status: 400 }
      );
    }

    const { data: leads, error: leadsError } = await query.limit(100); // Max 100 per batch

    if (leadsError) {
      return NextResponse.json(
        { error: 'Failed to fetch leads' },
        { status: 500 }
      );
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json(
        { error: 'No eligible leads found' },
        { status: 400 }
      );
    }

    // Build messages for each lead
    const messages = leads.map((lead: any) => {
      const props = lead.properties;
      const distress = lead.distress_indicators?.[0]?.distress_indicators || [];

      // Get distress-specific info
      const foreclosure = distress.find((d: any) => d.type === 'foreclosure' || d.type === 'pre_foreclosure');
      const taxDelinquent = distress.find((d: any) => d.type === 'tax_delinquent');

      const templateVars = {
        ownerName: props?.owner_name,
        address: props?.address,
        city: props?.city,
        amount: taxDelinquent?.amount_owed || foreclosure?.amount_owed,
        auctionDate: foreclosure?.auction_date,
      };

      const messageBody = template
        ? fillTemplate(template.body, templateVars)
        : fillTemplate(message, templateVars);

      return {
        leadId: lead.id,
        phone: lead.phone,
        body: messageBody,
      };
    });

    // Send bulk SMS
    const result = await sendBulkSMS(messages);

    return NextResponse.json({
      success: true,
      total: result.total,
      sent: result.sent,
      failed: result.failed,
      results: result.results,
    });
  } catch (error) {
    console.error('Bulk SMS error:', error);
    return NextResponse.json(
      { error: 'Failed to send bulk SMS' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get available templates
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  let templates = SMS_TEMPLATES;

  if (category) {
    templates = templates.filter(t => t.category === category);
  }

  return NextResponse.json({
    success: true,
    templates: templates.map(t => ({
      id: t.id,
      name: t.name,
      category: t.category,
      body: t.body,
      description: t.description,
    })),
  });
}
