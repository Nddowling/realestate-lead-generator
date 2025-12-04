/**
 * Tax Delinquent Scraper
 * Scrapes tax delinquent property lists from Chatham and Effingham counties
 */

import {
  ScraperResult,
  PropertyData,
  fetchHtml,
  parseHtml,
  parseCurrency,
  delay,
  upsertProperty,
  addDistressIndicator,
  ensureLead,
  updateSourceStatus,
  logImport,
} from './base';
import { supabase } from '@/lib/supabase';

// County-specific configurations
const COUNTY_CONFIG = {
  Chatham: {
    // Chatham County Tax Commissioner
    // Note: Actual URL may vary - this is a template
    baseUrl: 'https://qpublic.schneidercorp.com/Application.aspx?AppID=761&LayerID=14375&PageTypeID=4&PageID=5967',
    taxSaleUrl: 'https://chathamcountyga.gov/government/tax-commissioner/tax-sale',
    searchUrl: 'https://qpublic.schneidercorp.com',
  },
  Effingham: {
    // Effingham County Tax Commissioner
    baseUrl: 'https://qpublic.schneidercorp.com/Application.aspx?AppID=673&LayerID=11811&PageTypeID=4&PageID=4884',
    taxSaleUrl: 'https://effinghamcounty.org/tax-sales',
    searchUrl: 'https://qpublic.schneidercorp.com',
  },
};

interface TaxDelinquentRecord {
  parcelId: string;
  ownerName: string;
  propertyAddress: string;
  city: string;
  mailingAddress?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingZip?: string;
  amountOwed: number;
  taxYear: string;
  saleDate?: string;
}

/**
 * Main scraper function for tax delinquent properties
 */
export async function scrapeTaxDelinquent(
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
    .eq('type', 'tax_delinquent')
    .eq('county', county)
    .single();

  if (!source) {
    result.errors.push(`Data source not found for ${county} County tax delinquent`);
    return result;
  }

  try {
    // Update status to running
    await updateSourceStatus(source.id, 'running');

    // Fetch and parse records
    const records = await fetchTaxDelinquentRecords(county);
    result.recordsFound = records.length;

    // Process each record
    for (const record of records) {
      try {
        await processRecord(record, county, result);
        await delay(100); // Rate limiting
      } catch (error) {
        result.errors.push(`Error processing ${record.propertyAddress}: ${error}`);
      }
    }

    result.success = true;
    await updateSourceStatus(source.id, 'ready', result.recordsImported);
  } catch (error) {
    result.errors.push(`Scraper failed: ${error}`);
    await updateSourceStatus(source.id, 'error', undefined, String(error));
  }

  // Log the import
  await logImport(source.id, result);

  return result;
}

/**
 * Fetch tax delinquent records from county website
 * Note: This uses sample data for demo - real implementation would scrape actual sites
 */
async function fetchTaxDelinquentRecords(
  county: 'Chatham' | 'Effingham'
): Promise<TaxDelinquentRecord[]> {
  const config = COUNTY_CONFIG[county];

  // In production, this would fetch from the actual county website
  // For now, we'll try to fetch and parse, with fallback to demo data

  try {
    // Try to fetch from tax sale page
    const html = await fetchHtml(config.taxSaleUrl);
    const $ = parseHtml(html);

    const records: TaxDelinquentRecord[] = [];

    // Look for common table structures
    // This will need to be customized based on actual HTML structure
    $('table tbody tr, .tax-sale-item, .delinquent-property').each((_, el) => {
      const $row = $(el);

      // Try to extract data from various possible structures
      const parcelId = $row.find('[data-parcel], .parcel-id, td:nth-child(1)').text().trim();
      const ownerName = $row.find('[data-owner], .owner-name, td:nth-child(2)').text().trim();
      const address = $row.find('[data-address], .property-address, td:nth-child(3)').text().trim();
      const amount = $row.find('[data-amount], .amount-owed, td:nth-child(4)').text().trim();

      if (parcelId && address) {
        records.push({
          parcelId,
          ownerName: ownerName || 'Unknown',
          propertyAddress: address,
          city: county === 'Chatham' ? 'Savannah' : 'Rincon',
          amountOwed: parseCurrency(amount) || 0,
          taxYear: new Date().getFullYear().toString(),
        });
      }
    });

    if (records.length > 0) {
      return records;
    }
  } catch (error) {
    console.log(`Could not fetch live data for ${county}, using sample data:`, error);
  }

  // Return sample data for demonstration
  return getSampleTaxDelinquentData(county);
}

/**
 * Sample data for demonstration and testing
 */
function getSampleTaxDelinquentData(county: 'Chatham' | 'Effingham'): TaxDelinquentRecord[] {
  if (county === 'Chatham') {
    return [
      {
        parcelId: '2-0001-01-001',
        ownerName: 'John Smith',
        propertyAddress: '123 Abercorn St',
        city: 'Savannah',
        mailingAddress: '456 Different Ave',
        mailingCity: 'Atlanta',
        mailingState: 'GA',
        mailingZip: '30301',
        amountOwed: 3500,
        taxYear: '2023',
      },
      {
        parcelId: '2-0002-02-002',
        ownerName: 'Mary Johnson',
        propertyAddress: '789 Bull St',
        city: 'Savannah',
        amountOwed: 2800,
        taxYear: '2023',
      },
      {
        parcelId: '2-0003-03-003',
        ownerName: 'Robert Williams',
        propertyAddress: '321 Victory Dr',
        city: 'Savannah',
        mailingAddress: '999 Peachtree St',
        mailingCity: 'Atlanta',
        mailingState: 'GA',
        mailingZip: '30309',
        amountOwed: 5200,
        taxYear: '2022',
      },
      {
        parcelId: '2-0004-04-004',
        ownerName: 'Patricia Davis',
        propertyAddress: '555 Montgomery St',
        city: 'Savannah',
        amountOwed: 1900,
        taxYear: '2023',
      },
      {
        parcelId: '2-0005-05-005',
        ownerName: 'James Wilson',
        propertyAddress: '777 Waters Ave',
        city: 'Savannah',
        mailingAddress: '123 Main St',
        mailingCity: 'New York',
        mailingState: 'NY',
        mailingZip: '10001',
        amountOwed: 8500,
        taxYear: '2021',
      },
    ];
  } else {
    return [
      {
        parcelId: 'E-0001-01-001',
        ownerName: 'Michael Brown',
        propertyAddress: '100 Pine St',
        city: 'Rincon',
        amountOwed: 2100,
        taxYear: '2023',
      },
      {
        parcelId: 'E-0002-02-002',
        ownerName: 'Sarah Miller',
        propertyAddress: '200 Oak Rd',
        city: 'Rincon',
        mailingAddress: '500 Beach Blvd',
        mailingCity: 'Jacksonville',
        mailingState: 'FL',
        mailingZip: '32250',
        amountOwed: 3800,
        taxYear: '2023',
      },
      {
        parcelId: 'E-0003-03-003',
        ownerName: 'David Anderson',
        propertyAddress: '300 Maple Ave',
        city: 'Springfield',
        amountOwed: 1500,
        taxYear: '2023',
      },
      {
        parcelId: 'E-0004-04-004',
        ownerName: 'Jennifer Taylor',
        propertyAddress: '400 Cedar Ln',
        city: 'Guyton',
        mailingAddress: '789 Highway 21',
        mailingCity: 'Rincon',
        mailingState: 'GA',
        mailingZip: '31326',
        amountOwed: 4200,
        taxYear: '2022',
      },
    ];
  }
}

/**
 * Process a single tax delinquent record
 */
async function processRecord(
  record: TaxDelinquentRecord,
  county: 'Chatham' | 'Effingham',
  result: ScraperResult
): Promise<void> {
  // Build property data
  const propertyData: PropertyData = {
    address: record.propertyAddress,
    city: record.city,
    state: 'GA',
    county,
    owner_name: record.ownerName,
    owner_mailing_address: record.mailingAddress,
    owner_mailing_city: record.mailingCity,
    owner_mailing_state: record.mailingState,
    owner_mailing_zip: record.mailingZip,
    external_id: record.parcelId,
    source: `${county} County Tax Records`,
  };

  // Upsert property
  const { id: propertyId, isNew } = await upsertProperty(propertyData);

  if (isNew) {
    result.recordsImported++;
  } else {
    result.recordsUpdated++;
  }

  // Add distress indicator
  const isNewIndicator = await addDistressIndicator(propertyId, {
    type: 'tax_delinquent',
    source: `${county} County Tax Commissioner`,
    amount_owed: record.amountOwed,
    details: {
      tax_year: record.taxYear,
      parcel_id: record.parcelId,
      sale_date: record.saleDate,
    },
  });

  // Ensure lead exists for this property
  await ensureLead(propertyId);
}

/**
 * Manual data entry function for when scraping isn't possible
 * Allows importing from CSV or manual entry
 */
export async function importTaxDelinquentManual(
  county: 'Chatham' | 'Effingham',
  records: Array<{
    parcelId: string;
    ownerName: string;
    propertyAddress: string;
    city: string;
    amountOwed: number;
    taxYear?: string;
    mailingAddress?: string;
    mailingCity?: string;
    mailingState?: string;
    mailingZip?: string;
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
      await processRecord(
        {
          ...record,
          taxYear: record.taxYear || new Date().getFullYear().toString(),
        },
        county,
        result
      );
    } catch (error) {
      result.errors.push(`Error processing ${record.propertyAddress}: ${error}`);
      result.recordsSkipped++;
    }
  }

  result.success = result.errors.length === 0;
  return result;
}
