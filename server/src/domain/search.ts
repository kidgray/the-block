const MAX_TERMS = 8;

/** Splits free text into terms that must each match (design §7.1): `2021 civic` → ['2021', 'civic']. */
export function parseSearchTerms(query: string | undefined): string[] {
  if (!query) return [];
  return query.split(/\s+/).filter(Boolean).slice(0, MAX_TERMS);
}
