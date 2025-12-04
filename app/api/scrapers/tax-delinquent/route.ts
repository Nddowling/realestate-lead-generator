/**
 * Tax Delinquent Scraper API
 * POST: Trigger scraper for a county
 */

import { NextRequest, NextResponse } from 'next/server';
import { scrapeTaxDelinquent, importTaxDelinquentManual } from '@/lib/scrapers';

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
      // Manual import from provided records
      result = await importTaxDelinquentManual(county, records);
    } else {
      // Automated scraping
      result = await scrapeTaxDelinquent(county);
    }

    return NextResponse.json({
      success: result.success,
      message: `Tax delinquent import for ${county} County completed`,
      stats: {
        found: result.recordsFound,
        imported: result.recordsImported,
        updated: result.recordsUpdated,
        skipped: result.recordsSkipped,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error('Tax delinquent scraper error:', error);
    return NextResponse.json(
      { error: 'Scraper failed', details: String(error) },
      { status: 500 }
    );
  }
}

// GET: Get status or sample of tax delinquent data
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const county = searchParams.get('county');

  return NextResponse.json({
    endpoint: '/api/scrapers/tax-delinquent',
    method: 'POST',
    description: 'Scrape tax delinquent properties from county records',
    params: {
      county: 'Required - "Chatham" or "Effingham"',
      manual: 'Optional - Set to true for manual import',
      records: 'Required if manual=true - Array of tax delinquent records',
    },
    example: {
      county: 'Chatham',
    },
    manualExample: {
      county: 'Chatham',
      manual: true,
      records: [
        {
          parcelId: '2-0001-01-001',
          ownerName: 'John Smith',
          propertyAddress: '123 Main St',
          city: 'Savannah',
          amountOwed: 3500,
          taxYear: '2023',
        },
      ],
    },
  });
}
