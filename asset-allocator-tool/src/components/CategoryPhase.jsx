import { useState, useEffect } from 'react';
import { BUCKETS } from '../utils/categoryMap';
import { exportCache, importCache } from '../utils/cache';

const BUCKET_LIST = [BUCKETS.LARGE, BUCKETS.MID, BUCKETS.SMALL, BUCKETS.DEBT];
const INR = v => `₹${Math.round(v).toLocaleString('en-IN')}`;

// ── Persistent Category Editor ──────────────────────────────────────────────
// Shows all schemes currently saved in localStorage cache; user can edit them.
function CategoryEditor({ onClose }) {
  const [entries, setEntries] = useState([]);
  const [filter, setFilter] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('fnm_scheme_cache_v2');
      const cache = raw ? JSON.parse(raw) : {};
      const list = Object.entries(cache).map(([normKey, data]) => ({
        normKey,
        displayName: data.displayName || normKey,
        bucket: data.bucket || '',
        userOverride: data.userOverride || false,
      }));
      list.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setEntries(list);
    } catch { setEntries([]); }
  }, []);

  const updateBucket = (normKey, bucket) => {
    setEntries(es => es.map(e => e.normKey === normKey ? { ...e, bucket } : e));
    setSaved(false);
  };

  const saveAll = () => {
    try {
      const raw = localStorage.getItem('fnm_scheme_cache_v2');
      const cache = raw ? JSON.parse(raw) : {};
      for (const e of entries) {
        if (cache[e.normKey]) cache[e.normKey] = { ...cache[e.normKey], bucket: e.bucket, userOverride: true };
      }
      localStorage.setItem('fnm_scheme_cache_v2', JSON.stringify(cache));
      setSaved(true);
    } catch {}
  };

  const exportJSON = () => {
    const blob = new Blob([exportCache()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'fnm_scheme_cache.json'; a.click();
  };

  const importJSON = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => { if (importCache(r.result)) { onClose(); } };
    r.readAsText(file);
  };

  const filtered = entries.filter(e =>
    !filter || e.displayName.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="cat-editor-overlay">
      <div className="cat-editor-modal">
        <div className="cat-editor-header">
          <h3>Scheme Category Editor</h3>
          <p>Edit how any fund is classified. Changes are saved to your browser cache and apply to all future reviews.</p>
          <button className="cat-editor-close" onClick={onClose}>✕</button>
        </div>

        <div className="cat-editor-toolbar">
          <input className="cat-editor-search" placeholder="Search scheme name…"
            value={filter} onChange={e => setFilter(e.target.value)} />
          <div className="cat-editor-actions">
            <button className="btn-sm" onClick={exportJSON}>⬇ Export cache</button>
            <label className="btn-sm" style={{cursor:'pointer'}}>
              ⬆ Import cache
              <input type="file" accept=".json" style={{display:'none'}}
                onChange={e => importJSON(e.target.files[0])} />
            </label>
            <button className="btn-primary" onClick={saveAll}>
              {saved ? '✓ Saved' : 'Save changes'}
            </button>
          </div>
        </div>

        <div className="cat-editor-legend">
          <span>How classification works:</span>
          <ol>
            <li>First checks browser cache (your previous corrections live here)</li>
            <li>Fuzzy-matches against 14,367 AMFI schemes from the bundled database</li>
            <li>Falls back to mfapi.in API for any fund not in the database</li>
          </ol>
        </div>

        <div className="cat-editor-table">
          <div className="cat-editor-thead">
            <span>Scheme Name</span><span>Current Category</span><span>Override</span>
          </div>
          {filtered.length === 0 && <div className="empty-state" style={{padding:'24px'}}>No cached schemes yet. Run a review first.</div>}
          {filtered.map(e => (
            <div key={e.normKey} className={`cat-editor-row ${e.userOverride ? 'user-override' : ''}`}>
              <span className="cat-editor-name" title={e.normKey}>{e.displayName}</span>
              <span className="cat-editor-current">{e.bucket || '—'}</span>
              <select className="cat-select" value={e.bucket}
                onChange={ev => updateBucket(e.normKey, ev.target.value)}>
                <option value="">— Unknown —</option>
                {BUCKET_LIST.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main CategoryPhase ───────────────────────────────────────────────────────
export default function CategoryPhase({ goals, portfolio, categories, progress, onDone }) {
  const [localCats, setLocalCats] = useState({});
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => { setLocalCats(categories); }, [categories]);

  // Categorisation is by SCHEME NAME (account-independent property)
  const holdingMap = {};
  portfolio.holdings.forEach(h => { holdingMap[h.holdingKey] = h; });
  const allNames = [...new Set(
    goals.flatMap(g => g.fundKeys).map(key => holdingMap[key]?.schemeName).filter(Boolean)
  )];
  const isLoading = progress.done < progress.total;

  return (
    <div className="phase-container cat-phase">
      {showEditor && <CategoryEditor onClose={() => setShowEditor(false)} />}

      <div className="phase-hero">
        <div className="phase-hero-row">
          <div>
            <h2>Fund Categorisation</h2>
            <p>Verify each fund's category. Corrections are saved automatically for future reviews.</p>
          </div>
          <button className="btn-sm btn-editor" onClick={() => setShowEditor(true)}>
            ✏ Edit Saved Categories
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="progress-bar-wrap">
          <div className="progress-label">Looking up {progress.done} / {progress.total} funds…</div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="cat-table">
        <div className="cat-table-header">
          <span>Fund Name</span><span>Value</span><span>Category</span>
        </div>
        {allNames.map(name => {
          // Sum values across all accounts for this scheme name (display only)
          const totalValue = portfolio.holdings
            .filter(h => h.schemeName === name)
            .reduce((s, h) => s + h.curValue, 0);
          return (
          <div key={name} className="cat-row">
            <span className="cat-name">{name}</span>
            <span className="cat-value">{INR(totalValue)}</span>
            <select
              className={`cat-select ${localCats[name] ? 'cat-assigned' : 'cat-unknown'}`}
              value={localCats[name] || ''}
              onChange={e => setLocalCats(c => ({ ...c, [name]: e.target.value }))}>
              <option value="">— Unknown —</option>
              {BUCKET_LIST.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        );
        })}
      </div>

      <div className="phase-footer">
        <button className="btn-primary btn-large"
          disabled={isLoading || allNames.some(n => !localCats[n])}
          onClick={() => onDone(localCats)}>
          {isLoading ? `Resolving… ${progress.done}/${progress.total}`
            : allNames.some(n => !localCats[n]) ? 'Please assign all categories'
            : 'Confirm & Continue →'}
        </button>
      </div>
    </div>
  );
}
