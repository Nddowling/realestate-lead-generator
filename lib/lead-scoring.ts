/**
 * Lead Scoring System
 *
 * Calculates a score from 0-100 based on multiple factors:
 * - Equity percentage (higher = more motivated seller, easier to make deals)
 * - Distress indicators (more = hotter lead)
 * - Type of distress (foreclosure > tax delinquent > absentee)
 * - Time factors (how long in distress, urgency)
 * - Property characteristics
 */

import { supabase } from '@/lib/supabase';

// Scoring weights - adjust these to tune the algorithm
const SCORING_CONFIG = {
  // Distress type weights (max 40 points from distress)
  distressWeights: {
    foreclosure: 35,        // Imminent sale = very motivated
    pre_foreclosure: 30,    // Filing made, but time to act
    tax_delinquent: 25,     // Owes money, may need to sell
    probate: 25,            // Estate sale, often motivated
    bankruptcy: 20,         // Financial distress
    divorce: 20,            // Life change, often quick sale
    code_violation: 15,     // May want to offload problem
    vacant: 15,             // Not using it, carrying costs
  },

  // Stacking bonus - multiple distress indicators
  stackingBonus: {
    2: 10,  // 2 indicators = +10
    3: 20,  // 3 indicators = +20
    4: 30,  // 4+ indicators = +30
  },

  // Equity scoring (max 25 points)
  equityThresholds: [
    { min: 70, points: 25 },  // 70%+ equity = full points
    { min: 50, points: 20 },  // 50-69% equity
    { min: 30, points: 15 },  // 30-49% equity
    { min: 10, points: 10 },  // 10-29% equity
    { min: 0, points: 5 },    // Under 10% equity (still some value)
  ],

  // Absentee owner bonus (max 10 points)
  absenteeBonus: {
    inState: 5,      // Owner in Georgia but different address
    outOfState: 10,  // Owner out of state = more motivated
  },

  // Time-based urgency (max 15 points)
  urgencyBonus: {
    auctionWithin7Days: 15,
    auctionWithin14Days: 12,
    auctionWithin30Days: 10,
    auctionWithin60Days: 5,
    recentFiling: 5,  // Filed within 30 days
  },

  // Response bonus (max 10 points)
  responseBonus: {
    respondedToSMS: 10,
    answeredCall: 8,
    returnedCall: 5,
  },

  // Temperature thresholds
  temperatureThresholds: {
    hot: 80,   // 80+ = HOT (pursue immediately)
    warm: 50,  // 50-79 = WARM (follow up regularly)
    cold: 0,   // Below 50 = COLD (nurture)
  },
};

export interface ScoringFactors {
  equityPercentage?: number;
  distressIndicators: Array<{
    type: string;
    amount_owed?: number;
    auction_date?: string;
    filing_date?: string;
  }>;
  isAbsentee: boolean;
  ownerState?: string;
  hasResponded?: boolean;
  responseType?: 'sms' | 'call_answered' | 'call_returned';
  daysInPipeline?: number;
}

export interface ScoreBreakdown {
  total: number;
  temperature: 'hot' | 'warm' | 'cold';
  components: {
    distress: number;
    stacking: number;
    equity: number;
    absentee: number;
    urgency: number;
    response: number;
  };
  reasons: string[];
  warnings: string[];
}

/**
 * Calculate lead score based on all factors
 */
export function calculateLeadScore(factors: ScoringFactors): ScoreBreakdown {
  const components = {
    distress: 0,
    stacking: 0,
    equity: 0,
    absentee: 0,
    urgency: 0,
    response: 0,
  };
  const reasons: string[] = [];
  const warnings: string[] = [];

  // 1. Score distress indicators
  const distressTypes = new Set<string>();
  let highestDistressScore = 0;

  for (const indicator of factors.distressIndicators) {
    const weight = SCORING_CONFIG.distressWeights[indicator.type as keyof typeof SCORING_CONFIG.distressWeights] || 10;
    if (weight > highestDistressScore) {
      highestDistressScore = weight;
    }
    distressTypes.add(indicator.type);

    // Check for auction urgency
    if (indicator.auction_date) {
      const auctionDate = new Date(indicator.auction_date);
      const daysUntilAuction = Math.ceil((auctionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      if (daysUntilAuction <= 7) {
        components.urgency = Math.max(components.urgency, SCORING_CONFIG.urgencyBonus.auctionWithin7Days);
        reasons.push(`Auction in ${daysUntilAuction} days!`);
      } else if (daysUntilAuction <= 14) {
        components.urgency = Math.max(components.urgency, SCORING_CONFIG.urgencyBonus.auctionWithin14Days);
        reasons.push(`Auction in ${daysUntilAuction} days`);
      } else if (daysUntilAuction <= 30) {
        components.urgency = Math.max(components.urgency, SCORING_CONFIG.urgencyBonus.auctionWithin30Days);
        reasons.push(`Auction in ${daysUntilAuction} days`);
      } else if (daysUntilAuction <= 60) {
        components.urgency = Math.max(components.urgency, SCORING_CONFIG.urgencyBonus.auctionWithin60Days);
      }
    }

    // Check for recent filing
    if (indicator.filing_date) {
      const filingDate = new Date(indicator.filing_date);
      const daysSinceFiling = Math.ceil((Date.now() - filingDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceFiling <= 30) {
        components.urgency = Math.max(components.urgency, SCORING_CONFIG.urgencyBonus.recentFiling);
        reasons.push('Recent filing (within 30 days)');
      }
    }
  }

  components.distress = highestDistressScore;

  // Add reasons for distress types
  if (distressTypes.has('foreclosure')) reasons.push('Active foreclosure');
  if (distressTypes.has('pre_foreclosure')) reasons.push('Pre-foreclosure filing');
  if (distressTypes.has('tax_delinquent')) reasons.push('Tax delinquent');
  if (distressTypes.has('probate')) reasons.push('Probate property');

  // 2. Stacking bonus
  const indicatorCount = distressTypes.size;
  if (indicatorCount >= 4) {
    components.stacking = SCORING_CONFIG.stackingBonus[4];
    reasons.push(`${indicatorCount} distress indicators (stacked)`);
  } else if (indicatorCount >= 3) {
    components.stacking = SCORING_CONFIG.stackingBonus[3];
    reasons.push('3 distress indicators');
  } else if (indicatorCount >= 2) {
    components.stacking = SCORING_CONFIG.stackingBonus[2];
    reasons.push('Multiple distress indicators');
  }

  // 3. Equity scoring
  if (factors.equityPercentage !== undefined) {
    for (const threshold of SCORING_CONFIG.equityThresholds) {
      if (factors.equityPercentage >= threshold.min) {
        components.equity = threshold.points;
        if (factors.equityPercentage >= 50) {
          reasons.push(`High equity (${factors.equityPercentage}%)`);
        }
        break;
      }
    }
  } else {
    // No equity data - add warning
    warnings.push('Equity unknown - needs property valuation');
  }

  // 4. Absentee owner bonus
  if (factors.isAbsentee) {
    if (factors.ownerState && factors.ownerState.toUpperCase() !== 'GA') {
      components.absentee = SCORING_CONFIG.absenteeBonus.outOfState;
      reasons.push(`Out-of-state owner (${factors.ownerState})`);
    } else {
      components.absentee = SCORING_CONFIG.absenteeBonus.inState;
      reasons.push('Absentee owner');
    }
  }

  // 5. Response bonus
  if (factors.hasResponded) {
    if (factors.responseType === 'sms') {
      components.response = SCORING_CONFIG.responseBonus.respondedToSMS;
      reasons.push('Responded to SMS');
    } else if (factors.responseType === 'call_answered') {
      components.response = SCORING_CONFIG.responseBonus.answeredCall;
      reasons.push('Answered phone call');
    } else if (factors.responseType === 'call_returned') {
      components.response = SCORING_CONFIG.responseBonus.returnedCall;
      reasons.push('Returned call');
    }
  }

  // Calculate total (cap at 100)
  const total = Math.min(100,
    components.distress +
    components.stacking +
    components.equity +
    components.absentee +
    components.urgency +
    components.response
  );

  // Determine temperature
  let temperature: 'hot' | 'warm' | 'cold';
  if (total >= SCORING_CONFIG.temperatureThresholds.hot) {
    temperature = 'hot';
  } else if (total >= SCORING_CONFIG.temperatureThresholds.warm) {
    temperature = 'warm';
  } else {
    temperature = 'cold';
  }

  return {
    total,
    temperature,
    components,
    reasons,
    warnings,
  };
}

/**
 * Get scoring factors for a lead from the database
 */
export async function getLeadScoringFactors(leadId: string): Promise<ScoringFactors | null> {
  // Get lead with property and distress indicators
  const { data: lead, error } = await supabase
    .from('leads')
    .select(`
      *,
      properties (
        id,
        equity_percentage,
        is_absentee,
        owner_mailing_state
      )
    `)
    .eq('id', leadId)
    .single();

  if (error || !lead) return null;

  // Get distress indicators
  const { data: indicators } = await supabase
    .from('distress_indicators')
    .select('type, amount_owed, auction_date, filing_date')
    .eq('property_id', lead.property_id)
    .eq('is_resolved', false);

  // Check for SMS responses
  const { data: responses } = await supabase
    .from('sms_messages')
    .select('direction')
    .eq('lead_id', leadId)
    .eq('direction', 'inbound')
    .limit(1);

  const hasResponded = (responses?.length || 0) > 0;

  return {
    equityPercentage: lead.properties?.equity_percentage,
    distressIndicators: indicators || [],
    isAbsentee: lead.properties?.is_absentee || false,
    ownerState: lead.properties?.owner_mailing_state,
    hasResponded,
    responseType: hasResponded ? 'sms' : undefined,
  };
}

/**
 * Recalculate and update score for a specific lead
 */
export async function recalculateLeadScore(leadId: string): Promise<ScoreBreakdown | null> {
  const factors = await getLeadScoringFactors(leadId);
  if (!factors) return null;

  const scoreBreakdown = calculateLeadScore(factors);

  // Update the lead in the database
  await supabase
    .from('leads')
    .update({
      score: scoreBreakdown.total,
      temperature: scoreBreakdown.temperature,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  return scoreBreakdown;
}

/**
 * Recalculate scores for all leads in a county
 */
export async function recalculateAllScores(county?: 'Chatham' | 'Effingham'): Promise<{
  processed: number;
  updated: number;
  errors: string[];
}> {
  const result = { processed: 0, updated: 0, errors: [] as string[] };

  // Get all leads
  let query = supabase
    .from('leads')
    .select('id, property_id, properties!inner(county)')
    .not('property_id', 'is', null);

  if (county) {
    query = query.eq('properties.county', county);
  }

  const { data: leads, error } = await query;

  if (error) {
    result.errors.push(`Failed to fetch leads: ${error.message}`);
    return result;
  }

  for (const lead of leads || []) {
    result.processed++;
    try {
      const scoreBreakdown = await recalculateLeadScore(lead.id);
      if (scoreBreakdown) {
        result.updated++;
      }
    } catch (err) {
      result.errors.push(`Failed to score lead ${lead.id}: ${err}`);
    }
  }

  return result;
}

/**
 * Get leads by temperature
 */
export async function getLeadsByTemperature(
  temperature: 'hot' | 'warm' | 'cold',
  county?: 'Chatham' | 'Effingham',
  limit = 50
): Promise<any[]> {
  let query = supabase
    .from('leads')
    .select(`
      *,
      properties (*),
      distress_indicators:properties(distress_indicators(*))
    `)
    .eq('temperature', temperature)
    .order('score', { ascending: false })
    .limit(limit);

  // Note: County filter would need a join or different query structure
  const { data } = await query;

  if (county && data) {
    return data.filter((lead: any) => lead.properties?.county === county);
  }

  return data || [];
}

/**
 * Get score distribution for analytics
 */
export async function getScoreDistribution(county?: 'Chatham' | 'Effingham'): Promise<{
  hot: number;
  warm: number;
  cold: number;
  avgScore: number;
  total: number;
}> {
  const { data: leads } = await supabase
    .from('leads')
    .select('score, temperature, properties!inner(county)');

  let filtered = leads || [];
  if (county) {
    filtered = filtered.filter((l: any) => l.properties?.county === county);
  }

  const hot = filtered.filter((l: any) => l.temperature === 'hot').length;
  const warm = filtered.filter((l: any) => l.temperature === 'warm').length;
  const cold = filtered.filter((l: any) => l.temperature === 'cold').length;
  const total = filtered.length;
  const avgScore = total > 0
    ? Math.round(filtered.reduce((sum: number, l: any) => sum + (l.score || 0), 0) / total)
    : 0;

  return { hot, warm, cold, avgScore, total };
}
