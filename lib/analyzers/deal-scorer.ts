/**
 * Deal Scorer
 *
 * Scores overall deal quality based on multiple factors.
 * Provides letter grades and risk warnings.
 */

import { MAOResult } from './mao-calculator';
import { CashFlowResult } from './cash-flow-calculator';
import { RepairEstimate, ConditionLevel } from './repair-estimator';

export interface DealScoreInput {
  arv: number;
  purchasePrice: number;
  repairCost: number;
  condition: ConditionLevel;
  monthlyRent?: number;
  sqft: number;
  yearBuilt?: number;
  daysOnMarket?: number;
  distressType?: string;
  sellerMotivation?: 'low' | 'medium' | 'high';
  maoResult?: MAOResult;
  cashFlowResult?: CashFlowResult;
  repairEstimate?: RepairEstimate;
}

export interface DealScore {
  score: number;                 // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  category: 'excellent' | 'good' | 'fair' | 'risky' | 'pass';
  factors: ScoreFactor[];
  warnings: string[];
  strengths: string[];
  summary: string;
}

export interface ScoreFactor {
  name: string;
  weight: number;
  score: number;                 // 0-100
  impact: 'positive' | 'neutral' | 'negative';
  detail: string;
}

// Scoring weights (should sum to 100)
const WEIGHTS = {
  profitMargin: 25,
  repairRisk: 20,
  priceToArv: 20,
  cashFlow: 15,
  marketPosition: 10,
  exitOptions: 10,
};

/**
 * Score a deal based on all factors
 */
export function scoreDeal(input: DealScoreInput): DealScore {
  const factors: ScoreFactor[] = [];
  const warnings: string[] = [];
  const strengths: string[] = [];

  // 1. Profit Margin Score
  const equity = input.arv - input.purchasePrice - input.repairCost;
  const profitMarginPct = (equity / input.arv) * 100;

  let profitScore = 0;
  if (profitMarginPct >= 30) {
    profitScore = 100;
    strengths.push(`Excellent profit margin (${Math.round(profitMarginPct)}%)`);
  } else if (profitMarginPct >= 25) {
    profitScore = 85;
    strengths.push(`Strong profit margin (${Math.round(profitMarginPct)}%)`);
  } else if (profitMarginPct >= 20) {
    profitScore = 70;
  } else if (profitMarginPct >= 15) {
    profitScore = 55;
    warnings.push(`Thin profit margin (${Math.round(profitMarginPct)}%)`);
  } else if (profitMarginPct >= 10) {
    profitScore = 35;
    warnings.push(`Very thin margin - little room for error`);
  } else {
    profitScore = 10;
    warnings.push(`Insufficient profit margin (${Math.round(profitMarginPct)}%)`);
  }

  factors.push({
    name: 'Profit Margin',
    weight: WEIGHTS.profitMargin,
    score: profitScore,
    impact: profitScore >= 70 ? 'positive' : profitScore >= 50 ? 'neutral' : 'negative',
    detail: `${Math.round(profitMarginPct)}% margin ($${equity.toLocaleString()} equity)`,
  });

  // 2. Repair Risk Score
  const repairToArv = (input.repairCost / input.arv) * 100;
  let repairScore = 0;

  if (input.condition === 'turnkey' || input.condition === 'cosmetic') {
    repairScore = 90;
    strengths.push('Low repair risk - cosmetic work only');
  } else if (input.condition === 'moderate') {
    repairScore = 70;
  } else if (input.condition === 'heavy') {
    repairScore = 45;
    warnings.push('Heavy rehab increases execution risk');
  } else {
    repairScore = 25;
    warnings.push('Gut rehab - very high execution risk');
  }

  // Adjust for repair cost ratio
  if (repairToArv > 50) {
    repairScore = Math.min(repairScore, 20);
    warnings.push(`Repairs exceed 50% of ARV - extremely risky`);
  } else if (repairToArv > 35) {
    repairScore = Math.min(repairScore, 40);
    warnings.push(`Repairs over 35% of ARV`);
  }

  factors.push({
    name: 'Repair Risk',
    weight: WEIGHTS.repairRisk,
    score: repairScore,
    impact: repairScore >= 70 ? 'positive' : repairScore >= 50 ? 'neutral' : 'negative',
    detail: `${input.condition} rehab, ${Math.round(repairToArv)}% of ARV`,
  });

  // 3. Price to ARV Score
  const priceToArv = (input.purchasePrice / input.arv) * 100;
  let priceScore = 0;

  if (priceToArv <= 50) {
    priceScore = 100;
    strengths.push(`Excellent purchase price (${Math.round(priceToArv)}% of ARV)`);
  } else if (priceToArv <= 60) {
    priceScore = 85;
    strengths.push(`Strong discount from ARV`);
  } else if (priceToArv <= 70) {
    priceScore = 70;
  } else if (priceToArv <= 80) {
    priceScore = 50;
    warnings.push(`Purchase price is ${Math.round(priceToArv)}% of ARV`);
  } else {
    priceScore = 25;
    warnings.push(`Paying too close to ARV (${Math.round(priceToArv)}%)`);
  }

  factors.push({
    name: 'Purchase Discount',
    weight: WEIGHTS.priceToArv,
    score: priceScore,
    impact: priceScore >= 70 ? 'positive' : priceScore >= 50 ? 'neutral' : 'negative',
    detail: `Buying at ${Math.round(priceToArv)}% of ARV`,
  });

  // 4. Cash Flow Score (if rental data provided)
  let cashFlowScore = 50; // Neutral if no data

  if (input.monthlyRent) {
    const rentToPrice = (input.monthlyRent * 12 / input.purchasePrice) * 100;

    if (rentToPrice >= 12) {
      cashFlowScore = 100;
      strengths.push(`Excellent rent-to-price ratio (${rentToPrice.toFixed(1)}%)`);
    } else if (rentToPrice >= 10) {
      cashFlowScore = 80;
    } else if (rentToPrice >= 8) {
      cashFlowScore = 60;
    } else {
      cashFlowScore = 35;
      warnings.push(`Low rent-to-price ratio (${rentToPrice.toFixed(1)}%)`);
    }
  }

  if (input.cashFlowResult) {
    if (input.cashFlowResult.recommendation === 'strong_buy') {
      cashFlowScore = Math.max(cashFlowScore, 90);
    } else if (input.cashFlowResult.recommendation === 'good') {
      cashFlowScore = Math.max(cashFlowScore, 70);
    } else if (input.cashFlowResult.recommendation === 'marginal') {
      cashFlowScore = Math.max(cashFlowScore, 45);
    } else {
      cashFlowScore = Math.min(cashFlowScore, 30);
    }
  }

  factors.push({
    name: 'Cash Flow Potential',
    weight: WEIGHTS.cashFlow,
    score: cashFlowScore,
    impact: cashFlowScore >= 70 ? 'positive' : cashFlowScore >= 50 ? 'neutral' : 'negative',
    detail: input.monthlyRent
      ? `$${input.monthlyRent}/mo rent potential`
      : 'No rental data provided',
  });

  // 5. Market Position Score
  let marketScore = 60; // Default neutral

  if (input.sqft) {
    const pricePerSqft = input.purchasePrice / input.sqft;
    const arvPerSqft = input.arv / input.sqft;

    if (arvPerSqft >= 150 && arvPerSqft <= 250) {
      marketScore = 80;
      strengths.push('ARV is in healthy market range');
    } else if (arvPerSqft > 300) {
      marketScore = 50;
      warnings.push('Higher price point - smaller buyer pool');
    } else if (arvPerSqft < 100) {
      marketScore = 55;
      warnings.push('Lower price point - may indicate neighborhood issues');
    }
  }

  if (input.daysOnMarket) {
    if (input.daysOnMarket > 90) {
      marketScore = Math.min(marketScore, 40);
      warnings.push(`On market ${input.daysOnMarket} days - check for issues`);
    } else if (input.daysOnMarket < 14) {
      marketScore = Math.max(marketScore, 70);
    }
  }

  if (input.sellerMotivation === 'high') {
    marketScore = Math.max(marketScore, 75);
    strengths.push('Highly motivated seller');
  }

  factors.push({
    name: 'Market Position',
    weight: WEIGHTS.marketPosition,
    score: marketScore,
    impact: marketScore >= 70 ? 'positive' : marketScore >= 50 ? 'neutral' : 'negative',
    detail: input.daysOnMarket
      ? `${input.daysOnMarket} DOM, ${input.sellerMotivation || 'unknown'} motivation`
      : 'Limited market data',
  });

  // 6. Exit Options Score
  let exitScore = 60;

  // Multiple exit strategies = better deal
  const canWholesale = profitMarginPct >= 10;
  const canFlip = profitMarginPct >= 20;
  const canRent = input.monthlyRent && input.monthlyRent >= input.purchasePrice * 0.008;

  let exitOptions = 0;
  if (canWholesale) exitOptions++;
  if (canFlip) exitOptions++;
  if (canRent) exitOptions++;

  if (exitOptions >= 3) {
    exitScore = 95;
    strengths.push('Multiple exit strategies available');
  } else if (exitOptions >= 2) {
    exitScore = 75;
  } else if (exitOptions >= 1) {
    exitScore = 55;
    warnings.push('Limited exit options');
  } else {
    exitScore = 25;
    warnings.push('No clear exit strategy');
  }

  factors.push({
    name: 'Exit Options',
    weight: WEIGHTS.exitOptions,
    score: exitScore,
    impact: exitScore >= 70 ? 'positive' : exitScore >= 50 ? 'neutral' : 'negative',
    detail: `${exitOptions} viable exit strateg${exitOptions === 1 ? 'y' : 'ies'}`,
  });

  // Calculate weighted total score
  let totalScore = 0;
  for (const factor of factors) {
    totalScore += (factor.score * factor.weight) / 100;
  }

  // Round and cap
  const finalScore = Math.min(100, Math.max(0, Math.round(totalScore)));

  // Determine grade
  let grade: DealScore['grade'];
  let category: DealScore['category'];

  if (finalScore >= 85) {
    grade = 'A';
    category = 'excellent';
  } else if (finalScore >= 70) {
    grade = 'B';
    category = 'good';
  } else if (finalScore >= 55) {
    grade = 'C';
    category = 'fair';
  } else if (finalScore >= 40) {
    grade = 'D';
    category = 'risky';
  } else {
    grade = 'F';
    category = 'pass';
  }

  // Add property age warning
  if (input.yearBuilt && new Date().getFullYear() - input.yearBuilt > 50) {
    warnings.push(`Property built in ${input.yearBuilt} - verify systems`);
  }

  // Generate summary
  const summary = generateSummary(grade, category, strengths, warnings);

  return {
    score: finalScore,
    grade,
    category,
    factors,
    warnings,
    strengths,
    summary,
  };
}

/**
 * Generate deal summary
 */
function generateSummary(
  grade: string,
  category: string,
  strengths: string[],
  warnings: string[]
): string {
  const gradeDescriptions: Record<string, string> = {
    A: 'Excellent deal with strong fundamentals across all metrics.',
    B: 'Good deal worth pursuing. Minor weaknesses but solid overall.',
    C: 'Fair deal. Proceed with caution and verify all numbers.',
    D: 'Risky deal. Multiple concerns that need to be addressed.',
    F: 'Not recommended. Significant issues make this deal unfavorable.',
  };

  let summary = gradeDescriptions[grade] || '';

  if (strengths.length > 0) {
    summary += ` Key strengths: ${strengths.slice(0, 2).join(', ')}.`;
  }

  if (warnings.length > 0 && grade !== 'A') {
    summary += ` Watch out for: ${warnings.slice(0, 2).join(', ')}.`;
  }

  return summary;
}

/**
 * Quick deal check - fast pass/fail
 */
export function quickDealCheck(
  arv: number,
  purchasePrice: number,
  repairCost: number
): {
  passes: boolean;
  margin: number;
  reason: string;
} {
  const totalCost = purchasePrice + repairCost;
  const margin = ((arv - totalCost) / arv) * 100;

  if (margin < 10) {
    return {
      passes: false,
      margin: Math.round(margin),
      reason: 'Insufficient margin (under 10%)',
    };
  }

  if (repairCost > arv * 0.5) {
    return {
      passes: false,
      margin: Math.round(margin),
      reason: 'Repairs exceed 50% of ARV',
    };
  }

  if (purchasePrice > arv * 0.8) {
    return {
      passes: false,
      margin: Math.round(margin),
      reason: 'Purchase price too close to ARV',
    };
  }

  return {
    passes: true,
    margin: Math.round(margin),
    reason: margin >= 25 ? 'Strong deal' : 'Acceptable deal',
  };
}

/**
 * Compare two deals
 */
export function compareDeals(
  deal1: DealScoreInput,
  deal2: DealScoreInput
): {
  better: 1 | 2;
  score1: number;
  score2: number;
  comparison: string;
} {
  const score1 = scoreDeal(deal1);
  const score2 = scoreDeal(deal2);

  const better = score1.score >= score2.score ? 1 : 2;
  const difference = Math.abs(score1.score - score2.score);

  let comparison: string;
  if (difference <= 5) {
    comparison = 'Deals are comparable. Choose based on personal preference.';
  } else if (difference <= 15) {
    comparison = `Deal ${better} is slightly better.`;
  } else {
    comparison = `Deal ${better} is significantly better.`;
  }

  return {
    better,
    score1: score1.score,
    score2: score2.score,
    comparison,
  };
}
