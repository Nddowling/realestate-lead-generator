/**
 * MAO (Maximum Allowable Offer) Calculator
 *
 * Calculates the maximum price you can pay for a property
 * while maintaining desired profit margins.
 *
 * Standard Formula: MAO = (ARV × Discount%) - Repairs - Wholesale Fee
 */

export interface MAOInput {
  arv: number;                    // After Repair Value
  repairCost: number;             // Estimated repair costs
  wholesaleFee?: number;          // Your assignment fee (default $10k)
  closingCosts?: number;          // Buyer closing costs percentage
  holdingCosts?: number;          // Monthly holding costs
  holdingMonths?: number;         // Estimated flip timeline
  sellingCosts?: number;          // Selling costs percentage
}

export interface MAOResult {
  conservative: MAOScenario;      // 65% rule
  moderate: MAOScenario;          // 70% rule
  aggressive: MAOScenario;        // 75% rule
  breakeven: number;              // Price where profit = $0
  spreadsheet: ProfitBreakdown;   // Detailed P&L for moderate
  recommendation: string;
}

export interface MAOScenario {
  arvPercentage: number;
  maxOffer: number;
  potentialProfit: number;
  profitMargin: number;           // As percentage
  cashOnCash: number;             // ROI percentage
}

export interface ProfitBreakdown {
  arv: number;
  purchasePrice: number;
  repairs: number;
  closingCostsBuy: number;
  closingCostsSell: number;
  holdingCosts: number;
  wholesaleFee: number;
  totalInvestment: number;
  netProfit: number;
  profitMargin: number;
  roi: number;
}

// Default values for Savannah, GA market
const DEFAULTS = {
  wholesaleFee: 10000,
  closingCostsBuyPct: 0.02,       // 2% buyer closing costs
  closingCostsSellPct: 0.08,      // 8% selling costs (6% agent + 2% closing)
  monthlyHoldingPct: 0.01,        // 1% of purchase per month
  holdingMonths: 4,               // Average flip timeline
};

/**
 * Calculate MAO for all scenarios
 */
export function calculateMAO(input: MAOInput): MAOResult {
  const {
    arv,
    repairCost,
    wholesaleFee = DEFAULTS.wholesaleFee,
    holdingMonths = DEFAULTS.holdingMonths,
  } = input;

  // Calculate scenarios
  const conservative = calculateScenario(input, 0.65, 'conservative');
  const moderate = calculateScenario(input, 0.70, 'moderate');
  const aggressive = calculateScenario(input, 0.75, 'aggressive');

  // Calculate breakeven price
  const breakeven = calculateBreakeven(input);

  // Generate detailed spreadsheet for moderate scenario
  const spreadsheet = generateSpreadsheet(input, moderate.maxOffer);

  // Generate recommendation
  const recommendation = generateRecommendation(
    arv,
    repairCost,
    moderate.maxOffer,
    moderate.potentialProfit
  );

  return {
    conservative,
    moderate,
    aggressive,
    breakeven,
    spreadsheet,
    recommendation,
  };
}

/**
 * Calculate a single MAO scenario
 */
function calculateScenario(
  input: MAOInput,
  arvPercentage: number,
  _type: string
): MAOScenario {
  const {
    arv,
    repairCost,
    wholesaleFee = DEFAULTS.wholesaleFee,
    holdingMonths = DEFAULTS.holdingMonths,
  } = input;

  // Basic MAO formula
  const maxOffer = Math.round((arv * arvPercentage) - repairCost - wholesaleFee);

  // Calculate full profit at this offer price
  const closingCostsBuy = maxOffer * DEFAULTS.closingCostsBuyPct;
  const closingCostsSell = arv * DEFAULTS.closingCostsSellPct;
  const holdingCosts = maxOffer * DEFAULTS.monthlyHoldingPct * holdingMonths;

  const totalCosts = maxOffer + repairCost + closingCostsBuy +
    closingCostsSell + holdingCosts + wholesaleFee;

  const potentialProfit = Math.round(arv - totalCosts);
  const profitMargin = Math.round((potentialProfit / arv) * 100);

  // Cash on cash return (profit / cash invested)
  const cashInvested = maxOffer + repairCost + closingCostsBuy + holdingCosts;
  const cashOnCash = Math.round((potentialProfit / cashInvested) * 100);

  return {
    arvPercentage: arvPercentage * 100,
    maxOffer: Math.max(0, maxOffer),
    potentialProfit,
    profitMargin,
    cashOnCash,
  };
}

/**
 * Calculate breakeven purchase price
 */
function calculateBreakeven(input: MAOInput): number {
  const {
    arv,
    repairCost,
    wholesaleFee = DEFAULTS.wholesaleFee,
    holdingMonths = DEFAULTS.holdingMonths,
  } = input;

  // Solve for purchase price where profit = 0
  // ARV - Purchase - Repairs - ClosingBuy - ClosingSell - Holding - Fee = 0
  // ARV - P - Repairs - (P * 0.02) - (ARV * 0.08) - (P * 0.01 * months) - Fee = 0
  // ARV - Repairs - (ARV * 0.08) - Fee = P + (P * 0.02) + (P * 0.01 * months)
  // ARV - Repairs - (ARV * 0.08) - Fee = P * (1 + 0.02 + 0.01 * months)

  const closingCostsSell = arv * DEFAULTS.closingCostsSellPct;
  const leftSide = arv - repairCost - closingCostsSell - wholesaleFee;
  const purchaseMultiplier = 1 + DEFAULTS.closingCostsBuyPct +
    (DEFAULTS.monthlyHoldingPct * holdingMonths);

  return Math.round(leftSide / purchaseMultiplier);
}

/**
 * Generate detailed profit spreadsheet
 */
function generateSpreadsheet(
  input: MAOInput,
  purchasePrice: number
): ProfitBreakdown {
  const {
    arv,
    repairCost,
    wholesaleFee = DEFAULTS.wholesaleFee,
    holdingMonths = DEFAULTS.holdingMonths,
  } = input;

  const closingCostsBuy = Math.round(purchasePrice * DEFAULTS.closingCostsBuyPct);
  const closingCostsSell = Math.round(arv * DEFAULTS.closingCostsSellPct);
  const holdingCosts = Math.round(
    purchasePrice * DEFAULTS.monthlyHoldingPct * holdingMonths
  );

  const totalInvestment = purchasePrice + repairCost + closingCostsBuy +
    closingCostsSell + holdingCosts + wholesaleFee;

  const netProfit = arv - totalInvestment;
  const profitMargin = Math.round((netProfit / arv) * 100);
  const cashInvested = purchasePrice + repairCost + closingCostsBuy + holdingCosts;
  const roi = Math.round((netProfit / cashInvested) * 100);

  return {
    arv,
    purchasePrice,
    repairs: repairCost,
    closingCostsBuy,
    closingCostsSell,
    holdingCosts,
    wholesaleFee,
    totalInvestment,
    netProfit,
    profitMargin,
    roi,
  };
}

/**
 * Generate recommendation based on numbers
 */
function generateRecommendation(
  arv: number,
  repairCost: number,
  mao: number,
  profit: number
): string {
  // Check if deal makes sense
  if (mao <= 0) {
    return 'This deal does not work at any price. Repairs exceed potential profit margin.';
  }

  const repairToArvRatio = repairCost / arv;
  const profitToArvRatio = profit / arv;

  if (repairToArvRatio > 0.5) {
    return 'Caution: Repair costs are over 50% of ARV. Heavy rehab deals are risky.';
  }

  if (profitToArvRatio < 0.1) {
    return 'Thin margin. Consider negotiating harder or passing on this deal.';
  }

  if (profitToArvRatio >= 0.2) {
    return 'Strong deal with healthy profit margin. Worth pursuing aggressively.';
  }

  if (profitToArvRatio >= 0.15) {
    return 'Good deal with solid margins. Standard flip opportunity.';
  }

  return 'Acceptable deal if comps and repair estimates are accurate.';
}

/**
 * Quick MAO using 70% rule
 */
export function quickMAO(
  arv: number,
  repairCost: number,
  wholesaleFee: number = 10000
): number {
  return Math.round((arv * 0.70) - repairCost - wholesaleFee);
}

/**
 * Calculate wholesale assignment fee based on deal size
 */
export function calculateWholesaleFee(arv: number, mao: number): {
  minimum: number;
  suggested: number;
  aggressive: number;
} {
  // Standard wholesale fees
  const baseMin = 5000;
  const baseSuggested = 10000;
  const baseAggressive = 15000;

  // Scale up for larger deals
  const dealSize = arv;

  if (dealSize > 400000) {
    return {
      minimum: 10000,
      suggested: 20000,
      aggressive: 30000,
    };
  }

  if (dealSize > 250000) {
    return {
      minimum: 7500,
      suggested: 15000,
      aggressive: 22500,
    };
  }

  return {
    minimum: baseMin,
    suggested: baseSuggested,
    aggressive: baseAggressive,
  };
}

/**
 * Analyze if deal works for different buyer types
 */
export function analyzeForBuyerTypes(
  arv: number,
  purchasePrice: number,
  repairCost: number
): {
  flipper: { works: boolean; reason: string };
  brrrrInvestor: { works: boolean; reason: string };
  turnkeyBuyer: { works: boolean; reason: string };
} {
  const totalCost = purchasePrice + repairCost;
  const equity = arv - totalCost;
  const equityPct = (equity / arv) * 100;

  // Flipper needs 20%+ margin
  const flipperWorks = equityPct >= 20;

  // BRRRR needs 75%+ LTV to refi out all capital
  const ltv = (totalCost / arv) * 100;
  const brrrrWorks = ltv <= 75;

  // Turnkey buyer usually pays closer to ARV
  const turnkeyWorks = totalCost <= arv * 0.85;

  return {
    flipper: {
      works: flipperWorks,
      reason: flipperWorks
        ? `${Math.round(equityPct)}% equity margin`
        : `Only ${Math.round(equityPct)}% margin - flippers need 20%+`,
    },
    brrrrInvestor: {
      works: brrrrWorks,
      reason: brrrrWorks
        ? `${Math.round(ltv)}% LTV allows full capital recovery on refi`
        : `${Math.round(ltv)}% LTV too high - won't refi out all capital`,
    },
    turnkeyBuyer: {
      works: turnkeyWorks,
      reason: turnkeyWorks
        ? 'Total cost is under 85% of ARV - attractive for turnkey buyers'
        : 'Total cost too close to ARV for turnkey buyers',
    },
  };
}
