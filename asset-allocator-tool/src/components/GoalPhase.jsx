import { useState, useCallback } from 'react';
import { parseInvestmentPlan, matchPlanToHoldings } from '../utils/parseInvestmentPlan';

const INR = v => `₹${Math.round(v).toLocaleString('en-IN')}`;
const SUGGESTED_GOALS = ['Retirement / FI', 'Son Education', 'Daughter Education', 'Son Wedding', 'Daughter Wedding', 'House Purchase', 'Emergency Fund'];

export default function GoalPhase({ portfolio, onDone }) {
  const [goals, setGoals] = useState([{ id: 1, name: 'Retirement / FI', fundKeys: [] }]);
  const [newGoalName, setNewGoalName] = useState('');
  const [unassigned, setUnassigned] = useState(portfolio.holdings.map(h => h.holdingKey));
  const [planLoading, setPlanLoading] = useState(false);
  const [planStatus, setPlanStatus] = useState('');
  const [planWarnings, setPlanWarnings] = useState([]);

  // holdingMap keyed by holdingKey
  const holdingMap = {};
  portfolio.holdings.forEach(h => { holdingMap[h.holdingKey] = h; });

  const handlePlanUpload = useCallback(async (file) => {
    if (!file) return;
    setPlanLoading(true); setPlanStatus(''); setPlanWarnings([]);
    try {
      const buf = await file.arrayBuffer();
      const planGoals = parseInvestmentPlan(buf);
      if (!planGoals.length) {
        setPlanStatus('error');
        setPlanWarnings(['Could not find any goals in the uploaded file. Please assign manually.']);
        setPlanLoading(false); return;
      }
      // matchPlanToHoldings now returns holdingKeys
      const matched = matchPlanToHoldings(planGoals, portfolio.holdings);

      const newGoals = matched
        .filter(g => g.fundKeys.length > 0)
        .map((g, i) => ({ id: Date.now() + i, name: g.goalName, fundKeys: g.fundKeys }));

      const allAssigned = new Set(newGoals.flatMap(g => g.fundKeys));
      const stillUnassigned = portfolio.holdings.map(h => h.holdingKey).filter(k => !allAssigned.has(k));

      const warnings = [];
      for (const pg of planGoals) {
        const mg = matched.find(m => m.goalName === pg.goalName);
        if (mg && mg.fundKeys.length < pg.fundNames.length) {
          warnings.push(`"${pg.goalName}": matched ${mg.fundKeys.length}/${pg.fundNames.length} funds from plan`);
        }
      }
      if (stillUnassigned.length > 0) {
        const names = stillUnassigned.slice(0, 3).map(k => holdingMap[k]?.schemeName || k);
        warnings.push(`${stillUnassigned.length} fund(s) not in plan — assign manually: ${names.join(', ')}${stillUnassigned.length > 3 ? '…' : ''}`);
      }

      setGoals(newGoals.length > 0 ? newGoals : [{ id: 1, name: 'Retirement / FI', fundKeys: [] }]);
      setUnassigned(stillUnassigned);
      setPlanWarnings(warnings);
      setPlanStatus(newGoals.length > 0 ? 'success' : 'error');
    } catch (e) {
      setPlanWarnings([`Parse error: ${e.message}`]);
      setPlanStatus('error');
    }
    setPlanLoading(false);
  }, [portfolio]);

  const addGoal = () => {
    const name = newGoalName.trim();
    if (!name) return;
    setGoals(g => [...g, { id: Date.now(), name, fundKeys: [] }]);
    setNewGoalName('');
  };

  const removeGoal = (id) => {
    const goal = goals.find(g => g.id === id);
    if (goal) setUnassigned(u => [...u, ...goal.fundKeys]);
    setGoals(g => g.filter(g2 => g2.id !== id));
  };

  const assignFund = (key, goalId) => {
    setUnassigned(u => u.filter(k => k !== key));
    setGoals(gs => gs.map(g => g.id === goalId ? { ...g, fundKeys: [...g.fundKeys, key] } : g));
  };

  const unassignFund = (key, goalId) => {
    setGoals(gs => gs.map(g => g.id === goalId ? { ...g, fundKeys: g.fundKeys.filter(k => k !== key) } : g));
    setUnassigned(u => [...u, key]);
  };

  const assignAll = (goalId) => {
    if (!unassigned.length) return;
    setGoals(gs => gs.map(g => g.id === goalId ? { ...g, fundKeys: [...g.fundKeys, ...unassigned] } : g));
    setUnassigned([]);
  };

  const canProceed = unassigned.length === 0 && goals.length > 0;

  const FundLabel = ({ holdingKey }) => {
    const h = holdingMap[holdingKey] || {};
    return (
      <span className="fund-label">
        <span className="fund-name">{h.schemeName || holdingKey}</span>
        {h.account && <span className="fund-account-tag">{h.account}</span>}
      </span>
    );
  };

  return (
    <div className="phase-container goal-phase">
      <div className="phase-hero">
        <h2>Assign Funds to Goals</h2>
        <p><strong>{portfolio.clientName}</strong> · {portfolio.holdings.length} holdings · {portfolio.reportDate}</p>
        {unassigned.length > 0 && <div className="badge badge-warn">{unassigned.length} funds unassigned</div>}
      </div>

      <div className="plan-import-box">
        <div className="plan-import-header">
          <div>
            <h3>Auto-assign from Investment Plan</h3>
            <p>Upload the client's Investment Review .xlsx — goals and fund assignments will be detected automatically.</p>
          </div>
          <label className={`btn-plan-upload ${planLoading ? 'loading' : ''}`}>
            {planLoading ? 'Reading…' : '📋 Upload Investment Plan'}
            <input type="file" accept=".xlsx" style={{ display: 'none' }}
              onChange={e => handlePlanUpload(e.target.files[0])} />
          </label>
        </div>
        {planStatus === 'success' && <div className="plan-status success">✓ Goals auto-assigned. Review and adjust below.</div>}
        {planWarnings.map((w, i) => <div key={i} className="plan-status warn">⚠ {w}</div>)}
      </div>

      <div className="goal-layout">
        <div className="unassigned-panel">
          <h3>Unassigned Funds <span className="count">{unassigned.length}</span></h3>
          {unassigned.length === 0 ? <div className="empty-state">All funds assigned ✓</div> : (
            unassigned.map(key => (
              <div key={key} className="fund-card unassigned-card">
                <FundLabel holdingKey={key} />
                <div className="fund-value">{INR(holdingMap[key]?.curValue || 0)}</div>
                <div className="fund-actions">
                  {goals.map(g => (
                    <button key={g.id} className="btn-assign" onClick={() => assignFund(key, g.id)}>
                      → {g.name.split(' ').slice(0, 2).join(' ')}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="goals-panel">
          <div className="goals-header-row">
            <h3>Goals</h3>
            <div className="add-goal-row">
              <select value={newGoalName} onChange={e => setNewGoalName(e.target.value)}>
                <option value="">Choose…</option>
                {SUGGESTED_GOALS.filter(s => !goals.find(g => g.name === s)).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input placeholder="Custom goal name" value={newGoalName}
                onChange={e => setNewGoalName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addGoal()} />
              <button className="btn-primary" onClick={addGoal}>+ Add</button>
            </div>
          </div>

          {goals.map(goal => (
            <div key={goal.id} className="goal-card">
              <div className="goal-card-header">
                <span className="goal-name">{goal.name}</span>
                <div className="goal-header-actions">
                  <button className="btn-sm" onClick={() => assignAll(goal.id)} disabled={!unassigned.length}>Assign all remaining</button>
                  <button className="btn-danger-sm" onClick={() => removeGoal(goal.id)}>✕</button>
                </div>
              </div>
              <div className="goal-total">
                {goal.fundKeys.length} funds · {INR(goal.fundKeys.reduce((s, k) => s + (holdingMap[k]?.curValue || 0), 0))}
              </div>
              <div className="goal-funds">
                {goal.fundKeys.length === 0 ? <div className="empty-state small">No funds assigned yet</div> : (
                  goal.fundKeys.map(key => (
                    <div key={key} className="fund-chip">
                      <FundLabel holdingKey={key} />
                      <span className="chip-value">{INR(holdingMap[key]?.curValue || 0)}</span>
                      <button className="chip-remove" onClick={() => unassignFund(key, goal.id)}>✕</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="phase-footer">
        <button className="btn-primary btn-large" disabled={!canProceed} onClick={() => onDone(goals)}>
          {canProceed ? 'Categorise Funds →' : `Assign all funds first (${unassigned.length} left)`}
        </button>
      </div>
    </div>
  );
}
