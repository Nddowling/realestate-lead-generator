/**
 * Base Scraper Utilities
 * Common functions for all scrapers
 */

import * as cheerio from 'cheerio';
import { supabase } from '@/lib/supabase';

export interface ScraperResult {
  success: boolean;
  recordsFound: number;
  recordsImported: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errors: string[];
}

export interface PropertyData {
  address: string;
  city: string;
  state: string;
  zip?: string;
  county: 'Chatham' | 'Effingham';
  owner_name?: string;
  owner_mailing_address?: string;
  owner_mailing_city?: string;
  owner_mailing_state?: string;
  owner_mailing_zip?: string;
  assessed_value?: number;
  external_id?: string;
  source: string;
}

export interface DistressData {
  type: 'tax_delinquent' | 'pre_foreclosure' | 'foreclosure' | 'probate' | 'code_violation' | 'vacant';
  source: string;
  amount_owed?: number;
  auction_date?: string;
  filing_date?: string;
  case_number?: string;
  details?: Record<string, any>;
}

/**
 * Fetch HTML from URL with retry logic
 */
export async function fetchHtml(url: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      if (i === retries - 1) throw error;
      await delay(2000 * (i + 1)); // Exponential backoff
    }
  }
  throw new Error('Failed to fetch after retries');
}

/**
 * Parse HTML with Cheerio
 */
export function parseHtml(html: string): cheerio.CheerioAPI {
  return cheerio.load(html);
}

/**
 * Delay function for rate limiting
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Normalize address for comparison
 */
export function normalizeAddress(address: string): string {
  return address
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bAVENUE\b/g, 'AVE')
    .replace(/\bROAD\b/g, 'RD')
    .replace(/\bDRIVE\b/g, 'DR')
    .replace(/\bLANE\b/g, 'LN')
    .replace(/\bCOURT\b/g, 'CT')
    .replace(/\bCIRCLE\b/g, 'CIR')
    .replace(/\bBOULEVARD\b/g, 'BLVD')
    .replace(/\bAPARTMENT\b/g, 'APT')
    .replace(/\bSUITE\b/g, 'STE')
    .replace(/\bNORTH\b/g, 'N')
    .replace(/\bSOUTH\b/g, 'S')
    .replace(/\bEAST\b/g, 'E')
    .replace(/\bWEST\b/g, 'W')
    .trim();
}

/**
 * Parse currency string to number
 */
export function parseCurrency(value: string): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

/**
 * Parse date string to ISO format
 */
export function parseDate(value: string): string | undefined {
  if (!value) return undefined;
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return undefined;
    return date.toISOString().split('T')[0];
  } catch {
    return undefined;
  }
}

/**
 * Upsert property into database
 */
export async function upsertProperty(data: PropertyData): Promise<{ id: string; isNew: boolean }> {
  // Check if property exists
  const { data: existing } = await supabase
    .from('properties')
    .select('id')
    .eq('address', data.address)
    .eq('city', data.city)
    .eq('state', data.state)
    .single();

  if (existing) {
    // Update existing
    await supabase
      .from('properties')
      .update({
        owner_name: data.owner_name,
        owner_mailing_address: data.owner_mailing_address,
        owner_mailing_city: data.owner_mailing_city,
        owner_mailing_state: data.owner_mailing_state,
        owner_mailing_zip: data.owner_mailing_zip,
        assessed_value: data.assessed_value,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    return { id: existing.id, isNew: false };
  }

  // Insert new
  const { data: newProperty, error } = await supabase
    .from('properties')
    .insert({
      ...data,
      is_absentee: checkAbsentee(data),
    })
    .select('id')
    .single();

  if (error) throw error;
  return { id: newProperty.id, isNew: true };
}

/**
 * Add distress indicator to property
 */
export async function addDistressIndicator(propertyId: string, data: DistressData): Promise<boolean> {
  // Check if this distress indicator already exists
  const { data: existing } = await supabase
    .from('distress_indicators')
    .select('id')
    .eq('property_id', propertyId)
    .eq('type', data.type)
    .eq('source', data.source)
    .single();

  if (existing) {
    // Update existing indicator
    await supabase
      .from('distress_indicators')
      .update({
        amount_owed: data.amount_owed,
        auction_date: data.auction_date,
        filing_date: data.filing_date,
        details: data.details,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return false; // Not new
  }

  // Insert new indicator
  await supabase
    .from('distress_indicators')
    .insert({
      property_id: propertyId,
      ...data,
    });

  return true; // Is new
}

/**
 * Create or get lead for property
 */
export async function ensureLead(propertyId: string): Promise<string> {
  // Check if lead exists
  const { data: existing } = await supabase
    .from('leads')
    .select('id')
    .eq('property_id', propertyId)
    .single();

  if (existing) return existing.id;

  // Create new lead
  const { data: newLead, error } = await supabase
    .from('leads')
    .insert({
      property_id: propertyId,
      status: 'new',
      score: 0,
      temperature: 'cold',
    })
    .select('id')
    .single();

  if (error) throw error;
  return newLead.id;
}

/**
 * Check if owner is absentee (mailing address different from property)
 */
export function checkAbsentee(data: PropertyData): boolean {
  if (!data.owner_mailing_address || !data.owner_mailing_city) return false;

  const propertyAddr = normalizeAddress(data.address);
  const mailingAddr = normalizeAddress(data.owner_mailing_address);

  // If addresses are different, it's an absentee owner
  return propertyAddr !== mailingAddr;
}

/**
 * Update data source status
 */
export async function updateSourceStatus(
  sourceId: string,
  status: 'ready' | 'running' | 'error',
  recordsImported?: number,
  errorMessage?: string
): Promise<void> {
  const update: Record<string, any> = { status };

  if (status === 'running') {
    // Starting import
  } else if (status === 'error') {
    update.error_message = errorMessage;
  } else if (status === 'ready' && recordsImported !== undefined) {
    update.last_import_at = new Date().toISOString();
    update.records_imported = recordsImported;
    update.error_message = null;
  }

  await supabase
    .from('data_sources')
    .update(update)
    .eq('id', sourceId);
}

/**
 * Log import to history
 */
export async function logImport(
  sourceId: string,
  result: ScraperResult
): Promise<void> {
  await supabase
    .from('import_history')
    .insert({
      source_id: sourceId,
      records_found: result.recordsFound,
      records_imported: result.recordsImported,
      records_updated: result.recordsUpdated,
      records_skipped: result.recordsSkipped,
      status: result.success ? 'completed' : 'failed',
      error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
      completed_at: new Date().toISOString(),
    });
}
