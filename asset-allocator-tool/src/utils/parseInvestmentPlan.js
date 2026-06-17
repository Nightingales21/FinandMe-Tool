/**
 * parseInvestmentPlan.js
 *
 * Handles two file formats:
 *
 * FORMAT A (G-Investment-Plan.xlsx, original K-G review):
 *   Row 1: account label in col B (e.g. "G A/c")
 *   Goals in col B: goal name, then "Investible Amount", then fund rows
 *
 * FORMAT B (K-Investment-Plan.xlsx, standalone files):
 *   Row 1: account label in col A (e.g. "K")
 *   Goals in col A: goal name, then "Investible Amount", then fund rows
 *
 * Returns: [{ goalName, fundNames, accountLabel }]
 */
import * as XLSX from 'xlsx';
import { lookupPlanName } from './fundLookup';

const ADMIN = new Set([
  'investible amount','equity allocation','debt allocation',
  'equity funds','debt funds','gold funds','gold allocation',
  'total','investable amount',
]);

function isAdmin(v) {
  if (!v) return true;
  if (typeof v === 'number') return true;
  return ADMIN.has(String(v).toLowerCase().trim());
}

function isFundName(v) {
  if (!v || typeof v !== 'string') return false;
  const s = v.trim();
  if (s.length < 3 || isAdmin(s)) return false;
  // Reject pure percentages / numbers
  if (/^[\d.%]+$/.test(s)) return false;
  return true;
}

export function parseInvestmentPlan(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });

  const sheetName =
    wb.SheetNames.find(n => n === 'Investment Plan') ||
    wb.SheetNames.find(n => n.toLowerCase().includes('investment')) ||
    wb.SheetNames[0];

  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Detect which column holds the goals
  // Look at row 0: if col A has a value → FORMAT B, if col B has a value → FORMAT A
  const row0 = rows[0] || [];
  const colA0 = row0[0] ? String(row0[0]).trim() : '';
  const colB0 = row0[1] ? String(row0[1]).trim() : '';
  const goalCol = colA0 && !colB0 ? 0 : 1; // col A (0) or col B (1)
  const accountLabel = colA0 || colB0 || 'Main';

  // Find all goal blocks: a goal name is a non-admin string
  // followed within 3 rows by "Investible Amount" in the same column
  const goalBlocks = [];
  for (let r = 0; r < rows.length; r++) {
    const v = rows[r]?.[goalCol];
    if (!v || typeof v !== 'string') continue;
    const s = v.trim();
    if (!s || isAdmin(s)) continue;
    // Check next 1-4 rows for "Investible Amount"
    for (let look = 1; look <= 4; look++) {
      const nv = rows[r + look]?.[goalCol];
      if (nv && typeof nv === 'string' && nv.trim().toLowerCase() === 'investible amount') {
        goalBlocks.push({ goalName: s, startRow: r, investRow: r + look });
        break;
      }
    }
  }

  // Set end rows
  for (let i = 0; i < goalBlocks.length; i++) {
    const next = goalBlocks[i + 1];
    goalBlocks[i].endRow = next ? next.startRow - 1 : rows.length - 1;
  }

  const goals = [];
  for (const gb of goalBlocks) {
    const fundNames = [];
    let inFundSection = false;

    for (let r = gb.investRow + 1; r <= gb.endRow; r++) {
      const v = rows[r]?.[goalCol];
      if (!v) continue;
      const s = String(v).trim();
      const sl = s.toLowerCase();

      if (sl === 'equity funds' || sl === 'debt funds' || sl === 'gold funds') {
        inFundSection = true;
        continue;
      }
      if (isAdmin(v)) continue;
      if (isFundName(v) && !fundNames.includes(s)) {
        fundNames.push(s);
      }
    }

    if (fundNames.length > 0) {
      goals.push({ goalName: gb.goalName, fundNames, accountLabel });
    }
  }

  return goals;
}

export function matchPlanToHoldings(planGoals, holdings) {
  const allAccounts = [...new Set(holdings.map(h => h.account))];

  const resolveAccounts = (label) => {
    if (!label) return null;
    const ll = label.toLowerCase();
    const matched = allAccounts.filter(acc => {
      const al = acc.toLowerCase();
      return ll === al || ll.startsWith(al) || al.startsWith(ll.split(/[\s\-\/]/)[0]);
    });
    return matched.length > 0 ? matched : null;
  };

  // Build cleaned holdings index
  const cleanedHoldings = holdings.map(h => ({
    holdingKey: h.holdingKey,
    schemeName: h.schemeName,
    account: h.account,
    cleanLower: h.schemeName
      .replace(/\s*\(INF[A-Z0-9]+\)/g, '')
      .replace(/\s*\(G\)\s*/g, ' ')
      .replace(/\s*\(SIP\)\s*/gi, ' ')
      .replace(/\s*-\s*Reg(ular)?\s*/gi, ' ')
      .replace(/\s+/g, ' ').trim().toLowerCase(),
  }));

  const seen = new Set();
  const uniqueClean = cleanedHoldings.filter(h => {
    if (seen.has(h.schemeName)) return false;
    seen.add(h.schemeName); return true;
  });

  return planGoals.map(pg => {
    const accountsForGoal = resolveAccounts(pg.accountLabel);
    const fundKeys = [];

    for (const abbr of pg.fundNames) {
      const schemeName = lookupPlanName(abbr, uniqueClean);
      if (!schemeName) continue;

      const allForScheme = cleanedHoldings.filter(h => h.schemeName === schemeName);
      let selected;
      if (accountsForGoal?.length) {
        const filtered = allForScheme.filter(h =>
          accountsForGoal.some(acc =>
            h.account === acc ||
            h.account.toLowerCase().includes(acc.toLowerCase()) ||
            acc.toLowerCase().includes(h.account.toLowerCase())
          )
        );
        selected = filtered.length > 0 ? filtered : allForScheme;
      } else {
        selected = allForScheme;
      }
      selected.forEach(h => { if (!fundKeys.includes(h.holdingKey)) fundKeys.push(h.holdingKey); });
    }

    return { goalName: pg.goalName, fundKeys };
  });
}
