import { useState, useCallback } from 'react';
import { BUCKETS } from '../utils/categoryMap';
import { saveUserCorrection } from '../utils/cache';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay, useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';

const EQUITY_BUCKETS = [BUCKETS.LARGE, BUCKETS.MID, BUCKETS.SMALL];
const ALL_BUCKETS = [...EQUITY_BUCKETS, BUCKETS.DEBT];
const INR = v => `₹${Math.round(v).toLocaleString('en-IN')}`;
const isRetirement = name => /retirement|financial independence|FI\b/i.test(name);

function FundCard({ fund, goalId, isDragging }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `${goalId}__${fund.schemeName}`, data: { fund, goalId },
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)`, opacity: isDragging ? 0.4 : 1 }
    : {};
  return (
    <div ref={setNodeRef} style={style} className="draggable-fund-card" {...listeners} {...attributes}>
      <div className="dfc-body">
        <span className="dfc-name">{fund.schemeName}</span>
        {fund.account && fund.account !== 'Main' && (
          <span className="dfc-account">{fund.account}</span>
        )}
      </div>
      <span className="dfc-value">{INR(fund.curValue)}</span>
      <span className="drag-handle">⠿</span>
    </div>
  );
}

function BucketColumn({ bucket, funds, goalId, activeId }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${goalId}__${bucket}` });
  const total = funds.reduce((s, f) => s + f.curValue, 0);
  const COLOR = { [BUCKETS.LARGE]:'bucket-large', [BUCKETS.MID]:'bucket-mid', [BUCKETS.SMALL]:'bucket-small', [BUCKETS.DEBT]:'bucket-debt' };
  return (
    <div className={`bucket-col ${COLOR[bucket]} ${isOver ? 'drop-over' : ''}`}>
      <div className="bucket-header">
        <span className="bucket-name">{bucket}</span>
        <span className="bucket-total">{INR(total)}</span>
      </div>
      <div ref={setNodeRef} className="bucket-drop-zone">
        {funds.length === 0 && <div className="empty-bucket">Drop funds here</div>}
        {funds.map(f => <FundCard key={f.schemeName} fund={f} goalId={goalId} isDragging={activeId === `${goalId}__${f.schemeName}`} />)}
      </div>
    </div>
  );
}

function GoalConfirm({ goal, onChange, holdingMap }) {
  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const retirement = isRetirement(goal.name);

  const equityMFTotal = goal.funds.filter(f => EQUITY_BUCKETS.includes(f.bucket)).reduce((s,f)=>s+f.curValue,0);
  const stocksValue   = goal.stocksValue || 0;
  const equityOther   = goal.equityOther || 0;
  const equityTotal   = equityMFTotal + stocksValue + equityOther;
  const debtMFTotal   = goal.funds.filter(f => f.bucket === BUCKETS.DEBT).reduce((s,f)=>s+f.curValue,0);
  const debtExtras    = retirement
    ? (goal.epf||0)+(goal.wifeEpf||0)+(goal.ppf||0)+(goal.wifePpf||0)+(goal.nsc||0)+(goal.debtOther||0)
    : (goal.debtOther||0);
  const corpusTotal   = equityTotal + debtMFTotal + debtExtras;

  const [lastSaved, setLastSaved] = useState('');

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over) return;
    const fundName = active.data.current.fund.schemeName;
    const destBucket = over.id.split('__').slice(1).join('__');
    const srcBucket = goal.funds.find(f => f.schemeName === fundName)?.bucket;
    if (srcBucket === destBucket) return;
    // Persist correction to cache so it's used in all future reviews
    saveUserCorrection(fundName, destBucket);
    setLastSaved(`"${fundName.split(' ').slice(0,3).join(' ')}…" saved as ${destBucket}`);
    setTimeout(() => setLastSaved(''), 3000);
    onChange({ ...goal, funds: goal.funds.map(f => f.schemeName === fundName ? { ...f, bucket: destBucket } : f) });
  };
  const set = (field, val) => onChange({ ...goal, [field]: parseFloat(val) || 0 });

  return (
    <div className="goal-review-section">
      <h3 className="goal-review-title">{goal.name}</h3>

      {lastSaved && (
        <div className="drag-saved-toast">✓ Saved to database: {lastSaved}</div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragStart={e => setActiveId(e.active.id)} onDragEnd={handleDragEnd}>
        <div className="buckets-row">
          {ALL_BUCKETS.map(bucket => (
            <BucketColumn key={bucket} bucket={bucket} goalId={goal.id}
              funds={goal.funds.filter(f => f.bucket === bucket)} activeId={activeId} />
          ))}
        </div>
        <DragOverlay>
          {activeId ? (() => {
            const name = activeId.split('__').slice(1).join('__');
            const fund = goal.funds.find(f => f.schemeName === name);
            return fund ? <div className="draggable-fund-card dragging">{fund.schemeName}</div> : null;
          })() : null}
        </DragOverlay>
      </DndContext>

      <div className="extras-grid">
        {/* Equity Other */}
        <div className="extras-section">
          <div className="extras-section-title equity-title">Equity (Other)</div>
          <div className="extras-row">
            <label>Direct Stocks (₹)</label>
            <input type="number" value={goal.stocksValue || ''} onChange={e => set('stocksValue', e.target.value)} placeholder="0" />
          </div>
          <div className="extras-row">
            <label>Other (₹)</label>
            <input type="number" value={goal.equityOther || ''} onChange={e => set('equityOther', e.target.value)} placeholder="e.g. MFs outside Fin & Me" />
          </div>
        </div>

        {/* Debt Other — detailed for Retirement, simple for others */}
        <div className="extras-section">
          <div className="extras-section-title debt-title">Debt (Other)</div>
          {retirement ? (
            <>
              {[['epf','Client EPF (₹)'],['wifeEpf','Spouse EPF (₹)'],['ppf','Client PPF (₹)'],['wifePpf','Spouse PPF (₹)'],['nsc','NSC (₹)'],['debtOther','Other (₹)']].map(([field, label]) => (
                <div key={field} className="extras-row">
                  <label>{label}</label>
                  <input type="number" value={goal[field] || ''} onChange={e => set(field, e.target.value)} placeholder="0" />
                </div>
              ))}
            </>
          ) : (
            <div className="extras-row">
              <label>Other (₹)</label>
              <input type="number" value={goal.debtOther || ''} onChange={e => set('debtOther', e.target.value)} placeholder="e.g. SSY, RD, FD, PPF" />
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="goal-summary">
        <div className="summary-row"><span>Equity Total</span><strong>{INR(equityTotal)}</strong></div>
        <div className="summary-row"><span>Debt Total</span><strong>{INR(debtMFTotal + debtExtras)}</strong></div>
        <div className="summary-row total"><span>Corpus Total</span><strong>{INR(corpusTotal)}</strong></div>
        {corpusTotal > 0 && (
          <div className="equity-split">
            <div className="split-header">Asset Allocation</div>
            <div className="split-row asset-split"><span>Equity</span><span>{((equityTotal/corpusTotal)*100).toFixed(1)}%</span></div>
            <div className="split-row asset-split"><span>Debt</span><span>{(((debtMFTotal+debtExtras)/corpusTotal)*100).toFixed(1)}%</span></div>
            {equityMFTotal > 0 && <>
              <div className="split-header" style={{marginTop:'8px'}}>Market Cap Split</div>
              {EQUITY_BUCKETS.map(b => {
                const v = goal.funds.filter(f=>f.bucket===b).reduce((s,f)=>s+f.curValue,0);
                return v > 0 ? <div key={b} className="split-row"><span>{b}</span><span>{((v/equityMFTotal)*100).toFixed(1)}%</span></div> : null;
              })}
            </>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReviewPhase({ reviewGoals, portfolio, onDone }) {
  const [goals, setGoals] = useState(reviewGoals);
  const updateGoal = useCallback((idx, updated) => setGoals(gs => gs.map((g,i) => i===idx ? updated : g)), []);
  return (
    <div className="phase-container review-phase">
      <div className="phase-hero">
        <h2>Confirm Allocations</h2>
        <p>Drag funds between buckets to correct misclassifications. Add any additional holdings below each goal.</p>
      </div>
      {goals.map((goal, idx) => <GoalConfirm key={goal.id} goal={goal} onChange={u => updateGoal(idx, u)} />)}
      <div className="phase-footer">
        <button className="btn-primary btn-large" onClick={() => onDone(goals)}>Review & Export →</button>
      </div>
    </div>
  );
}
