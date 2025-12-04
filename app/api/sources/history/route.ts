/**
 * Import History API Route
 *
 * GET: Fetch import history with optional filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('import_history')
      .select(`
        id,
        source_id,
        records_found,
        records_imported,
        records_updated,
        records_skipped,
        started_at,
        completed_at,
        status,
        error_message,
        details,
        data_sources (
          name,
          type,
          county
        )
      `)
      .order('started_at', { ascending: false })
      .limit(Math.min(limit, 100));

    if (sourceId) {
      query = query.eq('source_id', sourceId);
    }

    const { data: history, error } = await query;

    if (error) {
      console.error('Import history fetch error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch import history' },
        { status: 500 }
      );
    }

    // Format response
    const formattedHistory = (history || []).map((item: any) => ({
      id: item.id,
      sourceId: item.source_id,
      sourceName: item.data_sources?.name,
      sourceType: item.data_sources?.type,
      county: item.data_sources?.county,
      recordsFound: item.records_found,
      recordsImported: item.records_imported,
      recordsUpdated: item.records_updated,
      recordsSkipped: item.records_skipped,
      startedAt: item.started_at,
      completedAt: item.completed_at,
      status: item.status,
      errorMessage: item.error_message,
      duration: item.completed_at && item.started_at
        ? Math.round((new Date(item.completed_at).getTime() - new Date(item.started_at).getTime()) / 1000)
        : null,
    }));

    return NextResponse.json({
      success: true,
      history: formattedHistory,
    });
  } catch (error) {
    console.error('Get import history error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch import history' },
      { status: 500 }
    );
  }
}
