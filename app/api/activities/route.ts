/**
 * Activities API Route
 *
 * POST: Create a new activity
 * GET: Get activities (with optional lead filter)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * POST - Create new activity
 *
 * Body: {
 *   leadId: string,
 *   type: 'call' | 'sms_sent' | 'sms_received' | 'email' | 'note' | 'status_change' | 'skip_trace' | 'appointment' | 'offer_made' | 'contract_signed',
 *   content: string,
 *   metadata?: object,
 *   createdBy?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, type, content, metadata, createdBy } = body;

    if (!leadId || !type || !content) {
      return NextResponse.json(
        { success: false, error: 'leadId, type, and content are required' },
        { status: 400 }
      );
    }

    // Valid activity types
    const validTypes = [
      'call',
      'sms_sent',
      'sms_received',
      'email',
      'note',
      'status_change',
      'skip_trace',
      'appointment',
      'offer_made',
      'contract_signed',
    ];

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify lead exists
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Create activity
    const { data: activity, error: activityError } = await supabase
      .from('activities')
      .insert({
        lead_id: leadId,
        type,
        content,
        metadata: metadata || null,
        created_by: createdBy || null,
      })
      .select()
      .single();

    if (activityError) {
      console.error('Activity creation error:', activityError);
      return NextResponse.json(
        { success: false, error: 'Failed to create activity' },
        { status: 500 }
      );
    }

    // Update lead's last_contacted_at for contact activities
    const contactTypes = ['call', 'sms_sent', 'email', 'appointment'];
    if (contactTypes.includes(type)) {
      await supabase
        .from('leads')
        .update({
          last_contacted_at: new Date().toISOString(),
          contact_attempts: supabase.rpc('increment_contact_attempts', { lead_id: leadId }),
        })
        .eq('id', leadId);

      // Simple increment fallback
      const { data: currentLead } = await supabase
        .from('leads')
        .select('contact_attempts')
        .eq('id', leadId)
        .single();

      if (currentLead) {
        await supabase
          .from('leads')
          .update({
            last_contacted_at: new Date().toISOString(),
            contact_attempts: (currentLead.contact_attempts || 0) + 1,
          })
          .eq('id', leadId);
      }
    }

    return NextResponse.json({
      success: true,
      activity: {
        id: activity.id,
        type: activity.type,
        content: activity.content,
        metadata: activity.metadata,
        createdBy: activity.created_by,
        createdAt: activity.created_at,
      },
    });
  } catch (error) {
    console.error('Create activity error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create activity' },
      { status: 500 }
    );
  }
}

/**
 * GET - Fetch activities
 *
 * Query params:
 * - leadId: Filter by lead
 * - type: Filter by activity type
 * - limit: Number of results (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('activities')
      .select(`
        id,
        type,
        content,
        metadata,
        created_by,
        created_at,
        lead_id,
        leads (
          properties (
            address
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100));

    if (leadId) {
      query = query.eq('lead_id', leadId);
    }

    if (type) {
      query = query.eq('type', type);
    }

    const { data: activities, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch activities' },
        { status: 500 }
      );
    }

    const formattedActivities = (activities || []).map((a: any) => ({
      id: a.id,
      type: a.type,
      content: a.content,
      metadata: a.metadata,
      createdBy: a.created_by,
      createdAt: a.created_at,
      leadId: a.lead_id,
      leadAddress: a.leads?.properties?.address,
    }));

    return NextResponse.json({
      success: true,
      activities: formattedActivities,
    });
  } catch (error) {
    console.error('Get activities error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}
