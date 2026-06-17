import { useState, useEffect, useRef } from 'react';
import { calcGoal, calcRetirement, equityPct } from '../utils/projection';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const NOW = 2026;
const INR = v => {
  if (v == null || isNaN(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 10000000) return '₹' + (v / 10000000).toFixed(1) + 'Cr';
  if (abs >= 100000)   return '₹' + (v / 100000).toFixed(1) + 'L';
  return '₹' + Math.round(v).toLocaleString('en-IN');
};
const INRFULL = v => v == null ? '—' : '₹' + Math.round(v).toLocaleString('en-IN');
const PCT = v => (v * 100).toFixed(1) + '%';

const COLORS = ['#185FA5','#3B6D11','#BA7517','#534AB7','#993556','#0F6E56'];
const isRetirement = name => /retirement|financial independence|fi\b/i.test(name);
const isEducation  = name => /education|college|school|ug|pg/i.test(name);

const DEFAULT_RETIREMENT = {
  currentCorpus: 0, currentAge: 38, retireAge: 55, lifeExp: 90,
  monthlySip: 50000, sipStepup: 10, monthlyExpenses: 150000,
  preReturn: 12, postReturn: 8, inflation: 7, useGlidePath: true,
};
const DEFAULT_GOAL = {
  currentCorpus: 0, targetToday: 3500000, goalYear: NOW + 8,
  monthlySip: 20000, sipStepup: 10, inflation: 10, expectedReturn: null,
};

function SliderRow({ label, value, min, max, step, fmt, onChange, disabled }) {
  return (
    <div className="sl-row">
      <div className="sl-top">
        <span>{label}</span>
        <span className="sl-val">{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        disabled={disabled}
        onChange={e => onChange(+e.target.value)} />
    </div>
  );
}

function MetricCard({ label, value, sub, tone }) {
  return (
    <div className={`plan-mc plan-mc-${tone || 'neutral'}`}>
      <div className="plan-mc-lbl">{label}</div>
      <div className="plan-mc-val">{value}</div>
      {sub && <div className="plan-mc-sub">{sub}</div>}
    </div>
  );
}

// Chart.js line chart
function LineChart({ id, datasets, labels, yFmt }) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(ref.current, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${yFmt ? yFmt(ctx.parsed.y) : ctx.parsed.y}` } },
        },
        scales: {
          x: { ticks: { maxTicksLimit: 8, font: { size: 11 } }, grid: { display: false } },
          y: { ticks: { callback: v => yFmt ? yFmt(v) : v, font: { size: 11 }, maxTicksLimit: 5 }, grid: { color: 'rgba(0,0,0,0.05)' } },
        },
      },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [labels, datasets]);

  return <canvas ref={ref} style={{ width: '100%', height: '220px' }} />;
}

// Retirement goal panel
function RetirementPanel({ goal, mode }) {
  const initialParams = mode === 'review' && goal.reviewCorpus != null
    ? { ...DEFAULT_RETIREMENT, currentCorpus: goal.reviewCorpus }
    : { ...DEFAULT_RETIREMENT };
  const [p, setP] = useState(initialParams);
  const R = calcRetirement(p);

  useEffect(() => {
    if (mode === 'review' && goal.reviewCorpus != null) {
      setP(prev => ({ ...prev, currentCorpus: goal.reviewCorpus }));
    }
  }, [mode, goal.reviewCorpus]);

  const set = (k, v) => setP(prev => ({ ...prev, [k]: v }));

  const accuLabels  = R.accuRows.map(r => r.year + '');
  const drawLabels  = R.drawRows.map(r => r.year + '');
  const allLabels   = [...new Set([...accuLabels, ...drawLabels])];
  const accuMap     = Object.fromEntries(R.accuRows.map(r => [r.year + '', r.corpus]));
  const drawMap     = Object.fromEntries(R.drawRows.map(r => [r.year + '', r.corpus]));

  const datasets = [
    { label: 'Accumulation', data: allLabels.map(l => accuMap[l] ?? null), borderColor: '#378ADD', backgroundColor: 'rgba(55,138,221,0.07)', tension: 0.4, pointRadius: 0, borderWidth: 2, fill: true, spanGaps: false },
    { label: 'Withdrawal',   data: allLabels.map(l => drawMap[l] ?? null), borderColor: '#EF9F27', borderDash: [5, 3], tension: 0.4, pointRadius: 0, backgroundColor: 'rgba(239,159,39,0.06)', borderWidth: 2, fill: true, spanGaps: false },
  ];

  // Glide path chart
  const glideLabels = R.accuRows.map(r => r.year + '');
  const glideEqData = R.accuRows.map(r => r.eqPct);
  const glideDbData = R.accuRows.map(r => 100 - r.eqPct);
  const glideDatasets = [
    { label: 'Equity %', data: glideEqData, borderColor: '#185FA5', backgroundColor: 'rgba(24,95,165,0.15)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 },
    { label: 'Debt %',   data: glideDbData, borderColor: '#EF9F27', backgroundColor: 'rgba(239,159,39,0.15)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 },
  ];

  const depAge = R.depletionAge;
  const surplus = R.surplus;
  const retYr = NOW + (p.retireAge - p.currentAge);

  return (
    <div className="plan-layout">
      {/* Left: sliders */}
      <div className="plan-panel">
        <div className="plan-panel-title">Assumptions</div>

        {mode === 'review' && goal.reviewCorpus != null ? (
          <div className="plan-corpus-lock">
            <div className="plan-corpus-label">Current corpus <span className="plan-badge">From review</span></div>
            <div className="plan-corpus-val">{INR(goal.reviewCorpus)}</div>
          </div>
        ) : (
          <div className="plan-corpus-lock">
            <div className="plan-corpus-label">Current corpus <span className="plan-badge plan-badge-manual">Manual input</span></div>
            <input className="plan-corpus-input" type="number" value={p.currentCorpus}
              onChange={e => set('currentCorpus', +e.target.value || 0)}
              placeholder="0" />
          </div>
        )}

        <div className="plan-divider" />
        <SliderRow label="Current age" value={p.currentAge} min={20} max={65} step={1} fmt={v => v + ' yrs'} onChange={v => set('currentAge', v)} />
        <SliderRow label="Retirement / FI age" value={p.retireAge} min={35} max={75} step={1} fmt={v => v + ' yrs'} onChange={v => set('retireAge', v)} />
        <SliderRow label="Life expectancy" value={p.lifeExp} min={70} max={100} step={1} fmt={v => v + ' yrs'} onChange={v => set('lifeExp', v)} />

        <div className="plan-divider" />
        <SliderRow label="Monthly SIP" value={p.monthlySip} min={0} max={500000} step={5000} fmt={v => INRFULL(v) + '/mo'} onChange={v => set('monthlySip', v)} />
        <SliderRow label="SIP step-up per year" value={p.sipStepup} min={0} max={25} step={1} fmt={v => v + '%'} onChange={v => set('sipStepup', v)} />
        <SliderRow label="Current yearly expenses" value={p.monthlyExpenses * 12} min={120000} max={6000000} step={60000} fmt={v => INR(v) + '/yr'} onChange={v => set('monthlyExpenses', v / 12)} />

        <div className="plan-divider" />
        <div className="plan-toggle-row">
          <span>Asset allocation</span>
          <label className="plan-toggle-label">
            <input type="checkbox" checked={p.useGlidePath} onChange={e => set('useGlidePath', e.target.checked)} />
            Auto glide path
          </label>
        </div>
        {!p.useGlidePath && (
          <SliderRow label="Pre-retirement return" value={p.preReturn} min={6} max={18} step={0.5} fmt={v => v + '%'} onChange={v => set('preReturn', v)} />
        )}
        <SliderRow label="Post-retirement return" value={p.postReturn} min={3} max={12} step={0.5} fmt={v => v + '%'} onChange={v => set('postReturn', v)} />
        <SliderRow label="Inflation" value={p.inflation} min={3} max={12} step={0.5} fmt={v => v + '%'} onChange={v => set('inflation', v)} />

        <div className="plan-divider" />
        <div className="plan-minsip-row">
          <span>Minimum SIP needed</span>
          <strong>{INRFULL(R.minSip)}/mo</strong>
        </div>
      </div>

      {/* Right: charts + table */}
      <div className="plan-right">
        <div className="plan-metrics">
          <MetricCard label="Corpus at retirement" value={INR(R.retireCorpus)} sub={`Age ${p.retireAge} · ${retYr}`} tone="info" />
          <MetricCard label="Required corpus" value={INR(R.reqCorpus)} sub={(surplus >= 0 ? '+' : '') + INR(surplus) + (surplus >= 0 ? ' surplus' : ' shortfall')} tone={surplus >= 0 ? 'ok' : 'bad'} />
          <MetricCard label="Money lasts until" value={depAge ? 'Age ' + depAge : 'Age ' + p.lifeExp + '+'} sub={depAge && depAge < p.lifeExp ? (p.lifeExp - depAge) + ' yrs short' : 'Full life covered'} tone={depAge && depAge < p.lifeExp ? 'warn' : 'ok'} />
        </div>

        <div className="plan-chart-card">
          <div className="plan-chart-title">Corpus over time — accumulation then drawdown</div>
          <div style={{ height: 220 }}>
            <LineChart id={'retire-' + goal.id} labels={allLabels} datasets={datasets} yFmt={INR} />
          </div>
        </div>

        <div className="plan-chart-card" style={{ marginTop: 12 }}>
          <div className="plan-chart-title">Glide path — equity vs debt allocation</div>
          <div style={{ height: 180 }}>
            <LineChart id={'glide-' + goal.id} labels={glideLabels} datasets={glideDatasets} yFmt={v => v + '%'} />
          </div>
        </div>

        <div className="plan-chart-card" style={{ marginTop: 12 }}>
          <div className="plan-chart-title">Key milestones</div>
          <table className="plan-tbl">
            <thead>
              <tr><th>Year</th><th>Age</th><th>Phase</th><th>Corpus</th><th>Withdrawal</th><th>Status</th></tr>
            </thead>
            <tbody>
              {(() => {
                const accuMilestones = R.accuRows.filter((_, i) => i === 0 || i === Math.round(R.accuRows.length * 0.5) || i === R.accuRows.length - 1);
                const drawMilestones = R.drawRows.filter((_, i) => i === 0 || i === Math.round(R.drawRows.length * 0.33) || i === Math.round(R.drawRows.length * 0.66) || i === R.drawRows.length - 1 || (R.depletionAge && R.drawRows[i].age === R.depletionAge));
                return [...accuMilestones, ...drawMilestones].map((r, i) => (
                  <tr key={i} className={r.year === retYr ? 'plan-tbl-hl' : ''}>
                    <td>{r.year}</td>
                    <td>{r.age}</td>
                    <td>{r.phase === 'withdrawal' ? 'Withdrawal' : 'Accumulation'}</td>
                    <td>{INR(r.corpus)}</td>
                    <td>{r.withdrawal ? INR(r.withdrawal) + '/yr' : '—'}</td>
                    <td className={r.corpus <= 0 ? 'plan-bad' : 'plan-ok'}>{r.corpus <= 0 ? '⚠ Depleted' : r.year === retYr ? 'Retire' : r.phase === 'withdrawal' ? 'Healthy' : 'On track'}</td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Accumulation goal panel
function GoalPanel({ goal, mode, color }) {
  const initialParams = mode === 'review' && goal.reviewCorpus != null
    ? { ...DEFAULT_GOAL, currentCorpus: goal.reviewCorpus }
    : { ...DEFAULT_GOAL };
  const [p, setP] = useState(initialParams);
  const R = calcGoal(p);

  useEffect(() => {
    if (mode === 'review' && goal.reviewCorpus != null) {
      setP(prev => ({ ...prev, currentCorpus: goal.reviewCorpus }));
    }
  }, [mode, goal.reviewCorpus]);

  const set = (k, v) => setP(prev => ({ ...prev, [k]: v }));

  const labels   = R.rows.map(r => r.year + '');
  const corpData = R.rows.map(r => r.corpus);
  const tgtData  = R.rows.map(() => Math.round(R.targetInflated));

  const datasets = [
    { label: 'Projected corpus', data: corpData, borderColor: color, backgroundColor: color + '20', tension: 0.4, pointRadius: 0, borderWidth: 2, fill: true },
    { label: 'Target (inflation-adj)', data: tgtData, borderColor: '#E24B4A', borderDash: [5, 3], pointRadius: 0, borderWidth: 1.5, fill: false },
  ];

  // Glide path chart
  const glideLabels   = R.rows.slice(0, -1).map(r => r.year + '');
  const glideEqData   = R.rows.slice(0, -1).map(r => r.eqPct);
  const glideDatasets = [
    { label: 'Equity %', data: glideEqData, borderColor: '#185FA5', backgroundColor: 'rgba(24,95,165,0.15)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 },
    { label: 'Debt %',   data: glideEqData.map(v => 100 - v), borderColor: '#EF9F27', backgroundColor: 'rgba(239,159,39,0.15)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 },
  ];

  const yearsLeft = p.goalYear - NOW;

  return (
    <div className="plan-layout">
      <div className="plan-panel">
        <div className="plan-panel-title">Assumptions</div>

        {mode === 'review' && goal.reviewCorpus != null ? (
          <div className="plan-corpus-lock">
            <div className="plan-corpus-label">Current corpus <span className="plan-badge">From review</span></div>
            <div className="plan-corpus-val">{INR(goal.reviewCorpus)}</div>
          </div>
        ) : (
          <div className="plan-corpus-lock">
            <div className="plan-corpus-label">Current corpus <span className="plan-badge plan-badge-manual">Manual input</span></div>
            <input className="plan-corpus-input" type="number" value={p.currentCorpus} onChange={e => set('currentCorpus', +e.target.value || 0)} placeholder="0" />
          </div>
        )}

        <div className="plan-divider" />
        <SliderRow label="Target amount (today's ₹)" value={p.targetToday} min={100000} max={20000000} step={100000} fmt={v => INR(v)} onChange={v => set('targetToday', v)} disabled={mode === 'review'} />
        <SliderRow label="Goal year" value={p.goalYear} min={NOW + 1} max={NOW + 30} step={1} fmt={v => v + ''} onChange={v => set('goalYear', v)} disabled={mode === 'review'} />

        <div className="plan-divider" />
        <SliderRow label="Monthly SIP" value={p.monthlySip} min={0} max={200000} step={1000} fmt={v => INRFULL(v) + '/mo'} onChange={v => set('monthlySip', v)} />
        <SliderRow label="SIP step-up per year" value={p.sipStepup} min={0} max={25} step={1} fmt={v => v + '%'} onChange={v => set('sipStepup', v)} />

        <div className="plan-divider" />
        <SliderRow label="Inflation" value={p.inflation} min={5} max={15} step={0.5} fmt={v => v + '%'} onChange={v => set('inflation', v)} />

        <div className="plan-divider" />
        <div className="plan-minsip-row">
          <span>Minimum SIP needed</span>
          <strong>{INRFULL(R.minSip)}/mo</strong>
        </div>
      </div>

      <div className="plan-right">
        <div className="plan-metrics">
          <MetricCard label="Projected corpus" value={INR(R.projectedCorpus)} sub={`${p.goalYear} · ${yearsLeft} yrs`} tone="info" />
          <MetricCard label="Target (inflation-adjusted)" value={INR(R.targetInflated)} sub={(R.surplus >= 0 ? '+' : '') + INR(R.surplus) + (R.surplus >= 0 ? ' surplus' : ' shortfall')} tone={R.surplus >= 0 ? 'ok' : 'bad'} />
          <MetricCard label="Min SIP to hit target" value={INRFULL(R.minSip) + '/mo'} sub={p.monthlySip >= R.minSip ? 'Current SIP is sufficient' : 'Need ₹' + Math.round(R.minSip - p.monthlySip).toLocaleString('en-IN') + '/mo more'} tone={p.monthlySip >= R.minSip ? 'ok' : 'warn'} />
        </div>

        <div className="plan-chart-card">
          <div className="plan-chart-title">Corpus growth toward target</div>
          <div style={{ height: 220 }}>
            <LineChart id={'goal-' + goal.id} labels={labels} datasets={datasets} yFmt={INR} />
          </div>
        </div>

        <div className="plan-chart-card" style={{ marginTop: 12 }}>
          <div className="plan-chart-title">Glide path — equity vs debt allocation</div>
          <div style={{ height: 180 }}>
            <LineChart id={'goalglide-' + goal.id} labels={glideLabels} datasets={glideDatasets} yFmt={v => v + '%'} />
          </div>
        </div>

        <div className="plan-chart-card" style={{ marginTop: 12 }}>
          <div className="plan-chart-title">Year-by-year projection</div>
          <table className="plan-tbl">
            <thead>
              <tr><th>Year</th><th>Corpus</th><th>Monthly SIP</th><th>Equity</th><th>Return</th></tr>
            </thead>
            <tbody>
              {R.rows.filter((_, i) => i % Math.max(1, Math.floor(R.rows.length / 8)) === 0 || i === R.rows.length - 1).map((r, i) => (
                <tr key={i} className={r.year === p.goalYear ? 'plan-tbl-hl' : ''}>
                  <td>{r.year}</td>
                  <td>{INR(r.corpus)}</td>
                  <td>{r.sip ? INRFULL(r.sip) : '—'}</td>
                  <td>{r.eqPct}%</td>
                  <td>{r.annReturn}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function PlanningPhase({ reviewGoals }) {
  const [mode, setMode] = useState('planning');
  const [activeGoal, setActiveGoal] = useState(0);
  const [goals, setGoals] = useState(() => {
    // Seed from review goals if available, else show defaults
    if (reviewGoals?.length > 0) {
      return reviewGoals.map((g, i) => ({
        id: g.id || String(i),
        name: g.name,
        color: COLORS[i % COLORS.length],
        type: isRetirement(g.name) ? 'retirement' : 'goal',
        reviewCorpus: g.funds?.reduce((s, f) => s + (f.curValue || 0), 0) +
          (g.stocksValue || 0) + (g.equityOther || 0),
      }));
    }
    return [
      { id: 'ret', name: 'Retirement / FI', color: COLORS[0], type: 'retirement', reviewCorpus: null },
      { id: 'edu', name: 'Education goal',  color: COLORS[1], type: 'goal',       reviewCorpus: null },
    ];
  });

  const addGoal = () => {
    const name = prompt('Goal name (e.g. Son UG College, House Purchase):');
    if (!name) return;
    const newGoal = {
      id: 'g' + Date.now(), name, reviewCorpus: null,
      color: COLORS[goals.length % COLORS.length],
      type: isRetirement(name) ? 'retirement' : 'goal',
    };
    setGoals(g => [...g, newGoal]);
    setActiveGoal(goals.length);
  };

  const g = goals[activeGoal];

  return (
    <div className="phase-container planning-phase">
      <div className="phase-hero">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2>Goal projections</h2>
            <p>
              {mode === 'planning'
                ? 'Interactive planning — adjust assumptions to find the right SIP for each goal.'
                : 'Review mode — current corpus is locked from the asset allocation review.'}
            </p>
          </div>
          <div className="plan-mode-toggle">
            <button className={`plan-mode-btn${mode === 'planning' ? ' on' : ''}`} onClick={() => setMode('planning')}>Initial planning</button>
            <button className={`plan-mode-btn${mode === 'review' ? ' on' : ''}`} onClick={() => setMode('review')}>Review</button>
          </div>
        </div>
      </div>

      {/* Goal tabs */}
      <div className="plan-goal-tabs">
        {goals.map((gl, i) => (
          <button key={gl.id} className={`plan-gtab${i === activeGoal ? ' on' : ''}`} onClick={() => setActiveGoal(i)}>
            <span className="plan-gdot" style={{ background: gl.color }} />
            {gl.name}
          </button>
        ))}
        <button className="plan-gtab plan-gtab-add" onClick={addGoal}>+ Add goal</button>
      </div>

      {/* Active goal content */}
      {g && g.type === 'retirement' && <RetirementPanel key={g.id + mode} goal={g} mode={mode} />}
      {g && g.type === 'goal'       && <GoalPanel       key={g.id + mode} goal={g} mode={mode} color={g.color} />}
    </div>
  );
}
