/**
 * KEY DESIGN PRINCIPLE:
 * Holdings are NEVER merged across accounts during parsing.
 * holdingKey = `${account}::${schemeName}` is the true unique identity.
 *
 * K: Parag Parikh Flexi Cap → holdingKey "K::PPFC"
 * G: Parag Parikh Flexi Cap → holdingKey "G::PPFC"  ← distinct item
 *
 * Merging only happens at calculation time when two holdingKeys with the
 * same schemeName are assigned to the same goal by the user.
 */
import * as XLSX from 'xlsx';

function stripSchemeNoise(name) {
  return name
    .replace(/\s*\(INF[A-Z0-9]+\)/g, '')
    .replace(/\s*\(IN[A-Z0-9]+\)/g, '')
    .replace(/\s*\([A-Z0-9]{12}\)/g, '')
    .replace(/\s*-\s*Reg(ular)?\s*\(G\)\s*/gi, ' ')
    .replace(/\s*-\s*Regular Plan\s*/gi, ' ')
    .replace(/\s*\(G\)\s*/g, ' ')
    .replace(/\s*\(SIP\)\s*/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}

function parseSheet(ws, accountLabel) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  let clientName = '', reportDate = '';

  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const cell = rows[i]?.[0] ? String(rows[i][0]) : '';
    if (cell.match(/as on/i)) { const m = cell.match(/as on (.+)/i); if (m) reportDate = m[1].trim(); }
    if (cell.match(/^Name:/i)) clientName = cell.replace(/^Name:\s*/i, '').trim();
    if (i === 1 && cell && !cell.match(/^(Name:|DOB:|Live)/i) && cell.trim().length > 0 && cell.trim().length < 30)
      clientName = cell.split('(')[0].trim();
  }

  let headerRowIdx = -1, inHeldAway = false;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r?.[0] && String(r[0]).toLowerCase().includes('cas heldaway')) inHeldAway = true;
    if (r?.[0] === 'Scheme Name' && !inHeldAway) { headerRowIdx = i; break; }
  }
  if (headerRowIdx === -1) return { clientName, reportDate, holdings: [] };

  const header = rows[headerRowIdx];
  const curValueCol = header.indexOf('Cur. Value');
  if (curValueCol === -1) return { clientName, reportDate, holdings: [] };

  inHeldAway = false;
  const aggregated = {};
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const cell0 = r[0] ? String(r[0]).trim() : '';
    if (cell0.toLowerCase().includes('cas heldaway')) { inHeldAway = true; continue; }
    if (inHeldAway || !cell0 || cell0.toLowerCase() === 'grand total') continue;

    const schemeName = stripSchemeNoise(cell0.split(/\n/)[0].replace(/\(SIP\)/gi, ''));
    if (!schemeName) continue;

    let curValue = 0;
    try { curValue = parseFloat(r[curValueCol]) || 0; } catch {}
    if (curValue <= 0) continue;
    aggregated[schemeName] = (aggregated[schemeName] || 0) + curValue;
  }

  return {
    clientName, reportDate,
    holdings: Object.entries(aggregated).map(([schemeName, curValue]) => ({
      schemeName,
      account: accountLabel,
      holdingKey: `${accountLabel}::${schemeName}`,
      curValue: Math.round(curValue * 100) / 100,
    })),
  };
}

export function parsePortfolioFile(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const GOAL_WORDS = ['retirement','college','wedding','daughter','son','education','travel','insurance'];
  const portfolioSheets = wb.SheetNames.filter(name => {
    const n = name.toLowerCase();
    if (GOAL_WORDS.some(w => n.includes(w))) return false;
    return n.includes('portfolio');
  });
  const sheetsToUse = portfolioSheets.length > 0 ? portfolioSheets : [wb.SheetNames[0]];

  let clientName = '', reportDate = '';
  const accounts = [];

  for (const sheetName of sheetsToUse) {
    const accountLabel = sheetName
      .replace(/portfolio/gi, '').replace(/status/gi, '')
      .replace(/[-\u2013_]/g, ' ').replace(/\s+/g, ' ').trim() || sheetName;
    const parsed = parseSheet(wb.Sheets[sheetName], accountLabel);
    if (parsed.clientName) clientName = parsed.clientName;
    if (parsed.reportDate) reportDate = parsed.reportDate;
    if (parsed.holdings.length > 0) accounts.push({ label: accountLabel, holdings: parsed.holdings });
  }

  const allHoldings = accounts.flatMap(a => a.holdings);
  return { clientName, reportDate, accounts, holdings: allHoldings, parseErrors: allHoldings.length === 0 ? ['No holdings found'] : [] };
}

export function mergePortfolios(portfolios) {
  if (!portfolios?.length) return null;
  if (portfolios.length === 1) return portfolios[0];

  const clientName = portfolios.map(p => p.clientName).filter(Boolean).join(' & ');
  const reportDate = portfolios[0].reportDate;

  const accounts = portfolios.flatMap(p =>
    p.accounts.map(acc => {
      const label = p.clientName || acc.label;
      return {
        label,
        holdings: acc.holdings.map(h => ({
          ...h,
          account: label,
          holdingKey: `${label}::${h.schemeName}`,
        })),
      };
    })
  );

  return { clientName, reportDate, accounts, holdings: accounts.flatMap(a => a.holdings), parseErrors: [] };
}
