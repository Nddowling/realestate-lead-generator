/**
 * Absentee Owner Detector
 * Identifies properties where owner's mailing address differs from property address
 * These are often landlords or inherited properties - motivated sellers
 */

import {
  ScraperResult,
  normalizeAddress,
  updateSourceStatus,
  logImport,
} from './base';
import { supabase } from '@/lib/supabase';

/**
 * Scan existing properties and flag absentee owners
 * This runs on properties already in the database
 */
export async function detectAbsenteeOwners(
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
    .eq('type', 'absentee')
    .eq('county', county)
    .single();

  // If no absentee source exists, create one
  let sourceId = source?.id;
  if (!sourceId) {
    const { data: newSource } = await supabase
      .from('data_sources')
      .insert({
        name: `${county} County Absentee Owners`,
        type: 'absentee',
        county,
      })
      .select('id')
      .single();
    sourceId = newSource?.id;
  }

  if (!sourceId) {
    result.errors.push('Could not create data source');
    return result;
  }

  try {
    await updateSourceStatus(sourceId, 'running');

    // Get all properties in this county that have mailing address info
    const { data: properties, error } = await supabase
      .from('properties')
      .select('*')
      .eq('county', county)
      .not('owner_mailing_address', 'is', null);

    if (error) throw error;

    result.recordsFound = properties?.length || 0;

    for (const property of properties || []) {
      try {
        const isAbsentee = checkIfAbsentee(property);

        // Update the property's absentee status
        if (property.is_absentee !== isAbsentee) {
          await supabase
            .from('properties')
            .update({ is_absentee: isAbsentee })
            .eq('id', property.id);

          result.recordsUpdated++;

          // If newly identified as absentee, ensure lead exists
          if (isAbsentee) {
            await ensureLeadWithAbsenteeFlag(property.id);
          }
        } else {
          result.recordsSkipped++;
        }
      } catch (error) {
        result.errors.push(`Error processing property ${property.id}: ${error}`);
      }
    }

    result.recordsImported = result.recordsUpdated;
    result.success = true;
    await updateSourceStatus(sourceId, 'ready', result.recordsUpdated);
  } catch (error) {
    result.errors.push(`Detection failed: ${error}`);
    await updateSourceStatus(sourceId, 'error', undefined, String(error));
  }

  await logImport(sourceId, result);
  return result;
}

/**
 * Check if a property is absentee-owned
 */
function checkIfAbsentee(property: {
  address: string;
  city: string;
  state: string;
  owner_mailing_address?: string;
  owner_mailing_city?: string;
  owner_mailing_state?: string;
}): boolean {
  if (!property.owner_mailing_address) return false;

  // Normalize addresses for comparison
  const propertyAddr = normalizeAddress(property.address);
  const mailingAddr = normalizeAddress(property.owner_mailing_address);

  // Check if addresses are different
  if (propertyAddr !== mailingAddr) {
    return true;
  }

  // Check if cities are different
  if (property.owner_mailing_city) {
    const propertyCity = property.city.toUpperCase().trim();
    const mailingCity = property.owner_mailing_city.toUpperCase().trim();
    if (propertyCity !== mailingCity) {
      return true;
    }
  }

  // Check if states are different
  if (property.owner_mailing_state) {
    const propertyState = property.state.toUpperCase().trim();
    const mailingState = property.owner_mailing_state.toUpperCase().trim();
    if (propertyState !== mailingState) {
      return true;
    }
  }

  return false;
}

/**
 * Ensure lead exists and has absentee flag
 */
async function ensureLeadWithAbsenteeFlag(propertyId: string): Promise<void> {
  // Check if lead exists
  const { data: existing } = await supabase
    .from('leads')
    .select('id')
    .eq('property_id', propertyId)
    .single();

  if (!existing) {
    // Create new lead
    await supabase
      .from('leads')
      .insert({
        property_id: propertyId,
        status: 'new',
        score: 10, // Base score for absentee
        temperature: 'cold',
        tags: ['absentee'],
      });
  } else {
    // Update existing lead tags
    const { data: lead } = await supabase
      .from('leads')
      .select('tags')
      .eq('id', existing.id)
      .single();

    const currentTags = lead?.tags || [];
    if (!currentTags.includes('absentee')) {
      await supabase
        .from('leads')
        .update({ tags: [...currentTags, 'absentee'] })
        .eq('id', existing.id);
    }
  }
}

/**
 * Get absentee owner statistics for a county
 */
export async function getAbsenteeStats(county: 'Chatham' | 'Effingham'): Promise<{
  totalProperties: number;
  absenteeOwners: number;
  outOfState: number;
  percentage: number;
}> {
  const { data: properties } = await supabase
    .from('properties')
    .select('id, is_absentee, owner_mailing_state, state')
    .eq('county', county);

  const total = properties?.length || 0;
  const absentee = properties?.filter(p => p.is_absentee).length || 0;
  const outOfState = properties?.filter(p =>
    p.owner_mailing_state &&
    p.owner_mailing_state.toUpperCase() !== 'GA'
  ).length || 0;

  return {
    totalProperties: total,
    absenteeOwners: absentee,
    outOfState,
    percentage: total > 0 ? Math.round((absentee / total) * 100) : 0,
  };
}

/**
 * Find high-value absentee properties
 * These are often the best wholesale targets
 */
export async function findHighValueAbsentee(
  county: 'Chatham' | 'Effingham',
  minEquityPercent = 30
): Promise<any[]> {
  const { data: properties } = await supabase
    .from('properties')
    .select(`
      *,
      leads (id, score, temperature, status),
      distress_indicators (type, amount_owed)
    `)
    .eq('county', county)
    .eq('is_absentee', true)
    .gte('equity_percentage', minEquityPercent)
    .order('equity_percentage', { ascending: false })
    .limit(50);

  return properties || [];
}
