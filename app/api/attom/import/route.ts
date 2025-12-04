import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { attomClient, AttomProperty, CHATHAM_COUNTY_ZIPS, EFFINGHAM_COUNTY_ZIPS } from '@/lib/attom';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      endpoint = 'detailowner', // detailowner, assessment, avm, saleshistory
      zipCodes = [], // Array of ZIP codes to import
      county = 'all', // chatham, effingham, or all
      propertyType = 'sfr', // sfr, apartment, condo, etc.
      pageSize = 100,
      page = 1,
    } = body;

    // Determine which ZIP codes to query
    let targetZips: string[] = zipCodes;
    if (targetZips.length === 0) {
      if (county === 'chatham') {
        targetZips = CHATHAM_COUNTY_ZIPS;
      } else if (county === 'effingham') {
        targetZips = EFFINGHAM_COUNTY_ZIPS;
      } else {
        // For 'all', we'll do one ZIP at a time to conserve API calls
        targetZips = [...CHATHAM_COUNTY_ZIPS, ...EFFINGHAM_COUNTY_ZIPS];
      }
    }

    // Create import log entry
    const { data: logEntry, error: logError } = await supabase
      .from('attom_import_logs')
      .insert({
        endpoint,
        query_params: { zipCodes: targetZips, propertyType, pageSize, page },
        status: 'pending',
        api_calls_used: 0,
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to create import log:', logError);
    }

    const logId = logEntry?.id;
    let totalFetched = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    let apiCallsUsed = 0;

    // Process each ZIP code
    for (const zipCode of targetZips) {
      try {
        let properties: AttomProperty[] = [];

        // Fetch data based on endpoint type
        switch (endpoint) {
          case 'detailowner':
            properties = await attomClient.getPropertiesWithOwner(zipCode, {
              propertyType,
              pageSize,
              page,
            });
            break;
          case 'assessment':
            properties = await attomClient.getAssessments(zipCode, { pageSize, page });
            break;
          case 'avm':
            properties = await attomClient.getAVM(zipCode, { pageSize, page });
            break;
          default:
            throw new Error(`Unknown endpoint: ${endpoint}`);
        }

        apiCallsUsed++;
        totalFetched += properties.length;

        // Generate fallback IDs for properties without attom_id
        const propertiesWithIds = properties.map((prop, index) => {
          if (prop.attom_id != null) return prop;

          // Generate a numeric ID from address hash if no attom_id
          const addressStr = `${prop.street_address}-${prop.city}-${prop.zip_code}`.toLowerCase();
          let hash = 0;
          for (let i = 0; i < addressStr.length; i++) {
            const char = addressStr.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
          }
          // Make it positive and add timestamp component for uniqueness
          const generatedId = Math.abs(hash) * 1000 + index;

          console.log(`[ATTOM] Generated fallback ID ${generatedId} for ${prop.street_address}`);
          return { ...prop, attom_id: generatedId };
        });

        // Filter out properties without any address (truly invalid)
        const validProperties = propertiesWithIds.filter(prop =>
          prop.attom_id != null && prop.street_address
        );

        if (validProperties.length === 0) {
          console.log(`[ATTOM] ZIP ${zipCode}: No valid properties with address`);
          continue;
        }

        console.log(`[ATTOM] ZIP ${zipCode}: ${validProperties.length} valid properties (${properties.length - validProperties.length} filtered out)`);

        // Prepare batch data
        const propertyDataBatch = validProperties.map(prop => ({
          attom_id: prop.attom_id,
          street_address: prop.street_address,
          city: prop.city,
          state: prop.state,
          zip_code: prop.zip_code,
          county: prop.county,
          fips_code: prop.fips_code,
          apn: prop.apn,
          property_type: prop.property_type,
          year_built: prop.year_built,
          bedrooms: prop.bedrooms,
          bathrooms_total: prop.bathrooms_total,
          living_sqft: prop.living_sqft,
          lot_sqft: prop.lot_sqft,
          stories: prop.stories,
          pool: prop.pool,
          garage_sqft: prop.garage_sqft,
          latitude: prop.latitude,
          longitude: prop.longitude,
          owner_name: prop.owner_name,
          owner_name_2: prop.owner_name_2,
          owner_mailing_address: prop.owner_mailing_address,
          owner_mailing_city: prop.owner_mailing_city,
          owner_mailing_state: prop.owner_mailing_state,
          owner_mailing_zip: prop.owner_mailing_zip,
          owner_occupied: prop.owner_occupied,
          avm_value: prop.avm_value,
          avm_high: prop.avm_high,
          avm_low: prop.avm_low,
          avm_confidence_score: prop.avm_confidence_score,
          assessed_value: prop.assessed_value,
          market_value: prop.market_value,
          tax_amount: prop.tax_amount,
          last_sale_date: prop.last_sale_date,
          last_sale_price: prop.last_sale_price,
          raw_data: prop.raw_data,
        }));

        // Batch upsert (much faster and handles conflicts)
        const { data: upsertedData, error: upsertError } = await supabase
          .from('attom_properties')
          .upsert(propertyDataBatch, {
            onConflict: 'attom_id',
            ignoreDuplicates: false
          })
          .select('id');

        if (upsertError) {
          console.error(`[ATTOM] Upsert error for ZIP ${zipCode}:`, upsertError);
          // Try inserting one by one to see which fail
          for (const propData of propertyDataBatch) {
            const { error: singleError } = await supabase
              .from('attom_properties')
              .upsert(propData, { onConflict: 'attom_id' });

            if (singleError) {
              console.error(`[ATTOM] Single insert failed for attom_id ${propData.attom_id}:`, singleError.message);
            } else {
              totalInserted++;
            }
          }
        } else {
          totalInserted += upsertedData?.length || propertyDataBatch.length;
        }

        console.log(`[ATTOM] ZIP ${zipCode}: ${properties.length} properties processed`);
      } catch (zipError) {
        console.error(`[ATTOM] Error processing ZIP ${zipCode}:`, zipError);
      }
    }

    // Update import log
    if (logId) {
      await supabase
        .from('attom_import_logs')
        .update({
          records_fetched: totalFetched,
          records_inserted: totalInserted,
          records_updated: totalUpdated,
          api_calls_used: apiCallsUsed,
          status: 'success',
          completed_at: new Date().toISOString(),
        })
        .eq('id', logId);
    }

    return NextResponse.json({
      success: true,
      message: `Import completed successfully`,
      stats: {
        zipCodesProcessed: targetZips.length,
        recordsFetched: totalFetched,
        recordsInserted: totalInserted,
        recordsUpdated: totalUpdated,
        apiCallsUsed,
      },
    });
  } catch (error) {
    console.error('[ATTOM] Import error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// GET: Retrieve import history and stats
export async function GET() {
  try {
    // Get import logs
    const { data: logs, error: logsError } = await supabase
      .from('attom_import_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20);

    if (logsError) throw logsError;

    // Get total API calls used
    const { data: callsData } = await supabase
      .from('attom_import_logs')
      .select('api_calls_used');

    const totalApiCallsUsed = callsData?.reduce((sum, row) => sum + (row.api_calls_used || 0), 0) || 0;
    const apiCallsRemaining = Math.max(0, 100 - totalApiCallsUsed);

    // Get property counts
    const { count: totalProperties } = await supabase
      .from('attom_properties')
      .select('*', { count: 'exact', head: true });

    const { count: absenteeCount } = await supabase
      .from('attom_properties')
      .select('*', { count: 'exact', head: true })
      .eq('is_absentee_owner', true);

    return NextResponse.json({
      success: true,
      logs,
      stats: {
        totalApiCallsUsed,
        apiCallsRemaining,
        trialLimit: 100,
        totalProperties: totalProperties || 0,
        absenteeOwners: absenteeCount || 0,
      },
    });
  } catch (error) {
    console.error('[ATTOM] Get stats error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
