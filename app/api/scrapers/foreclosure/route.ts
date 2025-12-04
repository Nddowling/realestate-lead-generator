/**
 * Foreclosure Scraper API
 * POST: Trigger scraper for a county
 */

import { NextRequest, NextResponse } from 'next/server';
import { scrapeForeclosures, importForeclosureManual, getUpcomingAuctions } from '@/lib/scrapers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { county, manual, records } = body;

    // Validate county
    if (!county || !['Chatham', 'Effingham'].includes(county)) {
      return NextResponse.json(
        { error: 'Invalid county. Must be "Chatham" or "Effingham"' },
        { status: 400 }
      );
    }

    let result;

    if (manual && records) {
      // Manual import
      result = await importForeclosureManual(county, records);
    } else {
      // Automated scraping
      result = await scrapeForeclosures(county);
    }

    return NextResponse.json({
      success: result.success,
      message: `Foreclosure import for ${county} County completed`,
      stats: {
        found: result.recordsFound,
        imported: result.recordsImported,
        updated: result.recordsUpdated,
        skipped: result.recordsSkipped,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error('Foreclosure scraper error:', error);
    return NextResponse.json(
      { error: 'Scraper failed', details: String(error) },
      { status: 500 }
    );
  }
}

// GET: Get upcoming auctions
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const county = searchParams.get('county') as 'Chatham' | 'Effingham' | null;
  const days = parseInt(searchParams.get('days') || '30');

  try {
    const auctions = await getUpcomingAuctions(county || undefined, days);

    return NextResponse.json({
      success: true,
      count: auctions.length,
      auctions,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch auctions', details: String(error) },
      { status: 500 }
    );
  }
}
