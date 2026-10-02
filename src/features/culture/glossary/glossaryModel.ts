import type { CatalogItem } from '@/services/content/contentCatalog';
import type { CultureItemRow } from '@/services/content/types';
import { rankSearchResults } from '@/services/search/globalSearch';

import { GLOSSARY, KEY_TERMS_BY_ITEM, glossaryRoute, type GlossaryEntry } from './glossaryData';

/** A glossary entry joined with its (localized) source row at runtime. */
export type ResolvedGlossaryEntry = {
  entry: GlossaryEntry;
  item: CultureItemRow;
  /** The authored field text, exactly as resolved for this language. */
  definition: string;
  alternateNames: string[];
};

/** Joins entries with their source rows. An entry whose item or field
 * disappeared (deleted content, emptied field) is hidden - never shown
 * with an empty or substitute definition. Curated order is kept. */
export function resolveGlossary(items: readonly CultureItemRow[] | undefined, entries: readonly GlossaryEntry[] = GLOSSARY): ResolvedGlossaryEntry[] {
  if (!items) return [];
  return entries.flatMap((entry) => {
    const item = items.find((row) => row.id === entry.sourceContentId);
    const value = item?.[entry.sourceField];
    const definition = typeof value === 'string' ? value.trim() : '';
    if (!item || !definition) return [];
    const alternateNames = entry.isItemTitle && item.alt_names ? item.alt_names.split(/[,;]/).map((name) => name.trim()).filter(Boolean) : [];
    return [{ entry, item, definition, alternateNames }];
  });
}

/**
 * Local glossary search through the SAME Search 3.0 ranking (folding,
 * KG/RU/EN alternates and the search-only Latin transliteration) - no
 * second engine. Term first, then its authored alternate names.
 */
export function searchGlossary(resolved: readonly ResolvedGlossaryEntry[], query: string): ResolvedGlossaryEntry[] {
  if (!query.trim()) return [...resolved];
  const asCatalog: CatalogItem[] = resolved.map(({ entry, alternateNames }) => ({
    contentType: 'culture_item',
    id: entry.id,
    title: entry.term,
    metadata: null,
    thumbnail: null,
    route: glossaryRoute(entry.id),
    searchText: [entry.term, ...alternateNames],
  }));
  return rankSearchResults(asCatalog, query).map((result) => resolved.find(({ entry }) => entry.id === result.item.id)!);
}

/** The Key terms for an article (explicit mapping only), minus the article
 * itself and any term no longer resolvable. */
export function keyTermsFor(itemId: string, resolved: readonly ResolvedGlossaryEntry[]): ResolvedGlossaryEntry[] {
  return (KEY_TERMS_BY_ITEM[itemId] ?? []).flatMap((id) => {
    const match = resolved.find(({ entry }) => entry.id === id);
    return match && match.entry.sourceContentId !== itemId ? [match] : [];
  });
}

/** Short preview for the list - visual truncation only, never rewording. */
export function previewOf(definition: string, max = 140): string {
  return definition.length <= max ? definition : `${definition.slice(0, max).trimEnd()}…`;
}

/** Integrity problems (tests / maintenance). */
export function validateGlossary(
  entries: readonly GlossaryEntry[],
  catalog: { items: ReadonlyMap<string, Partial<Record<string, unknown>>>; routes: ReadonlySet<string> },
): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const terms = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) problems.push(`duplicate id ${entry.id}`);
    ids.add(entry.id);
    const term = entry.term.trim().toLocaleLowerCase();
    if (!term) problems.push(`${entry.id}: empty term`);
    if (terms.has(term)) problems.push(`duplicate term ${entry.term}`);
    terms.add(term);
    const row = catalog.items.get(entry.sourceContentId);
    if (!row) {
      problems.push(`${entry.id}: source ${entry.sourceContentId} missing`);
      continue;
    }
    const text = row[entry.sourceField];
    if (typeof text !== 'string' || !text.trim()) problems.push(`${entry.id}: field ${entry.sourceField} empty`);
    if (!catalog.routes.has(entry.sourceContentType)) problems.push(`${entry.id}: no route for ${entry.sourceContentType}`);
  }
  for (const [itemId, termIds] of Object.entries(KEY_TERMS_BY_ITEM)) {
    for (const id of termIds) if (!ids.has(id)) problems.push(`key terms of ${itemId}: unknown term ${id}`);
  }
  return problems;
}
