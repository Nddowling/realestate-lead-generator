/**
 * Scraper Index
 * Exports all scraper functions
 */

export * from './base';
export * from './tax-delinquent';
export * from './absentee';
export * from './foreclosure';
export * from './skip-trace';

// Re-export main scraper functions for convenience
export { scrapeTaxDelinquent, importTaxDelinquentManual } from './tax-delinquent';
export { detectAbsenteeOwners, getAbsenteeStats, findHighValueAbsentee } from './absentee';
export { scrapeForeclosures, getUpcomingAuctions, importForeclosureManual } from './foreclosure';
export { skipTraceLead, skipTraceLeads, getLeadsNeedingSkipTrace } from './skip-trace';
