/**
 * Cash Flow Calculator
 *
 * Analyzes rental property cash flow, returns, and investment metrics.
 * Useful for buy-and-hold analysis or pitching to BRRRR investors.
 */

export interface CashFlowInput {
  purchasePrice: number;
  monthlyRent: number;
  repairCost?: number;           // Initial repairs needed
  downPaymentPct?: number;       // Default 25%
  interestRate?: number;         // Default 7%
  loanTermYears?: number;        // Default 30
  propertyTaxAnnual?: number;    // Or estimate from purchase price
  insuranceAnnual?: number;      // Or estimate
  vacancyPct?: number;           // Default 8%
  maintenancePct?: number;       // Default 10% of rent
  propertyMgmtPct?: number;      // Default 10% if not self-managing
  hoaMonthly?: number;           // HOA fees if applicable
  utilitiesMonthly?: number;     // If landlord pays any
}

export interface CashFlowResult {
  // Monthly breakdown
  grossRent: number;
  effectiveRent: number;         // After vacancy
  totalExpenses: number;
  mortgagePayment: number;
  netOperatingIncome: number;    // NOI (before mortgage)
  cashFlow: number;              // After mortgage

  // Annual numbers
  annualCashFlow: number;
  annualNOI: number;

  // Investment metrics
  cashOnCash: number;            // Cash return on cash invested
  capRate: number;               // NOI / purchase price
  totalCashNeeded: number;       // Down payment + repairs + closing
  grm: number;                   // Gross Rent Multiplier

  // Breakdown
  expenses: ExpenseBreakdown;

  // Analysis
  cashFlowPerUnit: number;
  meetsOnePercent: boolean;      // Does rent >= 1% of price?
  meetsTwoPercent: boolean;      // Does rent >= 2% of price?
  recommendation: 'strong_buy' | 'good' | 'marginal' | 'pass';
  analysis: string;
}

export interface ExpenseBreakdown {
  mortgage: number;
  propertyTax: number;
  insurance: number;
  vacancy: number;
  maintenance: number;
  propertyMgmt: number;
  hoa: number;
  utilities: number;
  total: number;
}

// Default assumptions for Savannah, GA market
const DEFAULTS = {
  downPaymentPct: 0.25,
  interestRate: 0.07,
  loanTermYears: 30,
  propertyTaxRate: 0.011,        // 1.1% of purchase price annually
  insuranceRate: 0.005,          // 0.5% of purchase price annually
  vacancyPct: 0.08,              // 8% vacancy
  maintenancePct: 0.10,          // 10% of rent
  propertyMgmtPct: 0.10,         // 10% if using PM
  closingCostPct: 0.03,          // 3% buyer closing costs
};

/**
 * Calculate full cash flow analysis
 */
export function calculateCashFlow(input: CashFlowInput): CashFlowResult {
  const {
    purchasePrice,
    monthlyRent,
    repairCost = 0,
    downPaymentPct = DEFAULTS.downPaymentPct,
    interestRate = DEFAULTS.interestRate,
    loanTermYears = DEFAULTS.loanTermYears,
    propertyTaxAnnual,
    insuranceAnnual,
    vacancyPct = DEFAULTS.vacancyPct,
    maintenancePct = DEFAULTS.maintenancePct,
    propertyMgmtPct = DEFAULTS.propertyMgmtPct,
    hoaMonthly = 0,
    utilitiesMonthly = 0,
  } = input;

  // Calculate loan details
  const downPayment = purchasePrice * downPaymentPct;
  const loanAmount = purchasePrice - downPayment;
  const mortgagePayment = loanAmount > 0
    ? calculateMortgagePayment(loanAmount, interestRate, loanTermYears)
    : 0;

  // Calculate expenses
  const propertyTax = propertyTaxAnnual
    ? propertyTaxAnnual / 12
    : (purchasePrice * DEFAULTS.propertyTaxRate) / 12;

  const insurance = insuranceAnnual
    ? insuranceAnnual / 12
    : (purchasePrice * DEFAULTS.insuranceRate) / 12;

  const vacancy = monthlyRent * vacancyPct;
  const maintenance = monthlyRent * maintenancePct;
  const propertyMgmt = monthlyRent * propertyMgmtPct;

  const expenses: ExpenseBreakdown = {
    mortgage: Math.round(mortgagePayment),
    propertyTax: Math.round(propertyTax),
    insurance: Math.round(insurance),
    vacancy: Math.round(vacancy),
    maintenance: Math.round(maintenance),
    propertyMgmt: Math.round(propertyMgmt),
    hoa: hoaMonthly,
    utilities: utilitiesMonthly,
    total: 0,
  };

  expenses.total = Object.values(expenses).reduce((a, b) => a + b, 0);

  // Calculate income
  const grossRent = monthlyRent;
  const effectiveRent = Math.round(monthlyRent * (1 - vacancyPct));

  // NOI = income - operating expenses (not including mortgage)
  const operatingExpenses = expenses.propertyTax + expenses.insurance +
    expenses.vacancy + expenses.maintenance + expenses.propertyMgmt +
    expenses.hoa + expenses.utilities;
  const noi = effectiveRent - operatingExpenses;

  // Cash flow = NOI - mortgage
  const cashFlow = Math.round(noi - mortgagePayment);

  // Annual numbers
  const annualCashFlow = cashFlow * 12;
  const annualNOI = noi * 12;

  // Total cash needed
  const closingCosts = purchasePrice * DEFAULTS.closingCostPct;
  const totalCashNeeded = Math.round(downPayment + repairCost + closingCosts);

  // Investment metrics
  const cashOnCash = totalCashNeeded > 0
    ? Math.round((annualCashFlow / totalCashNeeded) * 100)
    : 0;

  const capRate = purchasePrice > 0
    ? Math.round((annualNOI / purchasePrice) * 100 * 10) / 10
    : 0;

  const grm = monthlyRent > 0
    ? Math.round((purchasePrice / (monthlyRent * 12)) * 10) / 10
    : 0;

  // 1% and 2% rules
  const rentToPrice = monthlyRent / purchasePrice;
  const meetsOnePercent = rentToPrice >= 0.01;
  const meetsTwoPercent = rentToPrice >= 0.02;

  // Recommendation
  const { recommendation, analysis } = analyzeInvestment(
    cashFlow,
    cashOnCash,
    capRate,
    meetsOnePercent
  );

  return {
    grossRent,
    effectiveRent,
    totalExpenses: expenses.total,
    mortgagePayment: expenses.mortgage,
    netOperatingIncome: Math.round(noi),
    cashFlow,
    annualCashFlow,
    annualNOI,
    cashOnCash,
    capRate,
    totalCashNeeded,
    grm,
    expenses,
    cashFlowPerUnit: cashFlow, // Single family = 1 unit
    meetsOnePercent,
    meetsTwoPercent,
    recommendation,
    analysis,
  };
}

/**
 * Calculate monthly mortgage payment (P&I only)
 */
function calculateMortgagePayment(
  principal: number,
  annualRate: number,
  years: number
): number {
  const monthlyRate = annualRate / 12;
  const numPayments = years * 12;

  if (monthlyRate === 0) {
    return principal / numPayments;
  }

  const payment = principal *
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);

  return Math.round(payment);
}

/**
 * Analyze investment quality
 */
function analyzeInvestment(
  cashFlow: number,
  cashOnCash: number,
  capRate: number,
  meetsOnePercent: boolean
): { recommendation: CashFlowResult['recommendation']; analysis: string } {
  // Scoring factors
  let score = 0;
  const factors: string[] = [];

  // Cash flow scoring
  if (cashFlow >= 300) {
    score += 3;
    factors.push('Strong monthly cash flow ($300+)');
  } else if (cashFlow >= 200) {
    score += 2;
    factors.push('Good monthly cash flow ($200+)');
  } else if (cashFlow >= 100) {
    score += 1;
    factors.push('Minimal cash flow ($100-200)');
  } else if (cashFlow > 0) {
    factors.push('Thin cash flow (under $100)');
  } else {
    score -= 2;
    factors.push('Negative cash flow');
  }

  // Cash on cash scoring
  if (cashOnCash >= 12) {
    score += 3;
    factors.push(`Excellent CoC return (${cashOnCash}%)`);
  } else if (cashOnCash >= 8) {
    score += 2;
    factors.push(`Good CoC return (${cashOnCash}%)`);
  } else if (cashOnCash >= 5) {
    score += 1;
    factors.push(`Acceptable CoC return (${cashOnCash}%)`);
  } else {
    factors.push(`Low CoC return (${cashOnCash}%)`);
  }

  // Cap rate scoring
  if (capRate >= 8) {
    score += 2;
    factors.push(`Strong cap rate (${capRate}%)`);
  } else if (capRate >= 6) {
    score += 1;
    factors.push(`Decent cap rate (${capRate}%)`);
  } else {
    factors.push(`Low cap rate (${capRate}%)`);
  }

  // 1% rule
  if (meetsOnePercent) {
    score += 1;
    factors.push('Meets 1% rule');
  } else {
    factors.push('Does not meet 1% rule');
  }

  // Determine recommendation
  let recommendation: CashFlowResult['recommendation'];
  if (score >= 7) {
    recommendation = 'strong_buy';
  } else if (score >= 5) {
    recommendation = 'good';
  } else if (score >= 2) {
    recommendation = 'marginal';
  } else {
    recommendation = 'pass';
  }

  return {
    recommendation,
    analysis: factors.join('. ') + '.',
  };
}

/**
 * Quick cash flow check
 */
export function quickCashFlow(
  purchasePrice: number,
  monthlyRent: number
): { cashFlow: number; meetsOnePercent: boolean } {
  // Rough estimate: 50% rule (expenses eat 50% of rent)
  const estimatedExpenses = monthlyRent * 0.5;

  // Estimate mortgage (25% down, 7%, 30yr)
  const loanAmount = purchasePrice * 0.75;
  const mortgage = calculateMortgagePayment(loanAmount, 0.07, 30);

  const cashFlow = Math.round(monthlyRent - estimatedExpenses - mortgage);
  const meetsOnePercent = monthlyRent >= purchasePrice * 0.01;

  return { cashFlow, meetsOnePercent };
}

/**
 * Calculate rent needed for target cash flow
 */
export function rentNeededForCashFlow(
  purchasePrice: number,
  targetCashFlow: number,
  downPaymentPct: number = 0.25
): number {
  // Reverse engineer the rent needed
  const loanAmount = purchasePrice * (1 - downPaymentPct);
  const mortgage = calculateMortgagePayment(loanAmount, 0.07, 30);

  // Expenses as % of rent: vacancy 8% + maintenance 10% + mgmt 10% + tax/ins ~15%
  const expenseRatio = 0.43;

  // cashFlow = rent * (1 - expenseRatio) - mortgage
  // rent = (cashFlow + mortgage) / (1 - expenseRatio)
  const rentNeeded = (targetCashFlow + mortgage) / (1 - expenseRatio);

  return Math.round(rentNeeded / 25) * 25; // Round to $25
}

/**
 * Calculate max purchase price for target cash flow
 */
export function maxPriceForCashFlow(
  monthlyRent: number,
  targetCashFlow: number,
  downPaymentPct: number = 0.25
): number {
  // Binary search for max price
  let low = 0;
  let high = monthlyRent * 200; // Max reasonable price

  while (high - low > 1000) {
    const mid = (low + high) / 2;
    const { cashFlow } = quickCashFlow(mid, monthlyRent);

    if (cashFlow >= targetCashFlow) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return Math.round(low / 1000) * 1000;
}
