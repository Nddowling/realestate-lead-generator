/**
 * Run Data Source API
 * POST: Trigger a specific data source import
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  scrapeTaxDelinquent,
  scrapeForeclosures,
  detectAbsenteeOwners,
} from '@/lib/scrapers';

type County = 'Chatham' | 'Effingham';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sourceId = params.id;

  try {
    // Fetch the source
    const { data: source, error: sourceError } = await supabase
      .from('data_sources')
      .select('*')
      .eq('id', sourceId)
      .single();

    if (sourceError || !source) {
      return NextResponse.json(
        { success: false, error: 'Data source not found' },
        { status: 404 }
      );
    }

    // Check if source is already running
    if (source.status === 'running') {
      return NextResponse.json(
        { success: false, error: 'Import already in progress' },
        { status: 409 }
      );
    }

    // Check if this is a coming soon source
    if (source.config?.comingSoon) {
      return NextResponse.json(
        { success: false, error: 'This data source is not yet available' },
        { status: 400 }
      );
    }

    // Update source status to running
    await supabase
      .from('data_sources')
      .update({ status: 'running', error_message: null })
      .eq('id', sourceId);

    // Create import history record
    const { data: importRecord, error: importError } = await supabase
      .from('import_history')
      .insert({
        source_id: sourceId,
        status: 'running',
      })
      .select()
      .single();

    if (importError) {
      console.error('Failed to create import record:', importError);
    }

    // Run the appropriate scraper
    let result: any;
    const county = source.county as County;

    try {
      switch (source.type) {
        case 'tax_delinquent':
          result = await scrapeTaxDelinquent(county);
          break;
        case 'foreclosure':
          result = await scrapeForeclosures(county);
          break;
        case 'absentee':
          result = await detectAbsenteeOwners(county);
          break;
        default:
          throw new Error(`Unknown source type: ${source.type}`);
      }

      // Update source with results
      await supabase
        .from('data_sources')
        .update({
          status: 'ready',
          last_import_at: new Date().toISOString(),
          records_imported: (source.records_imported || 0) + (result.recordsImported || 0),
          error_message: null,
        })
        .eq('id', sourceId);

      // Update import history
      if (importRecord) {
        await supabase
          .from('import_history')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            records_found: result.recordsFound || 0,
            records_imported: result.recordsImported || 0,
            records_updated: result.recordsUpdated || 0,
            records_skipped: result.recordsSkipped || 0,
            details: result,
          })
          .eq('id', importRecord.id);
      }

      return NextResponse.json({
        success: true,
        message: `Import completed for ${source.name}`,
        result: {
          recordsFound: result.recordsFound || 0,
          recordsImported: result.recordsImported || 0,
          recordsUpdated: result.recordsUpdated || 0,
          recordsSkipped: result.recordsSkipped || 0,
          errors: result.errors || [],
        },
      });
    } catch (scraperError) {
      const errorMessage = scraperError instanceof Error ? scraperError.message : 'Unknown error';

      // Update source with error
      await supabase
        .from('data_sources')
        .update({
          status: 'error',
          error_message: errorMessage,
        })
        .eq('id', sourceId);

      // Update import history with failure
      if (importRecord) {
        await supabase
          .from('import_history')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: errorMessage,
          })
          .eq('id', importRecord.id);
      }

      return NextResponse.json({
        success: false,
        error: `Import failed: ${errorMessage}`,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Run source error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run import' },
      { status: 500 }
    );
  }
}
