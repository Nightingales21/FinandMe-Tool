import { useCallback, useState } from 'react';
import { parsePortfolioFile, mergePortfolios } from '../utils/parsePortfolio';

const INR = v => `₹${Math.round(v).toLocaleString('en-IN')}`;

export default function UploadPhase({ onUpload }) {
  const [files, setFiles] = useState([]);      // [{ name, portfolio }]
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const processFiles = useCallback(async (newFiles) => {
    if (!newFiles?.length) return;
    const invalid = [...newFiles].find(f => !f.name.endsWith('.xlsx'));
    if (invalid) { setError('All files must be .xlsx format.'); return; }

    setLoading(true); setError('');
    try {
      const parsed = await Promise.all([...newFiles].map(async f => {
        const buf = await f.arrayBuffer();
        const portfolio = parsePortfolioFile(buf, f.name);
        return { name: f.name, portfolio };
      }));

      const errors = parsed.flatMap(p => p.portfolio.parseErrors || []);
      if (errors.length) { setError(errors.join('; ')); setLoading(false); return; }

      setFiles(prev => {
        // Deduplicate by filename
        const existing = prev.map(p => p.name);
        const added = parsed.filter(p => !existing.includes(p.name));
        return [...prev, ...added];
      });
    } catch (e) { setError(`Failed to parse: ${e.message}`); }
    setLoading(false);
  }, []);

  const removeFile = (name) => setFiles(f => f.filter(x => x.name !== name));

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleProceed = () => {
    const merged = mergePortfolios(files.map(f => f.portfolio));
    onUpload(merged);
  };

  const totalHoldings = files.length > 0
    ? mergePortfolios(files.map(f => f.portfolio))?.holdings?.length || 0
    : 0;
  const totalValue = files.length > 0
    ? mergePortfolios(files.map(f => f.portfolio))?.holdings?.reduce((s,h)=>s+h.curValue,0) || 0
    : 0;

  return (
    <div className="phase-container upload-phase">
      <div className="phase-hero">
        <h2>Upload Live Portfolio</h2>
        <p>Upload your client portfolio file(s) to get started.</p>
      </div>

      {/* Drop zone */}
      <div
        className={`drop-zone ${dragging ? 'drag-over' : ''} ${loading ? 'loading' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById('file-input').click()}
      >
        <input id="file-input" type="file" accept=".xlsx" multiple
          style={{ display: 'none' }}
          onChange={e => processFiles(e.target.files)} />
        {loading ? (
          <div className="drop-zone-inner"><div className="spinner" /><p>Parsing portfolio…</p></div>
        ) : (
          <div className="drop-zone-inner">
            <div className="upload-icon">⬆</div>
            <p className="drop-label">Drop .xlsx file(s) here or click to browse</p>
          </div>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Loaded files summary */}
      {files.length > 0 && (
        <div className="loaded-files">
          <div className="loaded-files-header">
            <h3>Loaded Portfolios</h3>
            <span className="loaded-summary">{totalHoldings} unique funds · {INR(totalValue)}</span>
          </div>

          {files.map(({ name, portfolio }) => (
            <div key={name} className="loaded-file-card">
              <div className="lf-left">
                <div className="lf-filename">📄 {name}</div>
                <div className="lf-accounts">
                  {portfolio.accounts.map(acc => (
                    <div key={acc.label} className="lf-account">
                      <span className="lf-account-label">{acc.label}</span>
                      <span className="lf-account-count">{acc.holdings.length} funds</span>
                      <span className="lf-account-value">{INR(acc.holdings.reduce((s,h)=>s+h.curValue,0))}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lf-right">
                <div className="lf-client">{portfolio.clientName}</div>
                <div className="lf-date">{portfolio.reportDate}</div>
                <button className="btn-danger-sm" onClick={() => removeFile(name)}>Remove</button>
              </div>
            </div>
          ))}

          {files.length > 1 && (
            <div className="merge-notice">
              <span>🔗</span>
              <span>Funds held in the same scheme across multiple files will be aggregated. Account labels are preserved for reference.</span>
            </div>
          )}
        </div>
      )}

      <div className="phase-footer">
        <button className="btn-primary btn-large" disabled={files.length === 0} onClick={handleProceed}>
          {files.length === 0 ? 'Upload at least one portfolio file' : `Continue with ${totalHoldings} funds →`}
        </button>
      </div>
    </div>
  );
}
