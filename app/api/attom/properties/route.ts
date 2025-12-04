import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const zipCode = searchParams.get('zipCode');
    const county = searchParams.get('county');
    const absenteeOnly = searchParams.get('absenteeOnly') === 'true';
    const minEquity = searchParams.get('minEquity');
    const minYearsOwned = searchParams.get('minYearsOwned');
    const propertyType = searchParams.get('propertyType');
    const sortBy = searchParams.get('sortBy') || 'estimated_equity';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const search = searchParams.get('search');

    // Build query
    let query = supabase
      .from('attom_properties')
      .select('*', { count: 'exact' });

    // Apply filters
    if (zipCode) {
      query = query.eq('zip_code', zipCode);
    }

    if (county) {
      query = query.ilike('county', `%${county}%`);
    }

    if (absenteeOnly) {
      query = query.eq('is_absentee_owner', true);
    }

    if (minEquity) {
      query = query.gte('estimated_equity', parseInt(minEquity));
    }

    if (minYearsOwned) {
      query = query.gte('years_owned', parseInt(minYearsOwned));
    }

    if (propertyType) {
      query = query.ilike('property_type', `%${propertyType}%`);
    }

    if (search) {
      query = query.or(
        `street_address.ilike.%${search}%,owner_name.ilike.%${search}%,city.ilike.%${search}%`
      );
    }

    // Apply sorting
    const validSortFields = [
      'estimated_equity',
      'avm_value',
      'years_owned',
      'last_sale_price',
      'tax_amount',
      'imported_at',
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'estimated_equity';
    query = query.order(sortField, { ascending: sortOrder === 'asc', nullsFirst: false });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: properties, count, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      properties: properties || [],
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error('[ATTOM] Properties query error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST: Convert ATTOM property to a lead
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { attomPropertyId } = body;

    if (!attomPropertyId) {
      return NextResponse.json(
        { success: false, error: 'attomPropertyId is required' },
        { status: 400 }
      );
    }

    // Get the ATTOM property
    const { data: attomProp, error: fetchError } = await supabase
      .from('attom_properties')
      .select('*')
      .eq('id', attomPropertyId)
      .single();

    if (fetchError || !attomProp) {
      return NextResponse.json(
        { success: false, error: 'Property not found' },
        { status: 404 }
      );
    }

    // Check if lead already exists for this address
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .ilike('property_address', `%${attomProp.street_address}%`)
      .single();

    if (existingLead) {
      return NextResponse.json({
        success: false,
        error: 'Lead already exists for this property',
        leadId: existingLead.id,
      });
    }

    // Calculate lead score based on ATTOM data
    let leadScore = 50; // Base score

    // Absentee owner bonus
    if (attomProp.is_absentee_owner) leadScore += 15;

    // High equity bonus
    if (attomProp.equity_percent > 50) leadScore += 15;
    else if (attomProp.equity_percent > 30) leadScore += 10;
    else if (attomProp.equity_percent > 20) leadScore += 5;

    // Long-term owner bonus (more likely to have equity/motivation)
    if (attomProp.years_owned > 10) leadScore += 10;
    else if (attomProp.years_owned > 5) leadScore += 5;

    // Determine temperature
    let temperature = 'cold';
    if (leadScore >= 80) temperature = 'hot';
    else if (leadScore >= 60) temperature = 'warm';

    // Create the lead
    const { data: newLead, error: createError } = await supabase
      .from('leads')
      .insert({
        property_address: attomProp.street_address,
        city: attomProp.city,
        state: attomProp.state,
        zip_code: attomProp.zip_code,
        county: attomProp.county,
        owner_name: attomProp.owner_name,
        mailing_address: attomProp.owner_mailing_address
          ? `${attomProp.owner_mailing_address}, ${attomProp.owner_mailing_city || ''} ${attomProp.owner_mailing_state || ''} ${attomProp.owner_mailing_zip || ''}`.trim()
          : null,
        property_type: attomProp.property_type,
        bedrooms: attomProp.bedrooms,
        bathrooms: attomProp.bathrooms_total,
        sqft: attomProp.living_sqft,
        lot_size: attomProp.lot_sqft,
        year_built: attomProp.year_built,
        estimated_value: attomProp.avm_value,
        assessed_value: attomProp.assessed_value,
        last_sale_date: attomProp.last_sale_date,
        last_sale_price: attomProp.last_sale_price,
        estimated_equity: attomProp.estimated_equity,
        lead_score: Math.min(100, leadScore),
        temperature,
        status: 'new',
        source: 'attom',
        latitude: attomProp.latitude,
        longitude: attomProp.longitude,
        notes: `Imported from ATTOM. ${attomProp.is_absentee_owner ? 'Absentee owner.' : ''} ${attomProp.years_owned ? `Owned ${attomProp.years_owned} years.` : ''}`,
      })
      .select()
      .single();

    if (createError) throw createError;

    // Add distress indicator if absentee
    if (attomProp.is_absentee_owner && newLead) {
      await supabase.from('distress_indicators').insert({
        lead_id: newLead.id,
        type: 'absentee',
        source: 'attom',
        details: {
          owner_address: attomProp.owner_mailing_address,
          owner_city: attomProp.owner_mailing_city,
          owner_state: attomProp.owner_mailing_state,
        },
      });
    }

    return NextResponse.json({
      success: true,
      lead: newLead,
      message: 'Lead created successfully from ATTOM property',
    });
  } catch (error) {
    console.error('[ATTOM] Convert to lead error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
