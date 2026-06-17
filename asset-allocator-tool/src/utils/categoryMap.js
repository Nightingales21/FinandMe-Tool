// Maps AMFI scheme_category strings → our 5 display buckets
export const BUCKETS = {
  LARGE: 'Large / Flexicap',
  MID: 'Midcap',
  SMALL: 'Small Cap',
  DEBT: 'Debt',
  STOCK: 'Stocks',
};

const AMFI_TO_BUCKET = {
  // Equity → Large
  'Equity Scheme - Large Cap Fund': BUCKETS.LARGE,
  'Equity Scheme - Flexi Cap Fund': BUCKETS.LARGE,
  'Equity Scheme - Focused Fund': BUCKETS.LARGE,
  'Equity Scheme - Multi Cap Fund': BUCKETS.LARGE,
  'Equity Scheme - Contra Fund': BUCKETS.LARGE,
  'Equity Scheme - Dividend Yield Fund': BUCKETS.LARGE,
  'Equity Scheme - Value Fund': BUCKETS.LARGE,
  'Equity Scheme - ELSS': BUCKETS.LARGE,
  'Equity Scheme - Sectoral/ Thematic': BUCKETS.LARGE,
  // Equity → Mid
  'Equity Scheme - Mid Cap Fund': BUCKETS.MID,
  'Equity Scheme - Large & Mid Cap Fund': BUCKETS.MID,
  // Equity → Small
  'Equity Scheme - Small Cap Fund': BUCKETS.SMALL,
  // Hybrid → Debt (conservative) or Debt (arbitrage)
  'Hybrid Scheme - Conservative Hybrid Fund': BUCKETS.DEBT,
  'Hybrid Scheme - Arbitrage Fund': BUCKETS.DEBT,
  'Hybrid Scheme - Balanced Hybrid Fund': BUCKETS.DEBT,
  'Hybrid Scheme - Equity Savings': BUCKETS.DEBT,
  // Hybrid → Large (aggressive/BAF treated as equity-ish large)
  'Hybrid Scheme - Aggressive Hybrid Fund': BUCKETS.LARGE,
  'Hybrid Scheme - Dynamic Asset Allocation or Balanced Advantage': BUCKETS.DEBT,
  'Hybrid Scheme - Multi Asset Allocation': BUCKETS.DEBT,
  // All Debt
  'Debt Scheme - Banking and PSU Fund': BUCKETS.DEBT,
  'Debt Scheme - Corporate Bond Fund': BUCKETS.DEBT,
  'Debt Scheme - Credit Risk Fund': BUCKETS.DEBT,
  'Debt Scheme - Dynamic Bond': BUCKETS.DEBT,
  'Debt Scheme - Floater Fund': BUCKETS.DEBT,
  'Debt Scheme - Gilt Fund': BUCKETS.DEBT,
  'Debt Scheme - Gilt Fund with 10 year constant duration': BUCKETS.DEBT,
  'Debt Scheme - Liquid Fund': BUCKETS.DEBT,
  'Debt Scheme - Long Duration Fund': BUCKETS.DEBT,
  'Debt Scheme - Low Duration Fund': BUCKETS.DEBT,
  'Debt Scheme - Medium Duration Fund': BUCKETS.DEBT,
  'Debt Scheme - Medium to Long Duration Fund': BUCKETS.DEBT,
  'Debt Scheme - Money Market Fund': BUCKETS.DEBT,
  'Debt Scheme - Overnight Fund': BUCKETS.DEBT,
  'Debt Scheme - Short Duration Fund': BUCKETS.DEBT,
  'Debt Scheme - Ultra Short Duration Fund': BUCKETS.DEBT,
  'Gilt': BUCKETS.DEBT,
  'Income': BUCKETS.DEBT,
  'Money Market': BUCKETS.DEBT,
  // Other
  'Other Scheme - FoF Domestic': BUCKETS.DEBT,
  'Other Scheme - FoF Overseas': BUCKETS.DEBT,
  'Other Scheme - Gold ETF': BUCKETS.DEBT,
  'Other Scheme - Index Funds': BUCKETS.LARGE,
  'Other Scheme - Other  ETFs': BUCKETS.LARGE,
  'Growth': BUCKETS.LARGE,
  'Solution Oriented Scheme - Retirement Fund': BUCKETS.DEBT,
  "Solution Oriented Scheme - Children's Fund": BUCKETS.DEBT,
};

export function amfiCategoryToBucket(amfiCategory) {
  if (!amfiCategory) return null;
  return AMFI_TO_BUCKET[amfiCategory] ?? null;
}

// Normalise a scheme name for cache lookup
export function normaliseName(name) {
  return name
    .toLowerCase()
    .replace(/\(sip\)/gi, '')
    .replace(/\bfolio[:\s]+[\w/]+/gi, '')
    .replace(/\b(direct|regular|growth|idcw|dividend|payout|reinvestment|plan)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
