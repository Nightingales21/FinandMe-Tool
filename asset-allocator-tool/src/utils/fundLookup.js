/**
 * Deterministic fund name lookup.
 * Takes a plan abbreviation, returns the matching schemeName from holdings.
 *
 * Strategy (in order):
 * 1. Exact match in lookup table → target substring
 * 2. All significant words from plan name appear in holding clean name
 * 3. No match → return null (shows as warning)
 */

// Lookup table: lowercase plan name → identifying substring of clean holding name
const LOOKUP = {
  // Parag Parikh
  'parag parikh flexicap':                      'parag parikh flexi cap',
  'parag parikh flexi cap':                     'parag parikh flexi cap',
  'parag parikh flexi cap fund':                'parag parikh flexi cap',
  'parag parikh dynamic':                       'parag parikh dynamic asset allocation',
  'parag parikh dynamic asset':                 'parag parikh dynamic asset allocation',
  'parag parikh dynamic asset allocation fund': 'parag parikh dynamic asset allocation',
  'parag parikh conservative':                  'parag parikh conservative hybrid',
  'parag parikh conservative hybrid':           'parag parikh conservative hybrid',
  'parag parikh conservative hybrid fund':      'parag parikh conservative hybrid',
  'parag parikh conservative hybr':             'parag parikh conservative hybrid',

  // HDFC
  'hdfc flexicap':                              'hdfc flexi cap',
  'hdfc flexicap fund':                         'hdfc flexi cap',
  'hdfc flexi cap':                             'hdfc flexi cap',
  'hdfc flexi cap fund':                        'hdfc flexi cap',
  'hdfc balanced':                              'hdfc balanced advantage',
  'hdfc balanced advantage':                    'hdfc balanced advantage',
  'hdfc balanced advantage fund':               'hdfc balanced advantage',
  'hdfc balanced advantage- reg':               'hdfc balanced advantage',
  'hdfc corporate bond':                        'hdfc corporate bond',

  // Kotak
  'kotak emerging':                             'kotak mid cap',
  'kotak emerging fund':                        'kotak mid cap',
  'kotak emerging equity':                      'kotak mid cap',
  'kotak emerging equity fund':                 'kotak mid cap',
  'kotak mid cap':                              'kotak mid cap',
  'kotak mid cap fund':                         'kotak mid cap',
  'kotak arbitrage':                            'kotak arbitrage',
  'kotak arbitrage fund':                       'kotak arbitrage',

  // ICICI
  'icici value discovery':                      'icici prudential value',
  'icici value discovery fund':                 'icici prudential value',
  'icici value fund':                           'icici prudential value',
  'icici prudential value':                     'icici prudential value',
  'icici all seasons':                          'icici prudential all seasons bond',
  'icici all seasons bond':                     'icici prudential all seasons bond',

  // Quant
  'quant smallcap':                             'quant small cap',
  'quant small cap':                            'quant small cap',
  'quant small cap fund':                       'quant small cap',
  'quant midcap':                               'quant mid cap',
  'quant mid cap':                              'quant mid cap',
  'quant mid cap fund':                         'quant mid cap',
  'quant flexi cap':                            'quant flexi cap',
  'quant flexi cap fund':                       'quant flexi cap',
  'quant flexicap':                             'quant flexi cap',
  'quant large and mid':                        'quant large and mid cap',
  'quant large and mid cap':                    'quant large and mid cap',
  'quant large and mid cap fund':               'quant large and mid cap',

  // Nippon
  'nippon small cap':                           'nippon',
  'nippon small cap fund':                      'nippon',
  'nippon smallcap':                            'nippon',
  'nippon india small cap':                     'nippon',
  'nipp ind small cap':                         'nippon',
  'nipp ind':                                   'nippon',

  // UTI
  'uti conservative':                           'uti conservative hybrid',
  'uti conservative fund':                      'uti conservative hybrid',
  'uti conservative hybrid':                    'uti conservative hybrid',
  'uti conservative hybrid fund':               'uti conservative hybrid',
  'uti conservative hybrid- reg':               'uti conservative hybrid',

  // Canara Robeco
  'canara robeco conservative':                 'canara robeco conservative hybrid',
  'canara robeco conservative hybrid':          'canara robeco conservative hybrid',
  'canara robeco conservative hybrid fund':     'canara robeco conservative hybrid',
  'canara robeco conservative hyb':             'canara robeco conservative hybrid',

  // DSP
  'dsp multi asset':                            'dsp multi asset',
  'dsp multi asset allocation':                 'dsp multi asset',
  'dsp multi asset allocation fund':            'dsp multi asset',

  // SBI
  'sbi focused':                                'sbi focused',
  'sbi focused fund':                           'sbi focused',
  'sbi small cap':                              'sbi small cap',
  'sbi small cap fund':                         'sbi small cap',

  // Axis
  'axis gold':                                  'axis gold',
  'axis gold fund':                             'axis gold',
};

// Words that add no matching value — strip before word-overlap check
const NOISE = new Set([
  'fund','funds','growth','direct','regular','reg','plan','scheme',
  'the','and','of','for','a','an',
]);

function sigWords(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !NOISE.has(w));
}

export function lookupPlanName(planName, uniqueClean) {
  const lower = planName.toLowerCase().trim();

  // 1. Direct lookup table match
  const target = LOOKUP[lower];
  if (target) {
    const hit = uniqueClean.find(h => h.cleanLower.includes(target));
    if (hit) return hit.schemeName;
  }

  // 2. Prefix match: any key that is a prefix of or equal to plan name
  for (const [key, tgt] of Object.entries(LOOKUP)) {
    if (lower.startsWith(key + ' ') || lower === key) {
      const hit = uniqueClean.find(h => h.cleanLower.includes(tgt));
      if (hit) return hit.schemeName;
    }
  }

  // 3. Word overlap: all significant words in plan name appear in holding name
  const planWords = sigWords(planName);
  if (planWords.length >= 2) {
    const candidates = uniqueClean.filter(h =>
      planWords.every(w => h.cleanLower.includes(w))
    );
    if (candidates.length === 1) return candidates[0].schemeName;
    if (candidates.length > 1) {
      // Pick the one with the most word overlap
      candidates.sort((a, b) =>
        sigWords(b.cleanLower).filter(w => planWords.includes(w)).length -
        sigWords(a.cleanLower).filter(w => planWords.includes(w)).length
      );
      return candidates[0].schemeName;
    }
  }

  return null;
}
