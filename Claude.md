# Fin & Me — Asset Allocation Review Tool
## Project Log & Documentation

**Company:** Fin & Me Wealth Partners  
**Project started:** May/June 2026  
**Built by:** Claude (Anthropic) in collaboration with the Fin & Me intern  
**Current version:** Phase 2 in progress (Planning Tool integrated)

---

## 1. Project Overview

The goal of this project is to build an internal tool for Fin & Me wealth advisors to:

1. Automate the **Asset Allocation Review** — currently done manually in Excel
2. Present **goal-based projections** visually to clients during review meetings
3. Support **initial financial planning** with live, interactive charts

The tool is delivered as a **single self-contained `.html` file** — no installation, no server, no dependencies. Any analyst double-clicks it and it opens in Chrome/Edge.

---

## 2. Key Design Decisions & Preferences

### Deployment
- **Single HTML file** — everything bundled in (React, Chart.js, all 14,367 AMFI schemes)
- Works fully **offline** — mfapi.in API only called as a last resort for unknown funds
- **No backend, no database** — browser localStorage for the scheme category cache
- File size: ~3.7MB

### Fund Category Cache
- **Two-tier system:**
  - **Tier 1 — Bundled seed** (`schemeSeed.js`): 14,367 AMFI schemes parsed from the provided `.txt` file. Read-only, baked into the HTML.
  - **Tier 2 — User cache** (`localStorage`, key: `fnm_scheme_cache_v2`): corrections and API lookups saved per browser session
- **Corrections are permanent per browser** — drag-and-drop corrections in Step 4 write back to localStorage immediately
- **To share corrections across the team:** use the "Export Cache" button in the Category Editor (Step 3), share the JSON file, others import it

### Multi-client / Multi-account Support
- Holdings are **never auto-merged** across accounts — each has a unique `holdingKey = "${account}::${schemeName}"`
- Handles: single account, NRE+NRO (one file, two sheets), spouses (two separate files uploaded together)
- K's "Parag Parikh Flexi Cap" and G's "Parag Parikh Flexi Cap" remain separate items throughout

### Asset Allocation Categories (5 buckets)
| Bucket | AMFI Category Examples |
|---|---|
| Large / Flexicap | Large Cap, Flexi Cap, Focused, ELSS, Multi Cap |
| Midcap | Mid Cap, Large & Mid Cap |
| Small Cap | Small Cap |
| Debt | All debt schemes, Conservative Hybrid, Arbitrage, BAF |
| Stocks | Direct equity — manual entry |

**Special mapping rules:**
- Kotak Arbitrage → **Debt** (despite being an equity scheme by AMFI)
- HDFC Balanced Advantage → **Debt** (hybrid treated conservatively)
- Aggressive Hybrid → **Large** (equity-oriented hybrid)

### Inflation Assumptions
- FI / Retirement goals: **7%**
- Education / College goals: **10%** (9% for K-G specifically)
- Wedding goals: **10%**

### Glide Path (Auto Asset Allocation)
| Years to goal | Starting equity | Annual reduction | Floor |
|---|---|---|---|
| 10+ years | 80% | −2%/year | 40% |
| 5–9 years | 60% | −2%/year | 20% |
| < 5 years | 30% | Linear to 0% | 0% |

**Weighted return per year:** `(equity% × 12%) + (debt% × 7%)`

### Minimum SIP Calculation
- Computed using the glide path's average return over the goal horizon
- **Rounded up to the nearest ₹5,000**
- User can slide SIP up/down from this minimum to see corpus/depletion change live

---

## 3. Tool Architecture

### Tech Stack
```
React + Vite          — UI framework and build tool
vite-plugin-singlefile — Bundles everything into one .html
SheetJS (xlsx)         — Reading uploaded .xlsx portfolio files
ExcelJS                — Writing formatted .xlsx output
@dnd-kit/core          — Drag-and-drop category correction
Fuse.js                — Fuzzy matching (now largely replaced by lookup table)
Chart.js               — Interactive charts in planning phase
```

### File Structure
```
src/
  App.jsx                    — Main app, phase state machine (6 phases)
  App.css                    — All styles
  utils/
    parsePortfolio.js        — Parse live portfolio .xlsx files
    parseInvestmentPlan.js   — Parse Investment Plan sheets for auto-mapping
    fundLookup.js            — Deterministic fund name lookup table
    fundAliases.js           — (legacy) alias table, superseded by fundLookup.js
    categoryMap.js           — AMFI category → bucket mapping
    cache.js                 — localStorage cache + mfapi.in fallback
    schemeSeed.js            — 14,367 AMFI schemes (bundled, ~2MB)
    projection.js            — Financial projection engine (glide path, SIP calc)
    exportXlsx.js            — Generate Asset Allocation Review .xlsx with charts
  components/
    UploadPhase.jsx          — Step 1: multi-file portfolio upload
    GoalPhase.jsx            — Step 2: assign funds to goals (+ Investment Plan auto-import)
    CategoryPhase.jsx        — Step 3: verify/correct fund categories + Category Editor
    ReviewPhase.jsx          — Step 4: drag-drop confirmation (now called "Confirm")
    ExportPhase.jsx          — Step 5: pie charts + generate .xlsx (now called "Review")
    PlanningPhase.jsx        — Step 6: interactive goal projections
```

---

## 4. The 6-Phase Workflow

### Phase 1 — Upload
- Upload one or more `.xlsx` live portfolio files
- **Auto-detects:** single account, NRE+NRO multi-sheet, or separate files for spouses
- CAS HeldAway entries automatically excluded
- Multiple files merged with account labels preserved on each holding

### Phase 2 — Goals
- User creates goals (Retirement/FI, Son Education, Daughter Wedding, etc.)
- Assigns funds to each goal manually
- **OR** uploads an Investment Plan `.xlsx` for auto-assignment
  - Reads the `"Investment Plan"` sheet (or `"Sheet1"` for G-format files)
  - Detects goal names by finding rows followed by "Investible Amount"
  - Matches fund abbreviations to portfolio holdings via deterministic lookup table
  - Filters to correct account using column header (e.g. "G A/c", "K-G Joint A/c")

### Phase 3 — Categorise
- Auto-categorises each unique fund (by scheme name) using: cache → AMFI seed → mfapi.in API
- Shows progress bar during resolution
- **Category Editor** button opens a modal showing all cached schemes — edit, save, export/import JSON
- All corrections saved to localStorage immediately

### Phase 4 — Confirm *(was "Review")*
- Drag-and-drop funds between 4 buckets per goal: Large/Flexicap, Midcap, Small Cap, Debt
- **Every drag correction is saved to localStorage** — shown by green toast notification
- **Equity (Other):** Direct Stocks + Other fields
- **Debt (Other):** EPF/PPF/NSC/Spouse fields shown **only for Retirement goals**; all other goals just show a single "Other" field
- Live summary showing equity:debt split and market cap split per goal

### Phase 5 — Review *(was "Export")*
- Two pie charts per goal: Asset Allocation (Equity:Debt) and Market Cap Split (Large/Mid/Small)
- Charts drawn to canvas and **embedded in the Excel output** as a separate "Charts" sheet
- Download .xlsx → open in Excel → File → Export as PDF to share with client

### Phase 6 — Plan
- **Two modes:** Initial Planning (fully interactive) and Review (corpus locked from Phase 5)
- Per goal: all assumption sliders update charts in real time
- Retirement goal: accumulation curve + drawdown curve, depletion age
- Education/Wedding goals: projected corpus vs inflation-adjusted target
- Glide path chart showing equity/debt allocation year by year
- Minimum SIP displayed; user adjusts SIP slider to see outcome change

---

## 5. Clients & Sample Files

### Client: MSK
- Single account, one goal (Retirement/FI)
- 13 funds, total ₹35,13,605
- Simple test case — use this first

### Clients: K & G (spouses)
- Upload `K_Live_Portfolio.xlsx` + `G_Live_Portfolio.xlsx` together
- Many shared funds — same fund appears in both K and G accounts
- Investment Plan: `2026-05-K-G-Investments-Review.xlsx` (sheet: "Investment Plan")
  - Col B = G's individual goals
  - Col F = K-G Joint goals
- Col header row 1 says "G A/c" and "K-G Joint A/c" respectively
- **Critical:** K's Parag Parikh Flexi Cap goes to Financial Independence; G's goes to Daughter UG — same fund, different goals, must NOT be merged

### Client: LS
- Single account, assume all Retirement goal

### Client: SV
- NRE + NRO accounts in one file (two portfolio sheets)
- Investment Plan: `2025-08_Investments_Review_SV.xlsx` (sheet: "Investment Plan - Apr 26")
- Fund names use truncated/ISIN format: e.g. `"Quant Flexi Cap (G) (INF966L01457)"`
- `Nipp Ind Small Cap Fund` = Nippon India Small Cap Fund (truncated display name)

---

## 6. Known Fund Name Aliases (lookup table)

Key mappings in `fundLookup.js`:

| Investment Plan name | Maps to |
|---|---|
| Kotak Emerging Fund / Kotak Emerging Equity Fund | Kotak Mid Cap Fund Growth |
| ICICI Value Discovery Fund | ICICI Prudential Value Fund Growth |
| Parag Parikh Flexicap | Parag Parikh Flexi Cap Fund Growth |
| HDFC Flexicap Fund | HDFC Flexi Cap Fund Growth |
| Quant Smallcap | Quant Small Cap Fund Growth |
| Nippon Small Cap Fund / Nipp Ind | Nippon India Small Cap Fund Growth |
| UTI Conservative Fund | UTI Conservative Hybrid Fund Growth |
| Canara Robeco Conservative | Canara Robeco Conservative Hybrid Fund Growth |
| DSP Multi Asset | DSP Multi Asset Allocation Fund Growth |

> **When a new fund fails to auto-match:** Add one line to `fundLookup.js` in the `LOOKUP` object and rebuild.

---

## 7. Output Files

### Asset Allocation Review .xlsx
- **Sheet 1: "Asset Allocation Review"**
  - Full portfolio holdings list with values
  - Per-goal breakdown: asset allocation summary (Equity/Debt %), market cap split, equity total, debt breakdown, corpus total
- **Sheet 2: "Charts"**
  - Asset allocation pie chart (Equity:Debt) per goal
  - Market cap split pie chart per goal
  - Sized exactly 400×480px, correct aspect ratio (was previously squished)

### Sharing with clients
- Open .xlsx in Excel
- File → Export → Save as PDF
- Both sheets (numbers + charts) included in the PDF

---

## 8. Important Bugs Fixed (chronological)

| Bug | Root cause | Fix |
|---|---|---|
| Export gets stuck / hangs | `corpusTotal` used before declaration in exportXlsx.js | Moved all variable declarations to top of goal block |
| Equity split % wrong (40% instead of 72%) | Denominator included stocks value; sample uses MF-equity-only | Changed to `bucketValue / equityMFTotal` |
| wifeEpf / wifePpf excluded from Corpus Total | Tacked on as afterthought after calculation | Unified into single `debtExtrasTotal` variable |
| Charts vertically squished in Excel | ExcelJS cell area didn't match canvas pixel dimensions | Computed col width and row height using ExcelJS pixel formulas; canvas 400×480px matched exactly |
| Fund numbers wrong for K+G | All shared funds auto-merged by schemeName | Introduced `holdingKey = account::schemeName` as true identity throughout entire pipeline |
| Investment Plan auto-mapping incomplete | Matcher returned both K:: and G:: keys for every shared fund | Parser now reads account label from row 1 (e.g. "G A/c") and filters to matching account |
| Quant funds / DSP never matching | Lookup targets included "Fund Growth" suffix; SV file truncates to "Quant Flexi Cap" only | Shortened lookup targets to minimal identifying prefix, added bidirectional substring matching |
| Drag-and-drop corrections not persisting | `saveUserCorrection()` not called in ReviewPhase drag handler | Added call to `saveUserCorrection()` in `handleDragEnd` with green toast confirmation |

---

## 9. Phase 2 Roadmap (next steps)

The planning tool (Phase 6) is built and integrated. Next priorities discussed:

1. **Verify planning calculations** against existing Excel planning sheets (K, G FI sheets)
2. **PDF export** of the planning charts directly from the tool
3. **Save/load session state** — so a review can be resumed without re-uploading files
4. **Shared cache** — either via a network drive JSON file or Cloudflare Worker KV, so all analysts share category corrections
5. **More goal types** — House purchase (lump sum + EMI model), Emergency fund
6. **Step-up SIP modelling** in the accumulation phase for existing portfolio review

---

## 10. Running the Tool

### For end users (no technical knowledge needed)
1. Download `Asset Allocation Review Tool.html`
2. Double-click to open in Chrome or Edge
3. No installation needed

### For developers (rebuilding after code changes)
```bash
unzip asset-allocator-source.zip
cd asset-allocator-tool
npm install
npm run dev        # local development at http://localhost:5173
npm run build      # produces dist/index.html (single file)
```

### Adding a new fund to the lookup table
Open `src/utils/fundLookup.js`, add one line to the `LOOKUP` object:
```js
'your plan name here':  'unique substring of portfolio name',
```
Then rebuild (`npm run build`).

### Updating the AMFI seed database
```bash
# Re-parse the AMFI txt file
python3 scripts/parse_amfi.py  # produces public/scheme_cache_seed.json
# Then convert to JS module
python3 scripts/seed_to_js.py  # produces src/utils/schemeSeed.js
npm run build
```

---

## 11. Analyst Workflow Notes

- **Always start with MSK** when testing a new version — it's the simplest (1 goal, no overlap, all funds present)
- **For K+G joint review:** upload both files in Phase 1, then upload `2026-05-K-G-Investments-Review.xlsx` as the Investment Plan in Phase 2
- **CAS HeldAway funds** are automatically excluded — you don't need to delete them before uploading
- **Debt (Other) fields** (EPF, PPF, NSC, Spouse EPF/PPF) only appear for goals whose name contains "Retirement" or "FI" — all other goals show a single "Other" box
- **After running a review**, navigate to Phase 6 (Plan tab) to show the client their projections — the corpus values flow through automatically in Review mode