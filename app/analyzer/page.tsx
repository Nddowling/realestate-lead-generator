'use client';

/**
 * Deal Analyzer Page
 *
 * Comprehensive deal analysis tool for wholesale real estate
 * Shows ARV, MAO, repair estimates, cash flow, and deal score in real-time
 */

import { useState, useMemo } from 'react';
import {
  quickARVEstimate,
  estimateRepairs,
  getRepairRange,
  calculateMAO,
  calculateCashFlow,
  scoreDeal,
  quickDealCheck,
  ConditionLevel,
} from '@/lib/analyzers';

// Condition options for the dropdown
const CONDITIONS: { value: ConditionLevel; label: string; description: string }[] = [
  { value: 'turnkey', label: 'Turnkey', description: 'Move-in ready, minimal work needed' },
  { value: 'cosmetic', label: 'Cosmetic', description: 'Paint, flooring, minor updates' },
  { value: 'moderate', label: 'Moderate', description: 'Kitchen/bath updates, some repairs' },
  { value: 'heavy', label: 'Heavy Rehab', description: 'Major renovation, systems work' },
  { value: 'gut', label: 'Gut Rehab', description: 'Complete renovation needed' },
];

// Map ConditionLevel to ARV condition type
function getArvCondition(condition: ConditionLevel): 'excellent' | 'good' | 'average' {
  switch (condition) {
    case 'turnkey': return 'excellent';
    case 'cosmetic': return 'good';
    default: return 'average';
  }
}

export default function AnalyzerPage() {
  // Input state
  const [sqft, setSqft] = useState<number>(1500);
  const [pricePerSqft, setPricePerSqft] = useState<number>(150);
  const [askingPrice, setAskingPrice] = useState<number>(150000);
  const [condition, setCondition] = useState<ConditionLevel>('moderate');
  const [monthlyRent, setMonthlyRent] = useState<number>(1500);
  const [wholesaleFee, setWholesaleFee] = useState<number>(10000);
  const [downPaymentPct, setDownPaymentPct] = useState<number>(25);
  const [interestRate, setInterestRate] = useState<number>(7);
  const [propertyTaxRate, setPropertyTaxRate] = useState<number>(1.1);
  const [insuranceAnnual, setInsuranceAnnual] = useState<number>(1200);

  // Calculated values
  const calculations = useMemo(() => {
    // ARV Estimate
    const arvEstimate = quickARVEstimate(sqft, pricePerSqft, getArvCondition(condition));

    // Repair Estimate
    const repairEstimate = estimateRepairs({
      sqft,
      condition,
      yearBuilt: 1980, // Default assumption
    });

    // Get repair range
    const repairRange = getRepairRange(sqft, condition);

    // MAO Calculation
    const maoResult = calculateMAO({
      arv: arvEstimate,
      repairCost: repairEstimate.totalCost,
      wholesaleFee,
      holdingCosts: repairEstimate.totalCost * 0.1, // 10% of repairs for holding
      closingCosts: arvEstimate * 0.03, // 3% closing costs
    });

    // Quick deal check
    const dealCheck = quickDealCheck(arvEstimate, askingPrice, repairEstimate.totalCost);

    // Cash flow analysis (if buying as rental)
    const cashFlowResult = calculateCashFlow({
      purchasePrice: askingPrice,
      monthlyRent,
      downPaymentPct: downPaymentPct / 100,
      interestRate: interestRate / 100,
      propertyTaxAnnual: askingPrice * (propertyTaxRate / 100),
      insuranceAnnual,
      vacancyPct: 0.08,
      propertyMgmtPct: 0.10,
      maintenancePct: 0.05,
      loanTermYears: 30,
    });

    // Deal score
    const dealScore = scoreDeal({
      arv: arvEstimate,
      purchasePrice: askingPrice,
      repairCost: repairEstimate.totalCost,
      monthlyRent,
      sqft,
      condition,
    });

    return {
      arvEstimate,
      repairEstimate,
      repairRange,
      maoResult,
      dealCheck,
      cashFlowResult,
      dealScore,
    };
  }, [sqft, pricePerSqft, condition, askingPrice, monthlyRent, wholesaleFee, downPaymentPct, interestRate, propertyTaxRate, insuranceAnnual]);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format percentage
  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Get grade color
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-400';
      case 'B': return 'text-green-500';
      case 'C': return 'text-yellow-400';
      case 'D': return 'text-orange-400';
      case 'F': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-green-400">Deal Analyzer</h1>
          <p className="text-gray-400 mt-2">
            Analyze potential deals with real-time calculations for ARV, MAO, repairs, and cash flow
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Section */}
          <div className="lg:col-span-1 space-y-6">
            {/* Property Details */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-green-400">Property Details</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Square Footage</label>
                  <input
                    type="number"
                    value={sqft}
                    onChange={(e) => setSqft(Number(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-green-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Market $/sqft (Comps Avg)</label>
                  <input
                    type="number"
                    value={pricePerSqft}
                    onChange={(e) => setPricePerSqft(Number(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-green-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Asking Price</label>
                  <input
                    type="number"
                    value={askingPrice}
                    onChange={(e) => setAskingPrice(Number(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-green-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Property Condition</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as ConditionLevel)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-green-500 focus:outline-none"
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label} - {c.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Wholesale Fee</label>
                  <input
                    type="number"
                    value={wholesaleFee}
                    onChange={(e) => setWholesaleFee(Number(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-green-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Rental Analysis Inputs */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-green-400">Rental Analysis</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Monthly Rent</label>
                  <input
                    type="number"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(Number(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-green-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Down Payment %</label>
                  <input
                    type="number"
                    value={downPaymentPct}
                    onChange={(e) => setDownPaymentPct(Number(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-green-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Interest Rate %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={interestRate}
                    onChange={(e) => setInterestRate(Number(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-green-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Property Tax Rate %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={propertyTaxRate}
                    onChange={(e) => setPropertyTaxRate(Number(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-green-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Annual Insurance</label>
                  <input
                    type="number"
                    value={insuranceAnnual}
                    onChange={(e) => setInsuranceAnnual(Number(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-green-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Deal Score Card */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-green-400">Deal Score</h2>
                  <p className="text-gray-400 text-sm mt-1">{calculations.dealScore.summary}</p>
                </div>
                <div className="text-right">
                  <div className={`text-6xl font-bold ${getGradeColor(calculations.dealScore.grade)}`}>
                    {calculations.dealScore.grade}
                  </div>
                  <div className="text-gray-400 text-sm">{calculations.dealScore.score}/100</div>
                </div>
              </div>

              {/* Score Factors */}
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                {calculations.dealScore.factors.slice(0, 6).map((factor) => (
                  <div key={factor.name} className="bg-gray-700 rounded p-3">
                    <div className="text-xs text-gray-400">{factor.name}</div>
                    <div className={`text-lg font-semibold ${
                      factor.impact === 'positive' ? 'text-green-400' :
                      factor.impact === 'negative' ? 'text-red-400' : 'text-gray-300'
                    }`}>{factor.score}/100</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Deal Check */}
            <div className={`rounded-lg p-6 ${calculations.dealCheck.passes ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    {calculations.dealCheck.passes ? '✅ Deal Passes 70% Rule' : '❌ Deal Fails 70% Rule'}
                  </h3>
                  <p className="text-gray-300 text-sm">{calculations.dealCheck.reason}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {formatPercent(calculations.dealCheck.margin)} margin
                  </div>
                </div>
              </div>
            </div>

            {/* MAO Results */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-green-400">Maximum Allowable Offer</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400">Conservative (65%)</div>
                  <div className="text-2xl font-bold text-green-400">
                    {formatCurrency(calculations.maoResult.conservative.maxOffer)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Profit: {formatCurrency(calculations.maoResult.conservative.potentialProfit)}
                  </div>
                </div>

                <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400">Moderate (70%)</div>
                  <div className="text-2xl font-bold text-yellow-400">
                    {formatCurrency(calculations.maoResult.moderate.maxOffer)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Profit: {formatCurrency(calculations.maoResult.moderate.potentialProfit)}
                  </div>
                </div>

                <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                  <div className="text-sm text-gray-400">Aggressive (75%)</div>
                  <div className="text-2xl font-bold text-red-400">
                    {formatCurrency(calculations.maoResult.aggressive.maxOffer)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Profit: {formatCurrency(calculations.maoResult.aggressive.potentialProfit)}
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-gray-700 rounded">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">ARV Estimate:</span>
                    <span className="ml-2 font-semibold">{formatCurrency(calculations.arvEstimate)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Repair Cost:</span>
                    <span className="ml-2 font-semibold">{formatCurrency(calculations.repairEstimate.totalCost)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Wholesale Fee:</span>
                    <span className="ml-2 font-semibold">{formatCurrency(wholesaleFee)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">vs Asking:</span>
                    <span className={`ml-2 font-semibold ${calculations.maoResult.moderate.maxOffer >= askingPrice ? 'text-green-400' : 'text-red-400'}`}>
                      {calculations.maoResult.moderate.maxOffer >= askingPrice ? 'Under MAO ✓' : 'Over MAO ✗'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Repair Estimate */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-green-400">Repair Estimate</h2>

              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-gray-400">Condition:</span>
                  <span className="ml-2 font-semibold capitalize">{condition}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400">Estimated at {formatCurrency(calculations.repairEstimate.costPerSqft)}/sqft</div>
                  <div className="text-2xl font-bold text-green-400">
                    {formatCurrency(calculations.repairEstimate.totalCost)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {calculations.repairEstimate.breakdown.slice(0, 6).map((item) => (
                  <div key={item.category} className="bg-gray-700 rounded p-3">
                    <div className="text-xs text-gray-400">{item.category}</div>
                    <div className="font-semibold">{formatCurrency(item.cost)}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-sm text-gray-400">
                Range: {formatCurrency(calculations.repairRange.low)} - {formatCurrency(calculations.repairRange.high)}
                <span className="ml-4">Timeline: {calculations.repairEstimate.timeline}</span>
              </div>
            </div>

            {/* Cash Flow Analysis */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-green-400">Cash Flow Analysis (Rental)</h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-700 rounded p-3">
                  <div className="text-xs text-gray-400">Monthly Cash Flow</div>
                  <div className={`text-xl font-bold ${calculations.cashFlowResult.cashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(calculations.cashFlowResult.cashFlow)}
                  </div>
                </div>

                <div className="bg-gray-700 rounded p-3">
                  <div className="text-xs text-gray-400">Cash-on-Cash Return</div>
                  <div className={`text-xl font-bold ${calculations.cashFlowResult.cashOnCash >= 8 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {formatPercent(calculations.cashFlowResult.cashOnCash)}
                  </div>
                </div>

                <div className="bg-gray-700 rounded p-3">
                  <div className="text-xs text-gray-400">Cap Rate</div>
                  <div className={`text-xl font-bold ${calculations.cashFlowResult.capRate >= 6 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {formatPercent(calculations.cashFlowResult.capRate)}
                  </div>
                </div>

                <div className="bg-gray-700 rounded p-3">
                  <div className="text-xs text-gray-400">GRM</div>
                  <div className="text-xl font-bold">
                    {calculations.cashFlowResult.grm.toFixed(1)}
                  </div>
                </div>
              </div>

              {/* Income/Expense Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-700 rounded p-4">
                  <h3 className="font-semibold text-green-400 mb-2">Income</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Gross Rent</span>
                      <span>{formatCurrency(calculations.cashFlowResult.grossRent)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Vacancy (-8%)</span>
                      <span className="text-red-400">-{formatCurrency(calculations.cashFlowResult.grossRent * 0.08)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t border-gray-600 pt-1 mt-1">
                      <span>Effective Income</span>
                      <span>{formatCurrency(calculations.cashFlowResult.effectiveRent)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-700 rounded p-4">
                  <h3 className="font-semibold text-red-400 mb-2">Expenses</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Mortgage (P&I)</span>
                      <span>{formatCurrency(calculations.cashFlowResult.mortgagePayment)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Operating Expenses</span>
                      <span>{formatCurrency(calculations.cashFlowResult.totalExpenses - calculations.cashFlowResult.mortgagePayment)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t border-gray-600 pt-1 mt-1">
                      <span>Total Expenses</span>
                      <span>{formatCurrency(calculations.cashFlowResult.totalExpenses)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div className={`p-2 rounded ${calculations.cashFlowResult.meetsOnePercent ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                  <span className="text-gray-400">1% Rule:</span>
                  <span className="ml-2">{calculations.cashFlowResult.meetsOnePercent ? '✅ Passes' : '❌ Fails'}</span>
                </div>
                <div className="p-2 rounded bg-gray-700">
                  <span className="text-gray-400">Cash Needed:</span>
                  <span className="ml-2">{formatCurrency(calculations.cashFlowResult.totalCashNeeded)}</span>
                </div>
                <div className="p-2 rounded bg-gray-700">
                  <span className="text-gray-400">Annual Cash Flow:</span>
                  <span className="ml-2">{formatCurrency(calculations.cashFlowResult.annualCashFlow)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
