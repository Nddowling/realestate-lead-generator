/**
 * Foreclosure / Pre-Foreclosure Scraper
 * Scrapes lis pendens and foreclosure filings from Georgia Superior Court Clerks
 */

import {
  ScraperResult,
  PropertyData,
  fetchHtml,
  parseHtml,
  parseCurrency,
  parseDate,
  delay,
  upsertProperty,
  addDistressIndicator,
  ensureLead,
  updateSourceStatus,
  logImport,
} from './base';
import { supabase } from '@/lib/supabase';

// GSCCCA (Georgia Superior Court Clerks' Cooperative Authority)
// Main source for foreclosure filings in Georgia
const GSCCCA_CONFIG = {
  baseUrl: 'https://www.gsccca.org/search',
  searchUrl: 'https://www.gsccca.org/search/RealEstate',
};

// County-specific configurations
const COUNTY_CONFIG = {
  Chatham: {
    clerkUrl: 'https://www.chathamcountyga.gov/government/county-clerk-of-court',
    ficoCode: '025', // FIPS code
  },
  Effingham: {
    clerkUrl: 'https://effinghamcounty.org/clerk-of-courts',
    ficoCode: '103',
  },
};

interface ForeclosureRecord {
  caseNumber: string;
  filingDate: string;
  filingType: 'lis_pendens' | 'foreclosure_notice' | 'deed_under_power';
  propertyAddress: string;
  city: string;
  ownerName: string;
  lenderName?: string;
  loanAmount?: number;
  auctionDate?: string;
  details?: Record<string, any>;
}

/**
 * Main scraper function for foreclosure/pre-foreclosure records
 */
export async function scrapeForeclosures(
  county: 'Chatham' | 'Effingham'
): Promise<ScraperResult> {
  const result: ScraperResult = {
    success: false,
    recordsFound: 0,
    recordsImported: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    errors: [],
  };

  // Get source ID from database
  const { data: source } = await supabase
    .from('data_sources')
    .select('id')
    .eq('type', 'foreclosure')
    .eq('county', county)
    .single();

  if (!source) {
    result.errors.push(`Data source not found for ${county} County foreclosure`);
    return result;
  }

  try {
    await updateSourceStatus(source.id, 'running');

    // Fetch and parse records
    const records = await fetchForeclosureRecords(county);
    result.recordsFound = records.length;

    // Process each record
    for (const record of records) {
      try {
        await processForeclosureRecord(record, county, result);
        await delay(100);
      } catch (error) {
        result.errors.push(`Error processing ${record.caseNumber}: ${error}`);
      }
    }

    result.success = true;
    await updateSourceStatus(source.id, 'ready', result.recordsImported);
  } catch (error) {
    result.errors.push(`Scraper failed: ${error}`);
    await updateSourceStatus(source.id, 'error', undefined, String(error));
  }

  await logImport(source.id, result);
  return result;
}

/**
 * Fetch foreclosure records
 * Note: GSCCCA requires a paid subscription for full access
 * This provides sample data for demo purposes
 */
async function fetchForeclosureRecords(
  county: 'Chatham' | 'Effingham'
): Promise<ForeclosureRecord[]> {
  // In production, this would:
  // 1. Login to GSCCCA or county clerk website
  // 2. Search for lis pendens filings in the past 30-90 days
  // 3. Parse the results

  // For now, return sample data
  return getSampleForeclosureData(county);
}

/**
 * Sample foreclosure data for demonstration
 */
function getSampleForeclosureData(county: 'Chatham' | 'Effingham'): ForeclosureRecord[] {
  const today = new Date();
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysFromNow = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);

  if (county === 'Chatham') {
    return [
      {
        caseNumber: 'LP-2024-001234',
        filingDate: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        filingType: 'lis_pendens',
        propertyAddress: '456 Drayton St',
        city: 'Savannah',
        ownerName: 'Thomas Anderson',
        lenderName: 'Wells Fargo Bank',
        loanAmount: 185000,
        auctionDate: thirtyDaysFromNow.toISOString().split('T')[0],
      },
      {
        caseNumber: 'LP-2024-001189',
        filingDate: new Date(today.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        filingType: 'foreclosure_notice',
        propertyAddress: '789 Habersham St',
        city: 'Savannah',
        ownerName: 'Linda Martinez',
        lenderName: 'Bank of America',
        loanAmount: 225000,
        auctionDate: sixtyDaysFromNow.toISOString().split('T')[0],
      },
      {
        caseNumber: 'LP-2024-001056',
        filingDate: new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        filingType: 'lis_pendens',
        propertyAddress: '321 E Liberty St',
        city: 'Savannah',
        ownerName: 'William Jackson',
        lenderName: 'Chase Bank',
        loanAmount: 142000,
      },
      {
        caseNumber: 'LP-2024-000998',
        filingDate: new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        filingType: 'foreclosure_notice',
        propertyAddress: '555 E 40th St',
        city: 'Savannah',
        ownerName: 'Karen White',
        lenderName: 'Truist Bank',
        loanAmount: 198000,
        auctionDate: thirtyDaysFromNow.toISOString().split('T')[0],
      },
    ];
  } else {
    return [
      {
        caseNumber: 'EF-LP-2024-00234',
        filingDate: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        filingType: 'lis_pendens',
        propertyAddress: '150 Columbia Ave',
        city: 'Rincon',
        ownerName: 'Christopher Lee',
        lenderName: 'Quicken Loans',
        loanAmount: 165000,
        auctionDate: sixtyDaysFromNow.toISOString().split('T')[0],
      },
      {
        caseNumber: 'EF-LP-2024-00198',
        filingDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        filingType: 'foreclosure_notice',
        propertyAddress: '275 Fort Howard Rd',
        city: 'Rincon',
        ownerName: 'Michelle Thompson',
        lenderName: 'Navy Federal',
        loanAmount: 210000,
        auctionDate: thirtyDaysFromNow.toISOString().split('T')[0],
      },
      {
        caseNumber: 'EF-LP-2024-00156',
        filingDate: new Date(today.getTime() - 50 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        filingType: 'lis_pendens',
        propertyAddress: '88 Plantation Dr',
        city: 'Guyton',
        ownerName: 'Robert Garcia',
        lenderName: 'Rocket Mortgage',
        loanAmount: 135000,
      },
    ];
  }
}

/**
 * Process a single foreclosure record
 */
async function processForeclosureRecord(
  record: ForeclosureRecord,
  county: 'Chatham' | 'Effingham',
  result: ScraperResult
): Promise<void> {
  // Determine distress type
  let distressType: 'pre_foreclosure' | 'foreclosure' = 'pre_foreclosure';
  if (record.filingType === 'deed_under_power' || record.filingType === 'foreclosure_notice') {
    distressType = 'foreclosure';
  }

  // Build property data
  const propertyData: PropertyData = {
    address: record.propertyAddress,
    city: record.city,
    state: 'GA',
    county,
    owner_name: record.ownerName,
    source: `GSCCCA - ${county} County`,
  };

  // Upsert property
  const { id: propertyId, isNew } = await upsertProperty(propertyData);

  if (isNew) {
    result.recordsImported++;
  } else {
    result.recordsUpdated++;
  }

  // Add distress indicator
  await addDistressIndicator(propertyId, {
    type: distressType,
    source: `GSCCCA - ${county} County Clerk`,
    amount_owed: record.loanAmount,
    auction_date: record.auctionDate,
    filing_date: record.filingDate,
    case_number: record.caseNumber,
    details: {
      filing_type: record.filingType,
      lender: record.lenderName,
      loan_amount: record.loanAmount,
    },
  });

  // Ensure lead exists
  await ensureLead(propertyId);
}

/**
 * Get upcoming foreclosure auctions
 */
export async function getUpcomingAuctions(
  county?: 'Chatham' | 'Effingham',
  daysAhead = 30
): Promise<any[]> {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  let query = supabase
    .from('distress_indicators')
    .select(`
      *,
      properties (*)
    `)
    .in('type', ['foreclosure', 'pre_foreclosure'])
    .not('auction_date', 'is', null)
    .gte('auction_date', new Date().toISOString().split('T')[0])
    .lte('auction_date', futureDate.toISOString().split('T')[0])
    .order('auction_date', { ascending: true });

  if (county) {
    // Filter by county through the join
    const { data } = await query;
    return (data || []).filter(d => d.properties?.county === county);
  }

  const { data } = await query;
  return data || [];
}

/**
 * Manual import for foreclosure data
 */
export async function importForeclosureManual(
  county: 'Chatham' | 'Effingham',
  records: Array<{
    caseNumber: string;
    filingDate: string;
    propertyAddress: string;
    city: string;
    ownerName: string;
    lenderName?: string;
    loanAmount?: number;
    auctionDate?: string;
    isForeclosure?: boolean; // true = foreclosure, false = pre-foreclosure/lis pendens
  }>
): Promise<ScraperResult> {
  const result: ScraperResult = {
    success: false,
    recordsFound: records.length,
    recordsImported: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    errors: [],
  };

  for (const record of records) {
    try {
      await processForeclosureRecord(
        {
          caseNumber: record.caseNumber,
          filingDate: record.filingDate,
          filingType: record.isForeclosure ? 'foreclosure_notice' : 'lis_pendens',
          propertyAddress: record.propertyAddress,
          city: record.city,
          ownerName: record.ownerName,
          lenderName: record.lenderName,
          loanAmount: record.loanAmount,
          auctionDate: record.auctionDate,
        },
        county,
        result
      );
    } catch (error) {
      result.errors.push(`Error processing ${record.caseNumber}: ${error}`);
      result.recordsSkipped++;
    }
  }

  result.success = result.errors.length === 0;
  return result;
}
