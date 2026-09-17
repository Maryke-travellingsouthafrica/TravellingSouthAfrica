// Curated "Major Towns" ordering per province, keyed by provinceSlug.
// Values are town slugs (from towns.ts) in the order they should display.
// Provinces not listed here fall back to the default (first 10 towns.ts entries).
export const MAJOR_TOWNS: Record<string, string[]> = {
  'western-cape': [
    'cape-town',
    'stellenbosch',
    'franschhoek',
    'paarl',
    'hermanus',
    'knysna',
    'george',
    'mossel-bay',
    'oudtshoorn',
    'piketberg',
  ],
};
