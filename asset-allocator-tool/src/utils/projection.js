/**
 * Financial projection engine
 *
 * Glide path logic:
 *   >= 10 years: start at 80% equity, reduce 2% per year until 40%
 *   5-9 years:   start at 60% equity, reduce 2% per year
 *   < 5 years:   start at 30% equity, reduce linearly to 0
 *
 * Returns:
 *   - Weighted return per year (12% equity, 7% debt)
 *   - Year-by-year table
 *   - Minimum SIP needed (rounded to nearest 5000)
 */

const EQUITY_RETURN = 0.12;
const DEBT_RETURN   = 0.07;
const NOW_YEAR      = 2026;

export function equityPct(yearsToGoal, yearIdx) {
  if (yearsToGoal >= 10) {
    return Math.max(0.40, 0.80 - yearIdx * 0.02);
  } else if (yearsToGoal >= 5) {
    return Math.max(0.20, 0.60 - yearIdx * 0.02);
  } else {
    return Math.max(0, 0.30 - (0.30 / yearsToGoal) * yearIdx);
  }
}

function weightedReturn(eqPct) {
  return eqPct * EQUITY_RETURN + (1 - eqPct) * DEBT_RETURN;
}

/** Accumulation goal (education, wedding, house) */
export function calcGoal(params) {
  const {
    currentCorpus = 0,
    monthlySip    = 0,
    sipStepup     = 0,      // % annual step-up
    goalYear,
    targetToday,
    inflation     = 10,     // default 10% for college/wedding
    expectedReturn,          // optional override — if null, use glide path
  } = params;

  const yearsToGoal = goalYear - NOW_YEAR;
  const targetInflated = targetToday * Math.pow(1 + inflation / 100, yearsToGoal);

  let corpus = currentCorpus;
  let sip    = monthlySip;
  const rows = [];

  for (let y = 0; y < yearsToGoal; y++) {
    const eqPct   = expectedReturn != null ? null : equityPct(yearsToGoal, y);
    const annRate  = expectedReturn != null
      ? expectedReturn / 100
      : weightedReturn(eqPct);
    const monthR  = annRate / 12;
    const sipStart = sip;

    rows.push({
      year:       NOW_YEAR + y,
      age:        null,
      corpus:     Math.round(corpus),
      sip:        Math.round(sip),
      eqPct:      eqPct != null ? Math.round(eqPct * 100) : Math.round(expectedReturn),
      annReturn:  Math.round(annRate * 100 * 10) / 10,
    });

    // Grow corpus for this year
    for (let m = 0; m < 12; m++) corpus = corpus * (1 + monthR) + sip;
    sip *= (1 + sipStepup / 100);
  }

  rows.push({
    year: goalYear, age: null,
    corpus: Math.round(corpus), sip: 0,
    eqPct: 0, annReturn: 0,
  });

  const surplus = corpus - targetInflated;

  // Calculate minimum SIP needed
  const minSip = calcMinSIP({ ...params, currentCorpus, targetInflated, yearsToGoal, expectedReturn });

  return { projectedCorpus: corpus, targetInflated, surplus, rows, minSip, yearsToGoal };
}

/** Retirement / FI goal — two phases */
export function calcRetirement(params) {
  const {
    currentCorpus    = 0,
    currentAge       = 38,
    retireAge        = 55,
    lifeExp          = 90,
    monthlySip       = 0,
    sipStepup        = 0,
    monthlyExpenses  = 150000,
    preReturn        = 12,     // % — or glide path if null
    postReturn       = 8,
    inflation        = 7,      // default 7% for FI
    useGlidePath     = true,
  } = params;

  const accuYears = retireAge - currentAge;
  const drawYears = lifeExp - retireAge;

  // ACCUMULATION
  let corpus = currentCorpus;
  let sip    = monthlySip;
  const accuRows = [];

  for (let y = 0; y < accuYears; y++) {
    const eqPct   = useGlidePath ? equityPct(accuYears, y) : preReturn / 100 / 0.12; // dummy
    const annRate  = useGlidePath
      ? weightedReturn(equityPct(accuYears, y))
      : preReturn / 100;
    const monthR  = annRate / 12;

    accuRows.push({
      year:    NOW_YEAR + y,
      age:     currentAge + y,
      corpus:  Math.round(corpus),
      sip:     Math.round(sip),
      eqPct:   useGlidePath ? Math.round(equityPct(accuYears, y) * 100) : preReturn,
      annReturn: Math.round(annRate * 100 * 10) / 10,
      phase:   'accumulation',
    });

    for (let m = 0; m < 12; m++) corpus = corpus * (1 + monthR) + sip;
    sip *= (1 + sipStepup / 100);
  }

  const retireCorpus = corpus;
  const annualExpAtRetire = monthlyExpenses * 12 * Math.pow(1 + inflation / 100, accuYears);

  // Required corpus (PV of inflation-growing withdrawals at post-retirement return)
  const realRate = (1 + postReturn / 100) / (1 + inflation / 100) - 1;
  const reqCorpus = realRate > 0.0001
    ? annualExpAtRetire * (1 - Math.pow(1 + realRate, -drawYears)) / realRate
    : annualExpAtRetire * drawYears;

  // DRAWDOWN
  let wCorpus = retireCorpus;
  const drawRows = [];
  let depletionAge = null;

  for (let y = 0; y <= drawYears; y++) {
    const age  = retireAge + y;
    const yr   = NOW_YEAR + accuYears + y;
    const withdrawal = annualExpAtRetire * Math.pow(1 + inflation / 100, y);

    drawRows.push({
      year:       yr,
      age:        age,
      corpus:     Math.max(0, Math.round(wCorpus)),
      withdrawal: Math.round(withdrawal),
      phase:      'withdrawal',
    });

    if (wCorpus <= 0 && !depletionAge) depletionAge = age;
    wCorpus = wCorpus * (1 + postReturn / 100) - withdrawal;
  }

  const minSip = calcMinSIPRetirement({ ...params, reqCorpus, accuYears });

  return {
    retireCorpus, reqCorpus, surplus: retireCorpus - reqCorpus,
    annualExpAtRetire, depletionAge,
    accuRows, drawRows, minSip,
  };
}

/** Minimum SIP for accumulation goal */
function calcMinSIP({ currentCorpus, targetInflated, yearsToGoal, sipStepup = 0, expectedReturn }) {
  const months = yearsToGoal * 12;
  // Use average glide-path return for the period
  let avgRate = 0;
  for (let y = 0; y < yearsToGoal; y++) {
    avgRate += expectedReturn != null
      ? expectedReturn / 100
      : weightedReturn(equityPct(yearsToGoal, y));
  }
  avgRate = avgRate / yearsToGoal;
  const monthR = avgRate / 12;

  // FV of existing corpus
  const fvCorpus = currentCorpus * Math.pow(1 + monthR, months);
  const remaining = Math.max(0, targetInflated - fvCorpus);

  let sip;
  if (sipStepup === 0) {
    sip = monthR > 0
      ? remaining * monthR / (Math.pow(1 + monthR, months) - 1)
      : remaining / months;
  } else {
    // Binary search with step-up
    let lo = 0, hi = remaining / 12;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      let c = 0, s = mid;
      for (let m = 0; m < months; m++) { c = c * (1 + monthR) + s; if (m > 0 && m % 12 === 0) s *= (1 + sipStepup / 100); }
      if (c < remaining) lo = mid; else hi = mid;
    }
    sip = (lo + hi) / 2;
  }

  return Math.ceil(sip / 5000) * 5000;
}

function calcMinSIPRetirement({ currentCorpus, reqCorpus, accuYears, sipStepup = 0, preReturn = 12, useGlidePath = true }) {
  const months = accuYears * 12;
  let avgRate = 0;
  for (let y = 0; y < accuYears; y++) {
    avgRate += useGlidePath ? weightedReturn(equityPct(accuYears, y)) : preReturn / 100;
  }
  avgRate = avgRate / accuYears;
  const monthR = avgRate / 12;
  const fvCorpus = currentCorpus * Math.pow(1 + monthR, months);
  const remaining = Math.max(0, reqCorpus - fvCorpus);

  let sip;
  if (sipStepup === 0) {
    sip = monthR > 0 ? remaining * monthR / (Math.pow(1 + monthR, months) - 1) : remaining / months;
  } else {
    let lo = 0, hi = remaining / 12;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      let c = 0, s = mid;
      for (let m = 0; m < months; m++) { c = c * (1 + monthR) + s; if (m > 0 && m % 12 === 0) s *= (1 + sipStepup / 100); }
      if (c < remaining) lo = mid; else hi = mid;
    }
    sip = (lo + hi) / 2;
  }

  return Math.ceil(sip / 5000) * 5000;
}
