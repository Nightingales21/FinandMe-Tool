import Fuse from 'fuse.js';
import { normaliseName, amfiCategoryToBucket } from './categoryMap';
import { SCHEME_SEED } from './schemeSeed';

const CACHE_KEY = 'fnm_scheme_cache_v2';

let _cache = null;
let _fuse = null;
let _seedIndex = [];

export async function initCache() {
  // Load from localStorage
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    _cache = stored ? JSON.parse(stored) : {};
  } catch {
    _cache = {};
  }

  // Seed is bundled directly — no fetch needed, works offline
  _seedIndex = SCHEME_SEED.map(e => ({
    ...e,
    normName: normaliseName(e.name),
  }));
  _fuse = new Fuse(_seedIndex, {
    keys: ['normName'],
    threshold: 0.3,
    includeScore: true,
  });
}

export function getCached(schemeName) {
  if (!_cache) return null;
  const key = normaliseName(schemeName);
  return _cache[key] ?? null;
}

export function setCached(schemeName, data) {
  if (!_cache) _cache = {};
  const key = normaliseName(schemeName);
  _cache[key] = data;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(_cache));
  } catch {}
}

export function saveUserCorrection(schemeName, bucket) {
  setCached(schemeName, { ...(getCached(schemeName) || {}), bucket, userOverride: true });
}

// Try seed index first (fuzzy), then API
export async function resolveCategory(schemeName) {
  // 1. Check localStorage cache
  const cached = getCached(schemeName);
  if (cached) return cached;

  const normName = normaliseName(schemeName);

  // 2. Try fuzzy match in seed
  if (_fuse && _seedIndex.length > 0) {
    const results = _fuse.search(normName);
    if (results.length > 0 && results[0].score < 0.2) {
      const match = results[0].item;
      const bucket = amfiCategoryToBucket(match.amfi_category);
      if (bucket) {
        const data = { bucket, amfi_category: match.amfi_category, code: match.code, displayName: schemeName, source: 'seed' };
        setCached(schemeName, data);
        return data;
      }
    }
  }

  // 3. Fall back to mfapi.in
  try {
    const searchRes = await fetch(
      `https://api.mfapi.in/mf/search?q=${encodeURIComponent(schemeName.split(' ').slice(0, 4).join(' '))}`
    );
    const searchData = await searchRes.json();
    if (!searchData?.length) return { bucket: null, source: 'unknown' };

    const code = searchData[0].schemeCode;
    const navRes = await fetch(`https://api.mfapi.in/mf/${code}/latest`);
    const navData = await navRes.json();
    const amfi_category = navData?.meta?.scheme_category ?? '';
    const bucket = amfiCategoryToBucket(amfi_category);

    const data = { bucket, amfi_category, code: String(code), displayName: schemeName, source: 'api' };
    setCached(schemeName, data);
    return data;
  } catch {
    return { bucket: null, source: 'error' };
  }
}

export function exportCache() {
  return JSON.stringify(_cache, null, 2);
}

export function importCache(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    _cache = { ...(_cache || {}), ...data };
    localStorage.setItem(CACHE_KEY, JSON.stringify(_cache));
    return true;
  } catch {
    return false;
  }
}
