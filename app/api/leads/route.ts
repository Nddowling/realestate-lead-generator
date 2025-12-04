/**
 * Leads API
 * GET: List leads with filtering
 * POST: Create a new lead
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { recalculateLeadScore, getScoreDistribution } from '@/lib/lead-scoring';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const temperature = searchParams.get('temperature');
  const status = searchParams.get('status');
  const county = searchParams.get('county');
  const search = searchParams.get('search');
  const sortBy = searchParams.get('sortBy') || 'score';
  const sortOrder = searchParams.get('sortOrder') || 'desc';
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    // Build query
    let query = supabase
      .from('leads')
      .select(`
        *,
        properties (
          id,
          address,
          city,
          state,
          zip,
          county,
          owner_name,
          is_absentee,
          owner_mailing_state,
          assessed_value,
          estimated_value,
          equity_percentage,
          bedrooms,
          bathrooms,
          sqft
        ),
        distress_indicators:properties(
          distress_indicators (
            id,
            type,
            amount_owed,
            auction_date,
            filing_date,
            source
          )
        )
      `, { count: 'exact' });

    // Apply filters
    if (temperature) {
      query = query.eq('temperature', temperature);
    }

    if (status) {
      query = query.eq('status', status);
    }

    // Sort
    const ascending = sortOrder === 'asc';
    query = query.order(sortBy, { ascending });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: leads, count, error } = await query;

    if (error) throw error;

    // Filter by county (needs post-processing due to nested join)
    let filteredLeads = leads || [];
    if (county) {
      filteredLeads = filteredLeads.filter(
        (lead: any) => lead.properties?.county === county
      );
    }

    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      filteredLeads = filteredLeads.filter((lead: any) => {
        const address = lead.properties?.address?.toLowerCase() || '';
        const owner = lead.properties?.owner_name?.toLowerCase() || '';
        const city = lead.properties?.city?.toLowerCase() || '';
        return address.includes(searchLower) ||
               owner.includes(searchLower) ||
               city.includes(searchLower);
      });
    }

    // Get score distribution for summary
    const distribution = await getScoreDistribution(county as any);

    return NextResponse.json({
      success: true,
      leads: filteredLeads,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (offset + limit) < (count || 0),
      },
      summary: distribution,
    });
  } catch (error) {
    console.error('Leads API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leads', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { property_id, status = 'new', notes } = body;

    if (!property_id) {
      return NextResponse.json(
        { error: 'property_id is required' },
        { status: 400 }
      );
    }

    // Check if lead already exists
    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .eq('property_id', property_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Lead already exists for this property', leadId: existing.id },
        { status: 409 }
      );
    }

    // Create lead
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        property_id,
        status,
        notes,
        score: 0,
        temperature: 'cold',
      })
      .select()
      .single();

    if (error) throw error;

    // Calculate initial score
    const scoreBreakdown = await recalculateLeadScore(lead.id);

    return NextResponse.json({
      success: true,
      lead: {
        ...lead,
        score: scoreBreakdown?.total || 0,
        temperature: scoreBreakdown?.temperature || 'cold',
      },
      scoreBreakdown,
    });
  } catch (error) {
    console.error('Create lead error:', error);
    return NextResponse.json(
      { error: 'Failed to create lead', details: String(error) },
      { status: 500 }
    );
  }
}
