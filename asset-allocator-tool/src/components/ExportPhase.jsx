import { useState } from 'react';
import { BUCKETS } from '../utils/categoryMap';

const INR = v => `₹${Math.round(v).toLocaleString('en-IN')}`;
const EQUITY_BUCKETS = [BUCKETS.LARGE, BUCKETS.MID, BUCKETS.SMALL];

// Canvas dimensions — must match what we tell ExcelJS
export const CHART_W = 400;
export const CHART_H = 480; // pie (320px) + legend (160px)

// Draw a pie chart + legend to a canvas element, return base64 PNG
export function drawPieToCanvas(slices, title) {
  const canvas = document.createElement('canvas');
  canvas.width = CHART_W;
  canvas.height = CHART_H;
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CHART_W, CHART_H);

  // Title
  ctx.fillStyle = '#0f1f3d';
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, CHART_W / 2, 20);

  const total = slices.reduce((s, sl) => s + sl.value, 0);

  if (total > 0) {
    const cx = CHART_W / 2, cy = 175, r = 140;
    let cumAngle = -Math.PI / 2;

    // Draw slices
    for (const sl of slices) {
      if (sl.value === 0) continue;
      const angle = (sl.value / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, cumAngle, cumAngle + angle);
      ctx.closePath();
      ctx.fillStyle = sl.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      cumAngle += angle;
    }

    // Centre hole (donut effect — optional, remove if you want solid pie)
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.38, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  // Legend
  const legendTop = 335;
  const lineH = 26;
  ctx.font = '12px Arial, sans-serif';
  ctx.textAlign = 'left';

  slices.filter(s => s.value > 0).forEach((sl, i) => {
    const y = legendTop + i * lineH;
    const pct = total > 0 ? ((sl.value / total) * 100).toFixed(1) : '0.0';

    // Colour swatch
    ctx.fillStyle = sl.color;
    ctx.fillRect(20, y - 10, 14, 14);

    // Label
    ctx.fillStyle = '#1a2540';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText(sl.label, 42, y);

    // Percentage (right-aligned)
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${pct}%`, 200, y);

    // Value
    ctx.font = '11px Arial, sans-serif';
    ctx.fillStyle = '#5a6680';
    ctx.fillText(INR(sl.value), CHART_W - 16, y);
    ctx.textAlign = 'left';
  });

  // Divider line above legend
  ctx.strokeStyle = '#d4dae8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(16, legendTop - 18);
  ctx.lineTo(CHART_W - 16, legendTop - 18);
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

// SVG pie for in-browser display (unchanged)
function PieChart({ slices, size = 130 }) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return <div className="pie-empty">No data</div>;
  const cx = size/2, cy = size/2, r = size/2 - 8;
  let cumAngle = -Math.PI/2;
  const paths = slices.filter(sl=>sl.value>0).map(sl => {
    const angle = (sl.value/total) * 2 * Math.PI;
    const x1 = cx + r*Math.cos(cumAngle), y1 = cy + r*Math.sin(cumAngle);
    const x2 = cx + r*Math.cos(cumAngle+angle), y2 = cy + r*Math.sin(cumAngle+angle);
    const large = angle > Math.PI ? 1 : 0;
    const p = <path key={sl.label} d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`} fill={sl.color} stroke="white" strokeWidth="2" />;
    cumAngle += angle;
    return p;
  });
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{paths}</svg>;
}

export function goalTotals(goal) {
  const equityMFTotal = goal.funds.filter(f=>EQUITY_BUCKETS.includes(f.bucket)).reduce((s,f)=>s+f.curValue,0);
  const stocksValue   = goal.stocksValue || 0;
  const equityOther   = goal.equityOther || 0;
  const equityTotal   = equityMFTotal + stocksValue + equityOther;
  const debtMF        = goal.funds.filter(f=>f.bucket===BUCKETS.DEBT).reduce((s,f)=>s+f.curValue,0);
  const debtExtras    = (goal.epf||0)+(goal.wifeEpf||0)+(goal.ppf||0)+(goal.wifePpf||0)+(goal.nsc||0)+(goal.debtOther||0);
  const debtTotal     = debtMF + debtExtras;
  const corpus        = equityTotal + debtTotal;
  const large = goal.funds.filter(f=>f.bucket===BUCKETS.LARGE).reduce((s,f)=>s+f.curValue,0);
  const mid   = goal.funds.filter(f=>f.bucket===BUCKETS.MID).reduce((s,f)=>s+f.curValue,0);
  const small = goal.funds.filter(f=>f.bucket===BUCKETS.SMALL).reduce((s,f)=>s+f.curValue,0);
  return { equityMFTotal, equityTotal, debtMF, debtExtras, debtTotal, corpus, large, mid, small };
}

function GoalCharts({ goal }) {
  const t = goalTotals(goal);
  const pct = (v, total) => total > 0 ? ((v/total)*100).toFixed(1)+'%' : '—';

  const assetSlices = [
    { value: t.equityTotal, color: '#2563eb', label: 'Equity' },
    { value: t.debtTotal,   color: '#d97706', label: 'Debt' },
  ];
  const capSlices = [
    { value: t.large, color: '#2563eb', label: 'Large/Flexi' },
    { value: t.mid,   color: '#7c3aed', label: 'Midcap' },
    { value: t.small, color: '#059669', label: 'Small Cap' },
    { value: (goal.stocksValue||0)+(goal.equityOther||0), color: '#64748b', label: 'Other' },
  ].filter(s => s.value > 0);

  return (
    <div className="goal-charts-block">
      <h4 className="goal-chart-title">{goal.name}</h4>
      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-label">Asset Allocation</div>
          <div className="chart-body">
            <PieChart slices={assetSlices} size={130} />
            <div className="chart-legend">
              {assetSlices.map(sl => (
                <div key={sl.label} className="legend-item">
                  <span className="legend-dot" style={{background:sl.color}} />
                  <span className="legend-name">{sl.label}</span>
                  <span className="legend-pct">{pct(sl.value, t.corpus)}</span>
                  <span className="legend-val">{INR(sl.value)}</span>
                </div>
              ))}
              <div className="legend-total"><span>Corpus Total</span><span>{INR(t.corpus)}</span></div>
            </div>
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-label">Market Cap Split <span className="chart-sub">(within equity)</span></div>
          <div className="chart-body">
            <PieChart slices={capSlices} size={130} />
            <div className="chart-legend">
              {capSlices.map(sl => (
                <div key={sl.label} className="legend-item">
                  <span className="legend-dot" style={{background:sl.color}} />
                  <span className="legend-name">{sl.label}</span>
                  <span className="legend-pct">{pct(sl.value, t.equityTotal)}</span>
                  <span className="legend-val">{INR(sl.value)}</span>
                </div>
              ))}
              <div className="legend-total"><span>Equity Total</span><span>{INR(t.equityTotal)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExportPhase({ reviewGoals, portfolio, onExport }) {
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);

  const buildChartImages = () => reviewGoals.map(goal => {
    const t = goalTotals(goal);
    const assetSlices = [
      { value: t.equityTotal, color: '#2563eb', label: 'Equity' },
      { value: t.debtTotal,   color: '#d97706', label: 'Debt' },
    ];
    const capSlices = [
      { value: t.large, color: '#2563eb', label: 'Large/Flexi' },
      { value: t.mid,   color: '#7c3aed', label: 'Midcap' },
      { value: t.small, color: '#059669', label: 'Small Cap' },
      { value: (goal.stocksValue||0)+(goal.equityOther||0), color: '#64748b', label: 'Other' },
    ].filter(s => s.value > 0);

    return {
      goalName: goal.name,
      assetChart: drawPieToCanvas(assetSlices, 'Asset Allocation'),
      capChart:   drawPieToCanvas(capSlices,   'Market Cap Split (within Equity)'),
    };
  });

  const handleExport = async () => {
    setExporting(true);
    await onExport(buildChartImages());
    setExporting(false);
    setDone(true);
  };

  return (
    <div className="phase-container export-phase">
      <div className="phase-hero">
        <h2>Review — {portfolio.clientName} · {portfolio.reportDate}</h2>
        <p>Present these charts to your client, then generate the Excel report with charts embedded — open in Excel and Save As PDF to share.</p>
      </div>
      <div className="export-charts">
        {reviewGoals.map(goal => <GoalCharts key={goal.id} goal={goal} />)}
      </div>
      <div className="phase-footer">
        {done ? (
          <div className="success-banner">✓ Downloaded! Open in Excel → File → Export → Save as PDF to share with client.</div>
        ) : (
          <button className="btn-primary btn-large btn-export" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Generating…' : '⬇ Generate Report with Charts (.xlsx)'}
          </button>
        )}
      </div>
    </div>
  );
}
