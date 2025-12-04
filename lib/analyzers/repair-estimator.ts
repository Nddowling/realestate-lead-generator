/**
 * Repair Cost Estimator
 *
 * Estimates rehab costs based on property size and condition level.
 * Uses Savannah, GA market rates (adjust for your market).
 */

export type ConditionLevel = 'turnkey' | 'cosmetic' | 'moderate' | 'heavy' | 'gut';

export interface RepairEstimate {
  totalCost: number;
  costPerSqft: number;
  condition: ConditionLevel;
  breakdown: RepairCategory[];
  contingency: number;
  timeline: string;
  warnings: string[];
}

export interface RepairCategory {
  category: string;
  description: string;
  cost: number;
  included: boolean;
}

export interface RepairInput {
  sqft: number;
  condition: ConditionLevel;
  beds?: number;
  baths?: number;
  hasBasement?: boolean;
  hasPool?: boolean;
  roofAge?: number; // years
  hvacAge?: number; // years
  yearBuilt?: number;
  customItems?: CustomRepairItem[];
}

export interface CustomRepairItem {
  name: string;
  cost: number;
}

// Savannah, GA market repair costs per sqft by condition
const COST_PER_SQFT: Record<ConditionLevel, number> = {
  turnkey: 5,      // Minor touch-ups only
  cosmetic: 20,    // Paint, flooring, fixtures
  moderate: 40,    // Kitchen/bath updates, some systems
  heavy: 65,       // Major renovations, most systems
  gut: 100,        // Complete renovation
};

// Individual repair category costs
const REPAIR_CATEGORIES = {
  // Exterior
  roof: {
    name: 'Roof Replacement',
    costPerSqft: 5,
    minCost: 8000,
    maxCost: 25000,
    conditions: ['moderate', 'heavy', 'gut'],
  },
  siding: {
    name: 'Siding/Exterior',
    costPerSqft: 4,
    minCost: 5000,
    maxCost: 20000,
    conditions: ['heavy', 'gut'],
  },
  windows: {
    name: 'Windows',
    perUnit: 400,
    conditions: ['moderate', 'heavy', 'gut'],
  },

  // Interior
  paint: {
    name: 'Interior Paint',
    costPerSqft: 2,
    minCost: 2000,
    conditions: ['cosmetic', 'moderate', 'heavy', 'gut'],
  },
  flooring: {
    name: 'Flooring',
    costPerSqft: 5,
    minCost: 3000,
    conditions: ['cosmetic', 'moderate', 'heavy', 'gut'],
  },
  drywall: {
    name: 'Drywall Repair',
    costPerSqft: 3,
    minCost: 1000,
    conditions: ['moderate', 'heavy', 'gut'],
  },

  // Kitchen
  kitchenCosmetic: {
    name: 'Kitchen (Cosmetic)',
    flatCost: 5000,
    conditions: ['cosmetic'],
  },
  kitchenModerate: {
    name: 'Kitchen (Update)',
    flatCost: 15000,
    conditions: ['moderate'],
  },
  kitchenFull: {
    name: 'Kitchen (Full Remodel)',
    flatCost: 30000,
    conditions: ['heavy', 'gut'],
  },

  // Bathrooms
  bathCosmetic: {
    name: 'Bathroom (Cosmetic)',
    flatCost: 2000,
    conditions: ['cosmetic'],
  },
  bathModerate: {
    name: 'Bathroom (Update)',
    flatCost: 6000,
    conditions: ['moderate'],
  },
  bathFull: {
    name: 'Bathroom (Full Remodel)',
    flatCost: 12000,
    conditions: ['heavy', 'gut'],
  },

  // Systems
  hvac: {
    name: 'HVAC System',
    flatCost: 8000,
    conditions: ['heavy', 'gut'],
  },
  electrical: {
    name: 'Electrical Update',
    costPerSqft: 4,
    minCost: 5000,
    conditions: ['heavy', 'gut'],
  },
  plumbing: {
    name: 'Plumbing',
    costPerSqft: 5,
    minCost: 5000,
    conditions: ['heavy', 'gut'],
  },
  waterHeater: {
    name: 'Water Heater',
    flatCost: 1500,
    conditions: ['moderate', 'heavy', 'gut'],
  },

  // Foundation/Structure
  foundation: {
    name: 'Foundation Repair',
    flatCost: 10000,
    conditions: ['gut'],
  },
  structural: {
    name: 'Structural Repairs',
    flatCost: 15000,
    conditions: ['gut'],
  },

  // Misc
  permits: {
    name: 'Permits & Fees',
    percentOfTotal: 0.03,
    minCost: 500,
    conditions: ['moderate', 'heavy', 'gut'],
  },
  cleanup: {
    name: 'Debris Removal/Cleanup',
    flatCost: 2000,
    conditions: ['heavy', 'gut'],
  },
  landscaping: {
    name: 'Basic Landscaping',
    flatCost: 2500,
    conditions: ['cosmetic', 'moderate', 'heavy', 'gut'],
  },
};

// Condition descriptions
export const CONDITION_DESCRIPTIONS: Record<ConditionLevel, string> = {
  turnkey: 'Move-in ready. Minor touch-ups, cleaning, maybe paint.',
  cosmetic: 'Needs paint, flooring, fixtures. Kitchen/baths functional but dated.',
  moderate: 'Kitchen/bath updates needed. Some systems may need work. Cosmetic throughout.',
  heavy: 'Major renovation. New kitchen, baths, most systems. Possible layout changes.',
  gut: 'Complete renovation. Down to studs. New everything including structure.',
};

// Estimated timelines
const TIMELINES: Record<ConditionLevel, string> = {
  turnkey: '1-2 weeks',
  cosmetic: '2-4 weeks',
  moderate: '4-8 weeks',
  heavy: '8-16 weeks',
  gut: '16-24 weeks',
};

/**
 * Estimate repair costs based on condition
 */
export function estimateRepairs(input: RepairInput): RepairEstimate {
  const { sqft, condition, beds = 3, baths = 2 } = input;
  const warnings: string[] = [];
  const breakdown: RepairCategory[] = [];

  // Calculate base cost per sqft
  let baseCostPerSqft = COST_PER_SQFT[condition];

  // Adjust for property age
  if (input.yearBuilt) {
    const age = new Date().getFullYear() - input.yearBuilt;
    if (age > 50) {
      baseCostPerSqft *= 1.15;
      warnings.push('Property over 50 years old - expect higher costs');
    } else if (age > 30) {
      baseCostPerSqft *= 1.05;
    }
  }

  // Build breakdown by category
  let subtotal = 0;

  // Add categories based on condition
  for (const [key, category] of Object.entries(REPAIR_CATEGORIES)) {
    if (!('conditions' in category)) continue;
    if (!category.conditions.includes(condition)) continue;

    let cost = 0;
    let included = true;

    if ('costPerSqft' in category) {
      cost = Math.max(
        category.costPerSqft * sqft,
        category.minCost || 0
      );
      if ('maxCost' in category && category.maxCost) {
        cost = Math.min(cost, category.maxCost);
      }
    } else if ('flatCost' in category) {
      cost = category.flatCost;
      // Multiply bathroom costs by bath count
      if (key.startsWith('bath')) {
        cost *= baths;
      }
    } else if ('perUnit' in category) {
      // Estimate window count based on sqft
      const windowCount = Math.ceil(sqft / 150);
      cost = category.perUnit * windowCount;
    } else if ('percentOfTotal' in category) {
      // Will calculate after subtotal
      included = false;
    }

    if (included && cost > 0) {
      subtotal += cost;
      breakdown.push({
        category: category.name,
        description: getRepairDescription(key, condition),
        cost: Math.round(cost),
        included: true,
      });
    }
  }

  // Add permits (percentage of subtotal)
  if (['moderate', 'heavy', 'gut'].includes(condition)) {
    const permitCost = Math.max(subtotal * 0.03, 500);
    subtotal += permitCost;
    breakdown.push({
      category: 'Permits & Fees',
      description: 'Building permits and inspection fees',
      cost: Math.round(permitCost),
      included: true,
    });
  }

  // Add custom items
  if (input.customItems) {
    for (const item of input.customItems) {
      subtotal += item.cost;
      breakdown.push({
        category: item.name,
        description: 'Custom item',
        cost: item.cost,
        included: true,
      });
    }
  }

  // Check for specific issues
  if (input.roofAge && input.roofAge > 20) {
    const roofInBreakdown = breakdown.find(b => b.category === 'Roof Replacement');
    if (!roofInBreakdown) {
      const roofCost = Math.min(Math.max(sqft * 5, 8000), 25000);
      subtotal += roofCost;
      breakdown.push({
        category: 'Roof Replacement',
        description: `Roof is ${input.roofAge} years old`,
        cost: Math.round(roofCost),
        included: true,
      });
      warnings.push(`Roof is ${input.roofAge} years old - replacement likely needed`);
    }
  }

  if (input.hvacAge && input.hvacAge > 15) {
    const hvacInBreakdown = breakdown.find(b => b.category === 'HVAC System');
    if (!hvacInBreakdown) {
      subtotal += 8000;
      breakdown.push({
        category: 'HVAC System',
        description: `HVAC is ${input.hvacAge} years old`,
        cost: 8000,
        included: true,
      });
      warnings.push(`HVAC is ${input.hvacAge} years old - replacement may be needed`);
    }
  }

  // Add contingency (10% for most, 15% for heavy/gut)
  const contingencyRate = ['heavy', 'gut'].includes(condition) ? 0.15 : 0.10;
  const contingency = Math.round(subtotal * contingencyRate);

  // Total cost
  const totalCost = Math.round((subtotal + contingency) / 100) * 100;
  const costPerSqft = Math.round(totalCost / sqft);

  // Add pool warning
  if (input.hasPool) {
    warnings.push('Property has pool - budget additional $5-15k for pool repairs');
  }

  // Sort breakdown by cost (highest first)
  breakdown.sort((a, b) => b.cost - a.cost);

  return {
    totalCost,
    costPerSqft,
    condition,
    breakdown,
    contingency,
    timeline: TIMELINES[condition],
    warnings,
  };
}

/**
 * Get description for a repair category
 */
function getRepairDescription(key: string, condition: ConditionLevel): string {
  const descriptions: Record<string, string> = {
    roof: 'Full roof replacement with new shingles',
    siding: 'Repair or replace exterior siding',
    windows: 'Replace windows throughout',
    paint: 'Interior paint - walls and trim',
    flooring: 'New flooring throughout (LVP/carpet combo)',
    drywall: 'Drywall repair and patching',
    kitchenCosmetic: 'Paint cabinets, new hardware, minor updates',
    kitchenModerate: 'Reface cabinets, new counters, appliances',
    kitchenFull: 'New cabinets, counters, appliances, layout',
    bathCosmetic: 'New fixtures, paint, minor updates',
    bathModerate: 'New vanity, toilet, tub surround',
    bathFull: 'Complete gut and remodel',
    hvac: 'New HVAC system with ductwork',
    electrical: 'Panel upgrade and rewiring',
    plumbing: 'Replace supply and drain lines',
    waterHeater: 'New water heater',
    foundation: 'Foundation crack repair and leveling',
    structural: 'Structural repairs and reinforcement',
    cleanup: 'Debris removal and final cleaning',
    landscaping: 'Basic cleanup and curb appeal',
  };

  return descriptions[key] || 'Repair as needed';
}

/**
 * Quick repair estimate using simple sqft calculation
 */
export function quickRepairEstimate(
  sqft: number,
  condition: ConditionLevel
): number {
  const basePerSqft = COST_PER_SQFT[condition];
  const estimate = sqft * basePerSqft;

  // Add 10% contingency
  return Math.round(estimate * 1.1 / 100) * 100;
}

/**
 * Get repair cost range for a condition
 */
export function getRepairRange(
  sqft: number,
  condition: ConditionLevel
): { low: number; mid: number; high: number } {
  const midPerSqft = COST_PER_SQFT[condition];

  return {
    low: Math.round((sqft * midPerSqft * 0.8) / 1000) * 1000,
    mid: Math.round((sqft * midPerSqft) / 1000) * 1000,
    high: Math.round((sqft * midPerSqft * 1.3) / 1000) * 1000,
  };
}
