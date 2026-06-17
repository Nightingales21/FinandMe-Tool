import ExcelJS from 'exceljs';
import { CHART_W, CHART_H } from '../components/ExportPhase';

// ExcelJS pixel formulas (at 96dpi):
//   col width chars → pixels: px = chars * 7 + 5
//   row height pt   → pixels: px = pt * (4/3)
// Inverse:
//   pixels → col chars: chars = (px - 5) / 7
//   pixels → row pt:    pt    = px * (3/4)

const pxToColChars = px => (px - 5) / 7;
const pxToRowPt    = px => px * 0.75;

// Chart canvas is CHART_W × CHART_H pixels
// We want one Excel column to be exactly CHART_W px wide
// and one Excel row to be exactly CHART_H px tall
const CHART_COL_W  = pxToColChars(CHART_W);  // chars
const CHART_ROW_H  = pxToRowPt(CHART_H);      // pt
const GAP_COL_W    = pxToColChars(24);         // ~24px gap between charts

function b64toBuffer(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const bin = atob(base64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

export async function generateReviewXlsx({ clientName, reportDate, goals, portfolioHoldings, chartImages }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Fin and Me';
  wb.created = new Date();

  // ── Sheet 1: Asset Allocation Review ────────────────────────────────────
  const ws = wb.addWorksheet('Asset Allocation Review');
  ws.getColumn(1).width = 38; ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 14; ws.getColumn(4).width = 14;

  let row = 1;
  const addRow = (cols, opts = {}) => {
    const r = ws.getRow(row++);
    cols.forEach((v, i) => { r.getCell(i+1).value = v ?? null; });
    if (opts.bold) cols.forEach((_, i) => { r.getCell(i+1).font = { bold: true }; });
    if (opts.bg)   cols.forEach((_, i) => {
      r.getCell(i+1).fill = { type:'pattern', pattern:'solid', fgColor:{ argb:opts.bg } };
    });
    if (opts.numFmt) [2,3,4].forEach(ci => {
      const c = r.getCell(ci);
      if (typeof c.value === 'number') c.numFmt = opts.numFmt;
    });
    r.commit?.();
  };

  addRow(['Mutual Fund','Value'], { bold:true, bg:'FFD3DCF0' });
  for (const h of portfolioHoldings) addRow([h.schemeName, h.curValue], { numFmt:'#,##0.00' });
  addRow([null, portfolioHoldings.reduce((s,h)=>s+h.curValue,0)], { bold:true, numFmt:'#,##0.00' });
  row++;

  const EQ = ['Large / Flexicap','Midcap','Small Cap'];

  for (const goal of goals) {
    row++;
    const debtFunds    = goal.funds.filter(f=>f.bucket==='Debt');
    const debtMFTotal  = debtFunds.reduce((s,f)=>s+f.curValue,0);
    const debtExtras   = (goal.epf||0)+(goal.wifeEpf||0)+(goal.ppf||0)+(goal.wifePpf||0)+(goal.nsc||0)+(goal.debtOther||0);
    const eqMFTotal    = goal.funds.filter(f=>EQ.includes(f.bucket)).reduce((s,f)=>s+f.curValue,0);
    const equityTotal  = eqMFTotal+(goal.stocksValue||0)+(goal.equityOther||0);
    const corpusTotal  = equityTotal+debtMFTotal+debtExtras;
    const debtPct      = corpusTotal>0?(debtMFTotal+debtExtras)/corpusTotal:0;

    addRow([goal.name], { bold:true, bg:'FFFFF2CC' });
    addRow(['Equity', equityTotal, corpusTotal>0?equityTotal/corpusTotal:0], { numFmt:'#,##0.00' });
    ws.getRow(row-1).getCell(3).numFmt='0.00%';
    addRow(['Debt', debtMFTotal+debtExtras, corpusTotal>0?(debtMFTotal+debtExtras)/corpusTotal:0], { numFmt:'#,##0.00' });
    ws.getRow(row-1).getCell(3).numFmt='0.00%';
    row++;

    for (const b of EQ) {
      const v = goal.funds.filter(f=>f.bucket===b).reduce((s,f)=>s+f.curValue,0);
      addRow([b, v, eqMFTotal>0?v/eqMFTotal:0, corpusTotal>0?v/corpusTotal:0], { numFmt:'#,##0.00' });
      ws.getRow(row-1).getCell(3).numFmt='0.00%'; ws.getRow(row-1).getCell(4).numFmt='0.00%';
    }
    if (goal.stocksValue) addRow(['Stocks', goal.stocksValue], { numFmt:'#,##0.00' });
    if (goal.equityOther) addRow(['Equity Other', goal.equityOther], { numFmt:'#,##0.00' });
    addRow(['Equity Total', equityTotal, 1], { bold:true, numFmt:'#,##0.00', bg:'FFD9EAD3' });
    ws.getRow(row-1).getCell(3).numFmt='0.00%';
    row++;

    addRow(['Debt'], { bold:true });
    if (goal.epf)       addRow(['Client EPF',  goal.epf,      debtPct], { numFmt:'#,##0.00' });
    if (goal.wifeEpf)   addRow(['Spouse EPF',  goal.wifeEpf], { numFmt:'#,##0.00' });
    if (goal.ppf)       addRow(['Client PPF',  goal.ppf],     { numFmt:'#,##0.00' });
    if (goal.wifePpf)   addRow(['Spouse PPF',  goal.wifePpf], { numFmt:'#,##0.00' });
    if (goal.nsc)       addRow(['NSC',          goal.nsc],     { numFmt:'#,##0.00' });
    if (goal.debtOther) addRow(['Other',        goal.debtOther], { numFmt:'#,##0.00' });
    addRow(['Debt MFs', debtMFTotal], { numFmt:'#,##0.00' });
    addRow(['Debt Total', debtMFTotal+debtExtras], { bold:true, numFmt:'#,##0.00', bg:'FFFCE5CD' });
    row++;
    addRow([`${goal.name} Corpus Total`, corpusTotal], { bold:true, numFmt:'#,##0.00', bg:'FFD3DCF0' });
    row++;
  }

  // ── Sheet 2: Charts ──────────────────────────────────────────────────────
  if (chartImages?.length > 0) {
    const wsC = wb.addWorksheet('Charts');

    // Layout: each goal gets one row of two charts side by side
    // Columns: [margin] [asset chart] [gap] [cap chart] [margin]
    // Col indices (0-based): 0=margin, 1=assetChart, 2=gap, 3=capChart, 4=margin
    wsC.getColumn(1).width = 2;           // col A: left margin
    wsC.getColumn(2).width = CHART_COL_W; // col B: asset allocation chart
    wsC.getColumn(3).width = GAP_COL_W;   // col C: gap
    wsC.getColumn(4).width = CHART_COL_W; // col D: market cap chart
    wsC.getColumn(5).width = 2;           // col E: right margin

    let chartRow = 0; // 0-based row index

    for (const ci of chartImages) {
      // Title row
      const titleR = wsC.getRow(chartRow + 1);
      titleR.height = 22;
      titleR.getCell(2).value = ci.goalName;
      titleR.getCell(2).font = { bold:true, size:13, color:{ argb:'FF0F1F3D' } };
      chartRow++;

      // Chart row — set exact height so image isn't squished
      wsC.getRow(chartRow + 1).height = CHART_ROW_H;

      // Embed asset allocation chart
      const assetId = wb.addImage({
        buffer: b64toBuffer(ci.assetChart),
        extension: 'png',
      });
      wsC.addImage(assetId, {
        tl: { col: 1, row: chartRow },       // col B (index 1), this row
        br: { col: 2, row: chartRow + 1 },   // col C (index 2), next row
        editAs: 'oneCell',
      });

      // Embed market cap chart
      const capId = wb.addImage({
        buffer: b64toBuffer(ci.capChart),
        extension: 'png',
      });
      wsC.addImage(capId, {
        tl: { col: 3, row: chartRow },       // col D (index 3)
        br: { col: 4, row: chartRow + 1 },   // col E (index 4)
        editAs: 'oneCell',
      });

      chartRow++;          // move past chart row
      chartRow++;          // blank spacer row between goals
    }
  }

  return wb.xlsx.writeBuffer();
}

export function downloadBuffer(buffer, filename) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
