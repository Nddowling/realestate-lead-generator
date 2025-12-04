/**
 * ARV (After Repair Value) Calculator
 *
 * Estimates the property value after repairs based on comparable sales.
 * Uses adjustments for sqft, beds, baths, condition, and location.
 */

export interface Comp {
  address: string;
  salePrice: number;
  sqft: number;
  beds: number;
  baths: number;
  condition: 'excellent' | 'good' | 'average' | 'fair' | 'poor';
  distanceFromSubject?: number; // miles
  daysOnMarket?: number;
  saleDate?: string;
}

export interface SubjectProperty {
  sqft: number;
  beds: number;
  baths: number;
  targetCondition: 'excellent' | 'good' | 'average';
  lotSize?: number;
  yearBuilt?: number;
  garage?: boolean;
  pool?: boolean;
}

export interface ARVResult {
  estimatedARV: number;
  confidence: 'low' | 'medium' | 'high';
  pricePerSqft: number;
  adjustedComps: AdjustedComp[];
  methodology: string;
  warnings: string[];
}

export interface AdjustedComp {
  address: string;
  originalPrice: number;
  adjustedPrice: number;
  adjustments: {
    sqft: number;
    beds: number;
    baths: number;
    condition: number;
    location: number;
    total: number;
  };
  pricePerSqft: number;
  weight: number;
}

// Savannah, GA market-specific adjustments (adjust based on local market)
const MARKET_ADJUSTMENTS = {
  // Price per sqft adjustment
  sqftAdjustment: 80, // $80 per sqft difference

  // Bedroom adjustment
  bedroomAdjustment: 10000, // $10k per bedroom

  // Bathroom adjustment
  bathroomAdjustment: 7500, // $7.5k per bathroom

  // Condition adjustments (from subject's target condition)
  conditionAdjustments: {
    excellent: 0,
    good: -10000,
    average: -20000,
    fair: -35000,
    poor: -50000,
  },

  // Location/distance penalty (per mile from subject)
  distancePenalty: 2000,
  maxDistanceForComp: 3, // miles

  // Age of sale penalty (per month old)
  agePenalty: 1000,
  maxAgeForComp: 6, // months
};

/**
 * Calculate ARV based on comparable sales
 */
export function calculateARV(
  subject: SubjectProperty,
  comps: Comp[]
): ARVResult {
  const warnings: string[] = [];

  if (comps.length === 0) {
    return {
      estimatedARV: 0,
      confidence: 'low',
      pricePerSqft: 0,
      adjustedComps: [],
      methodology: 'No comparable sales provided',
      warnings: ['No comps provided - cannot estimate ARV'],
    };
  }

  if (comps.length < 3) {
    warnings.push('Fewer than 3 comps - estimate may be less reliable');
  }

  // Adjust each comp
  const adjustedComps: AdjustedComp[] = comps.map(comp => {
    const adjustments = calculateAdjustments(subject, comp);

    const adjustedPrice = comp.salePrice + adjustments.total;
    const pricePerSqft = adjustedPrice / subject.sqft;

    // Calculate weight based on similarity
    const weight = calculateCompWeight(subject, comp, adjustments);

    return {
      address: comp.address,
      originalPrice: comp.salePrice,
      adjustedPrice,
      adjustments,
      pricePerSqft,
      weight,
    };
  });

  // Sort by weight (most similar first)
  adjustedComps.sort((a, b) => b.weight - a.weight);

  // Calculate weighted average ARV
  const totalWeight = adjustedComps.reduce((sum, c) => sum + c.weight, 0);
  const weightedARV = adjustedComps.reduce(
    (sum, c) => sum + c.adjustedPrice * c.weight,
    0
  ) / totalWeight;

  // Round to nearest $1,000
  const estimatedARV = Math.round(weightedARV / 1000) * 1000;

  // Calculate average price per sqft
  const avgPricePerSqft = estimatedARV / subject.sqft;

  // Determine confidence level
  const confidence = determineConfidence(adjustedComps, warnings);

  // Check for outliers
  const prices = adjustedComps.map(c => c.adjustedPrice);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev > avgPrice * 0.15) {
    warnings.push('High variance in comp prices - ARV estimate may be less accurate');
  }

  return {
    estimatedARV,
    confidence,
    pricePerSqft: Math.round(avgPricePerSqft),
    adjustedComps,
    methodology: `Weighted average of ${comps.length} adjusted comps`,
    warnings,
  };
}

/**
 * Calculate adjustments for a single comp
 */
function calculateAdjustments(
  subject: SubjectProperty,
  comp: Comp
): AdjustedComp['adjustments'] {
  // Sqft adjustment
  const sqftDiff = subject.sqft - comp.sqft;
  const sqftAdj = sqftDiff * MARKET_ADJUSTMENTS.sqftAdjustment;

  // Bedroom adjustment
  const bedDiff = subject.beds - comp.beds;
  const bedAdj = bedDiff * MARKET_ADJUSTMENTS.bedroomAdjustment;

  // Bathroom adjustment
  const bathDiff = subject.baths - comp.baths;
  const bathAdj = bathDiff * MARKET_ADJUSTMENTS.bathroomAdjustment;

  // Condition adjustment (comp condition vs subject's target)
  const targetConditionValue = MARKET_ADJUSTMENTS.conditionAdjustments[subject.targetCondition];
  const compConditionValue = MARKET_ADJUSTMENTS.conditionAdjustments[comp.condition];
  const conditionAdj = targetConditionValue - compConditionValue;

  // Location adjustment (distance penalty)
  const distance = comp.distanceFromSubject || 0;
  const locationAdj = -Math.min(distance, MARKET_ADJUSTMENTS.maxDistanceForComp) *
    MARKET_ADJUSTMENTS.distancePenalty;

  const total = sqftAdj + bedAdj + bathAdj + conditionAdj + locationAdj;

  return {
    sqft: sqftAdj,
    beds: bedAdj,
    baths: bathAdj,
    condition: conditionAdj,
    location: locationAdj,
    total,
  };
}

/**
 * Calculate weight for a comp based on similarity
 */
function calculateCompWeight(
  subject: SubjectProperty,
  comp: Comp,
  adjustments: AdjustedComp['adjustments']
): number {
  let weight = 1.0;

  // Penalize large total adjustments
  const absAdjustment = Math.abs(adjustments.total);
  if (absAdjustment > 50000) {
    weight *= 0.5;
  } else if (absAdjustment > 30000) {
    weight *= 0.7;
  } else if (absAdjustment > 15000) {
    weight *= 0.85;
  }

  // Boost for similar sqft
  const sqftDiffPct = Math.abs(subject.sqft - comp.sqft) / subject.sqft;
  if (sqftDiffPct < 0.1) {
    weight *= 1.2;
  } else if (sqftDiffPct > 0.3) {
    weight *= 0.7;
  }

  // Boost for same bed/bath count
  if (subject.beds === comp.beds) weight *= 1.1;
  if (subject.baths === comp.baths) weight *= 1.1;

  // Penalize distant comps
  if (comp.distanceFromSubject) {
    if (comp.distanceFromSubject > 2) weight *= 0.8;
    if (comp.distanceFromSubject > 3) weight *= 0.6;
  }

  // Penalize old sales
  if (comp.saleDate) {
    const monthsOld = (Date.now() - new Date(comp.saleDate).getTime()) /
      (1000 * 60 * 60 * 24 * 30);
    if (monthsOld > 3) weight *= 0.9;
    if (monthsOld > 6) weight *= 0.7;
  }

  return Math.max(0.1, weight);
}

/**
 * Determine confidence level based on comps quality
 */
function determineConfidence(
  adjustedComps: AdjustedComp[],
  warnings: string[]
): 'low' | 'medium' | 'high' {
  if (adjustedComps.length < 2 || warnings.length > 2) {
    return 'low';
  }

  if (adjustedComps.length >= 3) {
    const avgWeight = adjustedComps.reduce((s, c) => s + c.weight, 0) / adjustedComps.length;
    if (avgWeight > 0.8 && warnings.length === 0) {
      return 'high';
    }
  }

  return 'medium';
}

/**
 * Quick ARV estimate using price per sqft
 */
export function quickARVEstimate(
  sqft: number,
  pricePerSqft: number,
  condition: 'excellent' | 'good' | 'average' = 'good'
): number {
  const baseValue = sqft * pricePerSqft;

  // Adjust for condition
  const conditionMultiplier = {
    excellent: 1.05,
    good: 1.0,
    average: 0.95,
  };

  return Math.round((baseValue * conditionMultiplier[condition]) / 1000) * 1000;
}

/**
 * Get Savannah market average price per sqft by area
 */
export function getMarketPricePerSqft(area: string): number {
  // Savannah/Chatham/Effingham market averages (update regularly)
  const marketAverages: Record<string, number> = {
    'downtown_savannah': 250,
    'midtown_savannah': 200,
    'southside_savannah': 160,
    'west_savannah': 120,
    'pooler': 175,
    'rincon': 165,
    'effingham': 150,
    'default': 165,
  };

  return marketAverages[area.toLowerCase().replace(/\s+/g, '_')] || marketAverages.default;
}
