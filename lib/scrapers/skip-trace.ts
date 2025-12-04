/**
 * Skip Trace Scraper
 *
 * Searches public people search sites for phone numbers and emails.
 * Uses TruePeopleSearch.com as primary source.
 *
 * IMPORTANT: Rate limit to 5-10 seconds between requests to avoid blocking.
 */

import * as cheerio from 'cheerio';
import { delay, parseHtml } from './base';
import { supabase } from '@/lib/supabase';

// Type for best match result
interface BestMatchResult {
  phones: PhoneResult[];
  emails: string[];
  confidence: number;
}

export interface SkipTraceInput {
  leadId: string;
  ownerName: string;
  city: string;
  state: string;
  address?: string; // Optional - helps narrow down results
}

export interface SkipTraceResult {
  success: boolean;
  leadId: string;
  phones: PhoneResult[];
  emails: string[];
  confidence: number; // 0-100
  source: string;
  error?: string;
}

export interface PhoneResult {
  number: string;
  type: 'mobile' | 'landline' | 'unknown';
  carrier?: string;
}

/**
 * Skip trace a single lead
 */
export async function skipTraceLead(input: SkipTraceInput): Promise<SkipTraceResult> {
  const result: SkipTraceResult = {
    success: false,
    leadId: input.leadId,
    phones: [],
    emails: [],
    confidence: 0,
    source: 'TruePeopleSearch',
  };

  try {
    // Parse the owner name
    const nameParts = parseOwnerName(input.ownerName);
    if (!nameParts) {
      result.error = 'Could not parse owner name';
      return result;
    }

    // Build search URL
    const searchUrl = buildSearchUrl(nameParts, input.city, input.state);

    // Fetch the search results page
    const html = await fetchWithRetry(searchUrl);
    if (!html) {
      result.error = 'Failed to fetch search results';
      return result;
    }

    // Parse the results
    const $ = parseHtml(html);

    // Look for person cards in the results
    const personCards = $('.card-summary, .card, [data-person-card]');

    if (personCards.length === 0) {
      // Try alternative selectors
      const altResults = $('[class*="result"], [class*="person"], [class*="record"]');
      if (altResults.length === 0) {
        result.error = 'No results found for this person';
        return result;
      }
    }

    // Find the best matching result
    const matches: BestMatchResult[] = [];

    personCards.each((_, card) => {
      const $card = $(card);

      // Extract name from card
      const cardName = $card.find('[class*="name"], h2, h3, .name').first().text().trim();

      // Extract location
      const cardLocation = $card.find('[class*="location"], [class*="address"], .location').text().trim();

      // Calculate match confidence
      const nameMatch = calculateNameMatch(input.ownerName, cardName);
      const locationMatch = cardLocation.toLowerCase().includes(input.city.toLowerCase()) ? 30 : 0;
      const confidence = Math.min(100, nameMatch + locationMatch);

      // Extract phone numbers
      const phones: PhoneResult[] = [];
      $card.find('[class*="phone"], a[href^="tel:"], .phone').each((_, el) => {
        const phoneText = $(el).text().trim();
        const phone = extractPhoneNumber(phoneText);
        if (phone) {
          phones.push({
            number: phone,
            type: classifyPhoneType(phoneText),
          });
        }
      });

      // Also check href attributes for tel: links
      $card.find('a[href^="tel:"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const phone = extractPhoneNumber(href.replace('tel:', ''));
        if (phone && !phones.find(p => p.number === phone)) {
          phones.push({
            number: phone,
            type: 'unknown',
          });
        }
      });

      // Extract emails
      const emails: string[] = [];
      $card.find('[class*="email"], a[href^="mailto:"], .email').each((_, el) => {
        const emailText = $(el).text().trim();
        const href = $(el).attr('href') || '';
        const email = extractEmail(emailText) || extractEmail(href.replace('mailto:', ''));
        if (email && !emails.includes(email)) {
          emails.push(email);
        }
      });

      matches.push({ phones, emails, confidence });
    });

    // Sort by confidence and get the best match
    matches.sort((a, b) => b.confidence - a.confidence);
    let bestMatch = matches.length > 0 ? matches[0] : null;

    // If we didn't find structured results, try to scrape any visible phone numbers
    if (!bestMatch || bestMatch.phones.length === 0) {
      const allPhones = extractAllPhones($);
      const allEmails = extractAllEmails($);

      if (allPhones.length > 0 || allEmails.length > 0) {
        bestMatch = {
          phones: allPhones.slice(0, 5), // Limit to 5 numbers
          emails: allEmails.slice(0, 3), // Limit to 3 emails
          confidence: 40, // Lower confidence for unstructured extraction
        };
      }
    }

    if (bestMatch && (bestMatch.phones.length > 0 || bestMatch.emails.length > 0)) {
      result.success = true;
      result.phones = bestMatch.phones;
      result.emails = bestMatch.emails;
      result.confidence = bestMatch.confidence;

      // Save to database
      await saveSkipTraceResult(input.leadId, result);
    } else {
      result.error = 'No contact information found';
    }

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error occurred';
  }

  return result;
}

/**
 * Batch skip trace multiple leads
 */
export async function skipTraceLeads(
  inputs: SkipTraceInput[],
  delayMs: number = 7000 // 7 seconds between requests
): Promise<SkipTraceResult[]> {
  const results: SkipTraceResult[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];

    // Skip trace this lead
    const result = await skipTraceLead(input);
    results.push(result);

    // Rate limit - wait between requests (except for last one)
    if (i < inputs.length - 1) {
      await delay(delayMs);
    }
  }

  return results;
}

/**
 * Parse owner name into first/last
 */
function parseOwnerName(fullName: string): { firstName: string; lastName: string } | null {
  if (!fullName) return null;

  // Clean up the name
  let cleaned = fullName
    .replace(/\s+(JR|SR|II|III|IV|V)\.?$/i, '') // Remove suffixes
    .replace(/\s+(TRUST|ESTATE|LLC|INC|CORP).*$/i, '') // Remove business indicators
    .replace(/[^a-zA-Z\s-]/g, '') // Remove special chars except hyphen
    .trim();

  // Handle "LAST, FIRST" format
  if (cleaned.includes(',')) {
    const [last, first] = cleaned.split(',').map(s => s.trim());
    if (first && last) {
      return { firstName: first.split(' ')[0], lastName: last };
    }
  }

  // Handle "FIRST LAST" format
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return {
      firstName: parts[0],
      lastName: parts[parts.length - 1],
    };
  }

  return null;
}

/**
 * Build TruePeopleSearch URL
 */
function buildSearchUrl(
  name: { firstName: string; lastName: string },
  city: string,
  state: string
): string {
  const baseUrl = 'https://www.truepeoplesearch.com/results';
  const params = new URLSearchParams({
    name: `${name.firstName} ${name.lastName}`,
    citystatezip: `${city}, ${state}`,
  });
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Fetch URL with retry and user-agent
 */
async function fetchWithRetry(url: string, retries: number = 3): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
      });

      if (response.status === 429) {
        // Rate limited - wait longer
        await delay(10000 * (i + 1));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      if (i === retries - 1) return null;
      await delay(3000 * (i + 1));
    }
  }
  return null;
}

/**
 * Calculate name match score
 */
function calculateNameMatch(searchName: string, foundName: string): number {
  if (!searchName || !foundName) return 0;

  const search = searchName.toLowerCase().replace(/[^a-z\s]/g, '');
  const found = foundName.toLowerCase().replace(/[^a-z\s]/g, '');

  // Exact match
  if (search === found) return 70;

  // Check if all search words are in found
  const searchWords = search.split(/\s+/).filter(w => w.length > 1);
  const foundWords = found.split(/\s+/).filter(w => w.length > 1);

  let matchedWords = 0;
  for (const sw of searchWords) {
    if (foundWords.some(fw => fw.includes(sw) || sw.includes(fw))) {
      matchedWords++;
    }
  }

  const matchRatio = searchWords.length > 0 ? matchedWords / searchWords.length : 0;
  return Math.round(matchRatio * 70);
}

/**
 * Extract phone number from text
 */
function extractPhoneNumber(text: string): string | null {
  if (!text) return null;

  // Remove all non-digits
  const digits = text.replace(/\D/g, '');

  // Must be 10 or 11 digits (with or without country code)
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return null;
}

/**
 * Classify phone type based on text
 */
function classifyPhoneType(text: string): 'mobile' | 'landline' | 'unknown' {
  const lower = text.toLowerCase();
  if (lower.includes('mobile') || lower.includes('cell') || lower.includes('wireless')) {
    return 'mobile';
  }
  if (lower.includes('landline') || lower.includes('home') || lower.includes('land')) {
    return 'landline';
  }
  return 'unknown';
}

/**
 * Extract email from text
 */
function extractEmail(text: string): string | null {
  if (!text) return null;

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailRegex);
  return match ? match[0].toLowerCase() : null;
}

/**
 * Extract all phone numbers from page
 */
function extractAllPhones($: ReturnType<typeof cheerio.load>): PhoneResult[] {
  const phones: PhoneResult[] = [];
  const seen = new Set<string>();

  // Look for common phone patterns in page text
  const bodyText = $('body').text();
  const phoneRegex = /(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
  const matches = bodyText.match(phoneRegex) || [];

  for (const match of matches) {
    const phone = extractPhoneNumber(match);
    if (phone && !seen.has(phone)) {
      seen.add(phone);
      phones.push({
        number: phone,
        type: 'unknown',
      });
    }
  }

  return phones;
}

/**
 * Extract all emails from page
 */
function extractAllEmails($: ReturnType<typeof cheerio.load>): string[] {
  const emails: string[] = [];
  const seen = new Set<string>();

  // Look for email patterns in page
  const bodyText = $('body').text();
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = bodyText.match(emailRegex) || [];

  for (const match of matches) {
    const email = match.toLowerCase();
    // Filter out common false positives
    if (!seen.has(email) &&
        !email.includes('example.com') &&
        !email.includes('@truepeoplesearch') &&
        !email.includes('@google') &&
        !email.includes('@facebook')) {
      seen.add(email);
      emails.push(email);
    }
  }

  return emails;
}

/**
 * Save skip trace result to database
 */
async function saveSkipTraceResult(leadId: string, result: SkipTraceResult): Promise<void> {
  // Get the primary phone (prefer mobile)
  const primaryPhone = result.phones.find(p => p.type === 'mobile') || result.phones[0];
  const primaryEmail = result.emails[0];

  // Update the lead
  await supabase
    .from('leads')
    .update({
      phone: primaryPhone?.number,
      email: primaryEmail,
      phone_confidence: result.confidence,
      skip_traced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  // Log the activity
  await supabase
    .from('activities')
    .insert({
      lead_id: leadId,
      type: 'skip_trace',
      content: `Skip traced via ${result.source}. Found ${result.phones.length} phone(s), ${result.emails.length} email(s). Confidence: ${result.confidence}%`,
      metadata: {
        phones: result.phones,
        emails: result.emails,
        confidence: result.confidence,
        source: result.source,
      },
    });
}

/**
 * Get leads that need skip tracing
 */
export async function getLeadsNeedingSkipTrace(
  county?: 'Chatham' | 'Effingham',
  limit: number = 50
): Promise<SkipTraceInput[]> {
  let query = supabase
    .from('leads')
    .select(`
      id,
      phone,
      skip_traced_at,
      properties!inner (
        owner_name,
        city,
        state,
        address,
        county
      )
    `)
    .is('phone', null) // No phone number yet
    .order('score', { ascending: false }) // Prioritize high-scoring leads
    .limit(limit);

  if (county) {
    query = query.eq('properties.county', county);
  }

  const { data: leads } = await query;

  return (leads || [])
    .filter((lead: any) => lead.properties?.owner_name)
    .map((lead: any) => ({
      leadId: lead.id,
      ownerName: lead.properties.owner_name,
      city: lead.properties.city,
      state: lead.properties.state,
      address: lead.properties.address,
    }));
}
