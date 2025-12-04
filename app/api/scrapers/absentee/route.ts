/**
 * Absentee Owner Detector API
 * POST: Run detection for a county
 */

import { NextRequest, NextResponse } from 'next/server';
import { detectAbsenteeOwners, getAbsenteeStats, findHighValueAbsentee } from '@/lib/scrapers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { county } = body;

    // Validate county
    if (!county || !['Chatham', 'Effingham'].includes(county)) {
      return NextResponse.json(
        { error: 'Invalid county. Must be "Chatham" or "Effingham"' },
        { status: 400 }
      );
    }

    const result = await detectAbsenteeOwners(county);

    return NextResponse.json({
      success: result.success,
      message: `Absentee owner detection for ${county} County completed`,
      stats: {
        found: result.recordsFound,
        updated: result.recordsUpdated,
        skipped: result.recordsSkipped,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error('Absentee detector error:', error);
    return NextResponse.json(
      { error: 'Detection failed', details: String(error) },
      { status: 500 }
    );
  }
}

// GET: Get absentee stats or high-value absentee properties
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const county = searchParams.get('county') as 'Chatham' | 'Effingham' | null;
  const highValue = searchParams.get('highValue') === 'true';
  const minEquity = parseInt(searchParams.get('minEquity') || '30');

  if (!county || !['Chatham', 'Effingham'].includes(county)) {
    return NextResponse.json(
      { error: 'Invalid county. Must be "Chatham" or "Effingham"' },
      { status: 400 }
    );
  }

  try {
    if (highValue) {
      const properties = await findHighValueAbsentee(county, minEquity);
      return NextResponse.json({
        success: true,
        count: properties.length,
        properties,
      });
    } else {
      const stats = await getAbsenteeStats(county);
      return NextResponse.json({
        success: true,
        stats,
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get stats', details: String(error) },
      { status: 500 }
    );
  }
}
