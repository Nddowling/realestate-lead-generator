/**
 * Single Lead API Route
 *
 * GET: Fetch a single lead with all details
 * PATCH: Update lead fields
 * DELETE: Delete a lead
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface RouteParams {
  params: { id: string };
}

/**
 * GET - Fetch single lead with full details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Fetch lead with property and distress indicators
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select(`
        id,
        score,
        temperature,
        status,
        phone,
        phone_alt,
        email,
        phone_confidence,
        skip_traced_at,
        last_contacted_at,
        next_follow_up,
        contact_attempts,
        asking_price,
        offer_amount,
        contract_price,
        notes,
        tags,
        assigned_to,
        created_at,
        properties (
          id,
          address,
          city,
          state,
          zip,
          county,
          owner_name,
          owner_mailing_address,
          owner_mailing_city,
          owner_mailing_state,
          owner_mailing_zip,
          is_absentee,
          bedrooms,
          bathrooms,
          sqft,
          year_built,
          assessed_value,
          estimated_value,
          equity_percentage
        )
      `)
      .eq('id', id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Fetch distress indicators
    const { data: distressIndicators } = await supabase
      .from('distress_indicators')
      .select('id, type, source, amount_owed, auction_date, filing_date')
      .eq('property_id', (lead.properties as any).id)
      .eq('is_resolved', false);

    // Fetch activities
    const { data: activities } = await supabase
      .from('activities')
      .select('id, type, content, metadata, created_by, created_at')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
      .limit(50);

    // Format response
    const property = lead.properties as any;
    const formattedLead = {
      id: lead.id,
      score: lead.score,
      temperature: lead.temperature,
      status: lead.status,
      phone: lead.phone,
      phoneAlt: lead.phone_alt,
      email: lead.email,
      phoneConfidence: lead.phone_confidence,
      skipTracedAt: lead.skip_traced_at,
      lastContactedAt: lead.last_contacted_at,
      nextFollowUp: lead.next_follow_up,
      contactAttempts: lead.contact_attempts,
      askingPrice: lead.asking_price,
      offerAmount: lead.offer_amount,
      contractPrice: lead.contract_price,
      notes: lead.notes,
      tags: lead.tags,
      assignedTo: lead.assigned_to,
      createdAt: lead.created_at,
      property: {
        id: property.id,
        address: property.address,
        city: property.city,
        state: property.state,
        zip: property.zip,
        county: property.county,
        ownerName: property.owner_name,
        ownerMailingAddress: property.owner_mailing_address
          ? `${property.owner_mailing_address}, ${property.owner_mailing_city}, ${property.owner_mailing_state} ${property.owner_mailing_zip}`
          : null,
        isAbsentee: property.is_absentee,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        sqft: property.sqft,
        yearBuilt: property.year_built,
        assessedValue: property.assessed_value,
        estimatedValue: property.estimated_value,
        equityPercentage: property.equity_percentage,
      },
      distressIndicators: (distressIndicators || []).map((d: any) => ({
        id: d.id,
        type: d.type,
        amountOwed: d.amount_owed,
        auctionDate: d.auction_date,
        filingDate: d.filing_date,
        source: d.source,
      })),
    };

    const formattedActivities = (activities || []).map((a: any) => ({
      id: a.id,
      type: a.type,
      content: a.content,
      metadata: a.metadata,
      createdBy: a.created_by,
      createdAt: a.created_at,
    }));

    return NextResponse.json({
      success: true,
      lead: formattedLead,
      activities: formattedActivities,
    });
  } catch (error) {
    console.error('Get lead error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch lead' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update lead fields
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const body = await request.json();

    // Map camelCase to snake_case for database
    const updates: Record<string, any> = {};

    if (body.status !== undefined) updates.status = body.status;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.phoneAlt !== undefined) updates.phone_alt = body.phoneAlt;
    if (body.email !== undefined) updates.email = body.email;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.nextFollowUp !== undefined) updates.next_follow_up = body.nextFollowUp;
    if (body.lastContactedAt !== undefined) updates.last_contacted_at = body.lastContactedAt;
    if (body.contactAttempts !== undefined) updates.contact_attempts = body.contactAttempts;
    if (body.askingPrice !== undefined) updates.asking_price = body.askingPrice;
    if (body.offerAmount !== undefined) updates.offer_amount = body.offerAmount;
    if (body.contractPrice !== undefined) updates.contract_price = body.contractPrice;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.assignedTo !== undefined) updates.assigned_to = body.assignedTo;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Get old status for activity logging
    const { data: oldLead } = await supabase
      .from('leads')
      .select('status')
      .eq('id', id)
      .single();

    // Update lead
    const { error: updateError } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: 'Failed to update lead' },
        { status: 500 }
      );
    }

    // Log status change as activity
    if (body.status && oldLead && body.status !== oldLead.status) {
      await supabase.from('activities').insert({
        lead_id: id,
        type: 'status_change',
        content: `Status changed from "${oldLead.status}" to "${body.status}"`,
        metadata: { oldStatus: oldLead.status, newStatus: body.status },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update lead error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update lead' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a lead
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete lead' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete lead error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete lead' },
      { status: 500 }
    );
  }
}
