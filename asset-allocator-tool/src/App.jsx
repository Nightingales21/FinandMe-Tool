import { useState, useEffect, useCallback } from 'react';
import { parsePortfolioFile, mergePortfolios } from './utils/parsePortfolio';
import { initCache, resolveCategory, saveUserCorrection } from './utils/cache';
import { BUCKETS } from './utils/categoryMap';
import { generateReviewXlsx, downloadBuffer } from './utils/exportXlsx';
import UploadPhase from './components/UploadPhase';
import GoalPhase from './components/GoalPhase';
import CategoryPhase from './components/CategoryPhase';
import ReviewPhase from './components/ReviewPhase';
import ExportPhase from './components/ExportPhase';
import PlanningPhase from './components/PlanningPhase';
import './App.css';

const PHASES = ['Home', 'Upload', 'Goals', 'Categorise', 'Confirm', 'Review', 'Plan'];

export default function App() {
  const [phase, setPhase] = useState(0);
  const [cacheReady, setCacheReady] = useState(false);

  const [portfolio, setPortfolio] = useState(null);
  const [goals, setGoals] = useState([]);
  // categories keyed by SCHEME NAME (not holdingKey) — the bucket is a property of the fund, not the holding
  const [categories, setCategories] = useState({});
  const [catProgress, setCatProgress] = useState({ done: 0, total: 0 });
  const [reviewGoals, setReviewGoals] = useState([]);

  useEffect(() => { initCache().then(() => setCacheReady(true)); }, []);

  const handleUpload = useCallback((parsedPortfolio) => {
    setPortfolio(parsedPortfolio);
    setGoals([]);
    setPhase(2); // move to Goals
  }, []);

  // Phase 2→3: goals now contain holdingKeys, not raw scheme names
  const handleGoalsSet = useCallback(async (newGoals) => {
    setGoals(newGoals);
    setPhase(3); // move to Categorise

    // Resolve categories by SCHEME NAME (fund property, account-independent)
    const allHoldingKeys = [...new Set(newGoals.flatMap(g => g.fundKeys))];
    // Build a map holdingKey → schemeName for lookup
    const holdingMap = {};
    portfolio.holdings.forEach(h => { holdingMap[h.holdingKey] = h; });

    const uniqueSchemeNames = [...new Set(allHoldingKeys.map(k => holdingMap[k]?.schemeName).filter(Boolean))];
    setCatProgress({ done: 0, total: uniqueSchemeNames.length });

    const results = {};
    for (let i = 0; i < uniqueSchemeNames.length; i += 5) {
      const batch = uniqueSchemeNames.slice(i, i + 5);
      await Promise.all(batch.map(async name => {
        const data = await resolveCategory(name);
        results[name] = data?.bucket || BUCKETS.LARGE;
        setCatProgress(p => ({ ...p, done: p.done + 1 }));
      }));
    }
    setCategories(results);
  }, [portfolio]);

  // Phase 3→4
  const handleCategoriesConfirmed = useCallback((updatedCats) => {
    Object.entries(updatedCats).forEach(([name, bucket]) => {
      if (bucket !== categories[name]) saveUserCorrection(name, bucket);
    });
    setCategories(updatedCats);

    // holdingMap keyed by holdingKey
    const holdingMap = {};
    portfolio.holdings.forEach(h => { holdingMap[h.holdingKey] = h; });

    const built = goals.map(g => ({
      ...g,
      // Each fund item carries holdingKey, schemeName, account, curValue, bucket
      funds: g.fundKeys.map(key => {
        const h = holdingMap[key] || {};
        return {
          holdingKey: key,
          schemeName: h.schemeName || key,
          account: h.account || '',
          curValue: h.curValue || 0,
          bucket: updatedCats[h.schemeName] || BUCKETS.LARGE,
        };
      }),
      stocksValue: 0, equityOther: 0,
      epf: 0, wifeEpf: 0, ppf: 0, wifePpf: 0, nsc: 0, debtOther: 0,
    }));
    setReviewGoals(built);
    setPhase(4); // move to Confirm
  }, [goals, portfolio, categories]);

  const handleReviewDone = useCallback((finalGoals) => {
    setReviewGoals(finalGoals);
    setPhase(5); // move to Review/Export
  }, []);

  const handleExport = useCallback(async (chartImages) => {
    const buf = await generateReviewXlsx({
      clientName: portfolio.clientName,
      reportDate: portfolio.reportDate,
      goals: reviewGoals,
      portfolioHoldings: portfolio.holdings,
      chartImages,
    });
    const safeDate = portfolio.reportDate.replace(/\//g, '-');
    downloadBuffer(buf, `${portfolio.clientName}-Asset-Allocation-Review-${safeDate}.xlsx`);
  }, [portfolio, reviewGoals]);

  if (!cacheReady) {
    return <div className="loading-screen"><div className="spinner" /><p>Loading scheme database…</p></div>;
  }

  function HomeLanding() {
    return (
      <div className="phase-container home-landing">
        <div className="phase-hero">
          <h2>Get started</h2>
          <p>Choose how you'd like to begin: start with initial planning, or review an existing portfolio.</p>
        </div>
        <div className="home-actions">
          <button className="btn-primary btn-large" onClick={() => setPhase(6)}>Initial Planning</button>
          <button className="btn-outline btn-large" onClick={() => setPhase(1)}>Review from portfolio</button>
        </div>
        <div style={{ marginTop: 18 }}>
          <small>Tip: clients can submit a short intake form (Google Forms or the attached HTML). Export the responses as JSON and import here using the Import button on the Review screen.</small>
        </div>
      </div>
    );
  }

  const LOGO = 'data:image/png;base64,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';

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <img src={LOGO} alt="Fin and Me" className="brand-logo" />
          <div>
            <h1>Asset Allocation Review Tool</h1>
            <p>Fin and Me Wealth Partners</p>
          </div>
        </div>
        <nav className="phase-nav">
          {PHASES.map((name, i) => (
            <button key={name}
              className={`phase-tab ${i === phase ? 'active' : ''} ${i < phase ? 'done' : ''}`}
              onClick={() => (i < phase || i === phase + 1) && setPhase(i)}>
              <span className="phase-num">{i + 1}</span>
              <span className="phase-label">{name}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="app-main">
        {phase === 0 && <HomeLanding />}
        {phase === 1 && <UploadPhase onUpload={handleUpload} />}
        {phase === 2 && portfolio && <GoalPhase portfolio={portfolio} onDone={handleGoalsSet} />}
        {phase === 3 && (
          <CategoryPhase goals={goals} portfolio={portfolio}
            categories={categories} progress={catProgress} onDone={handleCategoriesConfirmed} />
        )}
        {phase === 4 && (
          <ReviewPhase reviewGoals={reviewGoals} portfolio={portfolio} onDone={handleReviewDone} />
        )}
        {phase === 5 && (
          <ExportPhase reviewGoals={reviewGoals} portfolio={portfolio} onExport={handleExport} />
        )}
        {phase === 6 && (
          <PlanningPhase reviewGoals={reviewGoals} />
        )}
      </main>
    </div>
  );
}
