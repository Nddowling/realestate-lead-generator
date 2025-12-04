/**
 * Skip Trace API Routes
 *
 * POST: Skip trace a single lead
 * PUT: Batch skip trace multiple leads (max 10)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  skipTraceLead,
  skipTraceLeads,
  getLeadsNeedingSkipTrace,
  SkipTraceInput,
} from '@/lib/scrapers/skip-trace';
import { supabase } from '@/lib/supabase';

/**
 * POST - Skip trace a single lead
 *
 * Body: { leadId: string } or { leadId: string, ownerName: string, city: string, state: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, ownerName, city, state, address } = body;

    if (!leadId) {
      return NextResponse.json(
        { error: 'leadId is required' },
        { status: 400 }
      );
    }

    let input: SkipTraceInput;

    // If full details not provided, fetch from database
    if (!ownerName || !city || !state) {
      const { data: lead, error } = await supabase
        .from('leads')
        .select(`
          id,
          properties!inner (
            owner_name,
            city,
            state,
            address
          )
        `)
        .eq('id', leadId)
        .single();

      if (error || !lead) {
        return NextResponse.json(
          { error: 'Lead not found' },
          { status: 404 }
        );
      }

      const props = lead.properties as any;
      if (!props?.owner_name) {
        return NextResponse.json(
          { error: 'Lead has no owner name to skip trace' },
          { status: 400 }
        );
      }

      input = {
        leadId,
        ownerName: props.owner_name,
        city: props.city,
        state: props.state,
        address: props.address,
      };
    } else {
      input = { leadId, ownerName, city, state, address };
    }

    // Perform skip trace
    const result = await skipTraceLead(input);

    return NextResponse.json({
      success: result.success,
      leadId: result.leadId,
      phones: result.phones,
      emails: result.emails,
      confidence: result.confidence,
      source: result.source,
      error: result.error,
    });
  } catch (error) {
    console.error('Skip trace error:', error);
    return NextResponse.json(
      { error: 'Failed to skip trace lead' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Batch skip trace multiple leads
 *
 * Body: { leadIds: string[] } or { leads: SkipTraceInput[] }
 * Max 10 leads at a time
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadIds, leads, delayMs = 7000 } = body;

    let inputs: SkipTraceInput[] = [];

    // If lead IDs provided, fetch details from database
    if (leadIds && Array.isArray(leadIds)) {
      if (leadIds.length > 10) {
        return NextResponse.json(
          { error: 'Maximum 10 leads per batch' },
          { status: 400 }
        );
      }

      const { data: dbLeads, error } = await supabase
        .from('leads')
        .select(`
          id,
          properties!inner (
            owner_name,
            city,
            state,
            address
          )
        `)
        .in('id', leadIds);

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch leads' },
          { status: 500 }
        );
      }

      inputs = (dbLeads || [])
        .filter((lead: any) => lead.properties?.owner_name)
        .map((lead: any) => ({
          leadId: lead.id,
          ownerName: lead.properties.owner_name,
          city: lead.properties.city,
          state: lead.properties.state,
          address: lead.properties.address,
        }));
    }
    // If full lead inputs provided
    else if (leads && Array.isArray(leads)) {
      if (leads.length > 10) {
        return NextResponse.json(
          { error: 'Maximum 10 leads per batch' },
          { status: 400 }
        );
      }
      inputs = leads;
    }
    // No valid input
    else {
      return NextResponse.json(
        { error: 'leadIds or leads array required' },
        { status: 400 }
      );
    }

    if (inputs.length === 0) {
      return NextResponse.json(
        { error: 'No valid leads to skip trace' },
        { status: 400 }
      );
    }

    // Perform batch skip trace
    const results = await skipTraceLeads(inputs, delayMs);

    const successCount = results.filter(r => r.success).length;
    const totalPhones = results.reduce((sum, r) => sum + r.phones.length, 0);
    const totalEmails = results.reduce((sum, r) => sum + r.emails.length, 0);

    return NextResponse.json({
      success: true,
      processed: results.length,
      successful: successCount,
      failed: results.length - successCount,
      totalPhonesFound: totalPhones,
      totalEmailsFound: totalEmails,
      results: results.map(r => ({
        leadId: r.leadId,
        success: r.success,
        phonesFound: r.phones.length,
        emailsFound: r.emails.length,
        confidence: r.confidence,
        error: r.error,
      })),
    });
  } catch (error) {
    console.error('Batch skip trace error:', error);
    return NextResponse.json(
      { error: 'Failed to batch skip trace' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get leads that need skip tracing
 *
 * Query params: county (optional), limit (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const county = searchParams.get('county') as 'Chatham' | 'Effingham' | null;
    const limit = parseInt(searchParams.get('limit') || '50');

    const leads = await getLeadsNeedingSkipTrace(county || undefined, Math.min(limit, 100));

    return NextResponse.json({
      success: true,
      count: leads.length,
      leads: leads.map(l => ({
        leadId: l.leadId,
        ownerName: l.ownerName,
        city: l.city,
        state: l.state,
      })),
    });
  } catch (error) {
    console.error('Get skip trace leads error:', error);
    return NextResponse.json(
      { error: 'Failed to get leads needing skip trace' },
      { status: 500 }
    );
  }
}
