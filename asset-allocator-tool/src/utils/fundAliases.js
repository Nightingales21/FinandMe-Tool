/**
 * Manual alias table for funds that were renamed, abbreviated, or truncated.
 * Keys: lowercase partial names as they appear in Investment Plan sheets.
 * Values: substrings that uniquely identify the actual fund in the live portfolio.
 *
 * Add new entries here whenever the auto-matcher fails on a known fund.
 */
export const FUND_ALIASES = {
  // Kotak renamed funds (SEBI recategorisation)
  'kotak emerging':                    'kotak mid cap',
  'kotak emerging equity':             'kotak mid cap',
  'kotak emerging fund':               'kotak mid cap',
  'kotak emerging equity fund':        'kotak mid cap',

  // ICICI name variations
  'icici value discovery':             'icici prudential value',
  'icici value fund':                  'icici prudential value',
  'icici value discovery fund':        'icici prudential value',

  // Parag Parikh short names
  'parag parikh flexicap':             'parag parikh flexi cap',
  'parag parikh dynamic':              'parag parikh dynamic asset',
  'parag parikh conservative hyb':     'parag parikh conservative hybrid',
  'parag parikh flexi cap- reg':       'parag parikh flexi cap',
  'parag parikh dynamic asset allocation fund -': 'parag parikh dynamic asset',
  'ppfas flexicap':                    'parag parikh flexi cap',
  'ppfas flexi cap':                   'parag parikh flexi cap',

  // UTI short names
  'uti conservative':                  'uti conservative hybrid',
  'uti conservative fund':             'uti conservative hybrid',
  'uti conservative hybrid- reg':      'uti conservative hybrid',

  // Canara Robeco short names
  'canara robeco conservative':        'canara robeco conservative hybrid',

  // HDFC short names
  'hdfc flexicap':                     'hdfc flexi cap',
  'hdfc flexicap fund':                'hdfc flexi cap',
  'hdfc balanced advantage- reg':      'hdfc balanced advantage',
  'hdfc balanced':                     'hdfc balanced advantage',

  // Nippon — 'Nipp Ind' is the truncated form used in some portfolio exports
  'nippon small cap':                  'nipp',
  'nippon smallcap':                   'nipp',
  'nippon india small cap':            'nipp',
  'nipp ind small cap':                'nipp',
  'nipp ind':                          'nipp',

  // Quant variations
  'quant smallcap':                    'quant small cap',
  'quant small cap fund':              'quant small cap',
  'quant flexicap':                    'quant flexi cap',
  'quant flexi cap (g)':               'quant flexi cap',
  'quant large and mid cap fund':      'quant large and mid cap',
  'quant large and mid':               'quant large and mid cap',

  // DSP
  'dsp multi asset':                   'dsp multi asset allocation',

  // Axis
  'axis gold':                         'axis gold fund',
};

export function resolveAlias(planName) {
  const lower = planName.toLowerCase().trim();
  // Exact match first
  if (FUND_ALIASES[lower]) return FUND_ALIASES[lower];
  // Partial match: plan name contains alias key, or alias key contains plan name
  for (const [alias, target] of Object.entries(FUND_ALIASES)) {
    if (lower.includes(alias) || alias.includes(lower)) return target;
  }
  return null;
}
