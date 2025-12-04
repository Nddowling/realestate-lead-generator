/**
 * Run All Scrapers API
 * POST: Trigger all scrapers for a county (or all counties)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  scrapeTaxDelinquent,
  scrapeForeclosures,
  detectAbsenteeOwners,
} from '@/lib/scrapers';

type County = 'Chatham' | 'Effingham';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { county, sources } = body;

    // Determine which counties to process
    const counties: County[] = county
      ? [county]
      : ['Chatham', 'Effingham'];

    // Determine which sources to run
    const runTaxDelinquent = !sources || sources.includes('tax_delinquent');
    const runForeclosure = !sources || sources.includes('foreclosure');
    const runAbsentee = !sources || sources.includes('absentee');

    const results: Record<string, any> = {};

    for (const c of counties) {
      results[c] = {};

      if (runTaxDelinquent) {
        console.log(`Running tax delinquent scraper for ${c}...`);
        results[c].taxDelinquent = await scrapeTaxDelinquent(c);
      }

      if (runForeclosure) {
        console.log(`Running foreclosure scraper for ${c}...`);
        results[c].foreclosure = await scrapeForeclosures(c);
      }

      if (runAbsentee) {
        console.log(`Running absentee detection for ${c}...`);
        results[c].absentee = await detectAbsenteeOwners(c);
      }
    }

    // Calculate totals
    let totalImported = 0;
    let totalUpdated = 0;
    let allErrors: string[] = [];

    for (const c of counties) {
      for (const source of Object.values(results[c]) as any[]) {
        totalImported += source.recordsImported || 0;
        totalUpdated += source.recordsUpdated || 0;
        allErrors = [...allErrors, ...(source.errors || [])];
      }
    }

    return NextResponse.json({
      success: allErrors.length === 0,
      message: 'All scrapers completed',
      totals: {
        imported: totalImported,
        updated: totalUpdated,
        errors: allErrors.length,
      },
      details: results,
      errors: allErrors.length > 0 ? allErrors : undefined,
    });
  } catch (error) {
    console.error('Run all scrapers error:', error);
    return NextResponse.json(
      { error: 'Scrapers failed', details: String(error) },
      { status: 500 }
    );
  }
}

// GET: Return documentation
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/scrapers/run-all',
    method: 'POST',
    description: 'Run all scrapers for one or both counties',
    params: {
      county: 'Optional - "Chatham" or "Effingham". If omitted, runs for both.',
      sources: 'Optional - Array of sources to run: ["tax_delinquent", "foreclosure", "absentee"]. If omitted, runs all.',
    },
    examples: [
      { description: 'Run all scrapers for all counties', body: {} },
      { description: 'Run all scrapers for Chatham only', body: { county: 'Chatham' } },
      { description: 'Run only tax delinquent for both counties', body: { sources: ['tax_delinquent'] } },
    ],
  });
}
