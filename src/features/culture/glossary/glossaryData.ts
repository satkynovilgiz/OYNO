/**
 * Kyrgyz Culture Glossary - ONE curated list of references. Nothing here is
 * a definition: each entry points at an existing, sourced culture_items row
 * and the authored field that actually defines the term. The definition
 * shown is that field, resolved at runtime through the normal localized
 * content (reviewed RU/EN where it exists, otherwise the honest Kyrgyz
 * fallback). No AI, no generated text, no backend/CMS.
 *
 * Chosen 2026-10-02 from the live content, field by field. Left out on
 * purpose (see the final report / docs):
 *  - комуз: its defining field (origin) says "the oldest" instrument - an
 *    unsourced superlative flagged in docs/CONTENT_AUDIT.md §5;
 *  - кочкор мүйүз: its cultural_meaning is the flagged "sets Kyrgyz
 *    ornament apart" claim;
 *  - шырдак colour meanings (shyrdak-tustor): colour symbolism is flagged;
 *  - every `unverified` culture item (165): not a definition source.
 */

export type GlossaryField = 'history' | 'origin' | 'cultural_meaning' | 'objects_used' | 'traditional_method';

export type GlossaryEntry = {
  id: string;
  /** Canonical Kyrgyz term - the item's own title or one of its authored
   * alt_names (never an invented spelling). */
  term: string;
  sourceContentType: 'culture_item';
  sourceContentId: string;
  /** The authored field that defines this term. */
  sourceField: GlossaryField;
  /** True when the term IS the item (title) - its alt_names are then its
   * alternate names. Sub-terms named inside an item have none. */
  isItemTitle: boolean;
  /** Explicit, authored alternative spellings per article language (used
   * only for inline term matching). Each one is copied from the source
   * item's own authored alt_names - never invented or inferred. */
  aliases?: Partial<Record<'kg' | 'ru' | 'en', string[]>>;
};

export const GLOSSARY: GlossaryEntry[] = [
  { id: 'boz-uy', term: 'Боз үй', sourceContentType: 'culture_item', sourceContentId: 'boz-uy-overview', sourceField: 'history', isItemTitle: true },
  { id: 'tunduk', term: 'Түндүк', sourceContentType: 'culture_item', sourceContentId: 'boz-uy-tunduk', sourceField: 'cultural_meaning', isItemTitle: true },
  { id: 'kerege', term: 'Кереге', sourceContentType: 'culture_item', sourceContentId: 'boz-uy-karkas', sourceField: 'cultural_meaning', isItemTitle: false },
  { id: 'uuk', term: 'Уук', sourceContentType: 'culture_item', sourceContentId: 'boz-uy-karkas', sourceField: 'cultural_meaning', isItemTitle: false },
  { id: 'tuurduk', term: 'Туурдук', sourceContentType: 'culture_item', sourceContentId: 'boz-uy-kiyiz-jabuu', sourceField: 'cultural_meaning', isItemTitle: false },
  { id: 'uzuk', term: 'Үзүк', sourceContentType: 'culture_item', sourceContentId: 'boz-uy-kiyiz-jabuu', sourceField: 'cultural_meaning', isItemTitle: false },
  { id: 'ak-orgoo', term: 'Ак өргөө', sourceContentType: 'culture_item', sourceContentId: 'boz-uy-ak-orgoo', sourceField: 'cultural_meaning', isItemTitle: true },
  { id: 'shyrdak', term: 'Шырдак', sourceContentType: 'culture_item', sourceContentId: 'shyrdak-craft', sourceField: 'origin', isItemTitle: true },
  { id: 'ala-kiyiz', term: 'Ала кийиз', sourceContentType: 'culture_item', sourceContentId: 'shyrdak-ala-kiyiz', sourceField: 'cultural_meaning', isItemTitle: true },
  { id: 'oyum', term: 'Оюм', sourceContentType: 'culture_item', sourceContentId: 'oymo-overview', sourceField: 'origin', isItemTitle: false },
  { id: 'ak-kalpak', term: 'Ак калпак', sourceContentType: 'culture_item', sourceContentId: 'clothing-ak-kalpak', sourceField: 'cultural_meaning', isItemTitle: true },
  { id: 'elechek', term: 'Элечек', sourceContentType: 'culture_item', sourceContentId: 'clothing-elechek', sourceField: 'cultural_meaning', isItemTitle: true },
  { id: 'tebetey', term: 'Тебетей', sourceContentType: 'culture_item', sourceContentId: 'clothing-tebetey', sourceField: 'cultural_meaning', isItemTitle: true },
  { id: 'chapan', term: 'Чапан', sourceContentType: 'culture_item', sourceContentId: 'clothing-chapan', sourceField: 'cultural_meaning', isItemTitle: true },
  { id: 'eer', term: 'Ээр', sourceContentType: 'culture_item', sourceContentId: 'horse-eer', sourceField: 'traditional_method', isItemTitle: false },
  { id: 'kok-boru', term: 'Көк бөрү', sourceContentType: 'culture_item', sourceContentId: 'horse-kok-boru', sourceField: 'traditional_method', isItemTitle: true, aliases: { kg: ['Улак тартыш'] } },
  { id: 'kyz-kuumai', term: 'Кыз куумай', sourceContentType: 'culture_item', sourceContentId: 'horse-kyz-kuumai', sourceField: 'traditional_method', isItemTitle: true },
  { id: 'oodarysh', term: 'Оодарыш', sourceContentType: 'culture_item', sourceContentId: 'horse-oodarysh', sourceField: 'traditional_method', isItemTitle: true, aliases: { kg: ['Эңиш'] } },
];

/** Explicit article <-> term links for the "Key terms" section. Never
 * found by scanning article text. */
export const KEY_TERMS_BY_ITEM: Record<string, string[]> = {
  'boz-uy-overview': ['tunduk', 'kerege', 'uuk', 'tuurduk', 'uzuk', 'ak-orgoo'],
  'boz-uy-karkas': ['kerege', 'uuk', 'tunduk'],
  'boz-uy-kiyiz-jabuu': ['tuurduk', 'uzuk'],
  'shyrdak-craft': ['ala-kiyiz', 'oyum'],
  'shyrdak-ala-kiyiz': ['shyrdak'],
  'oymo-overview': ['shyrdak', 'ala-kiyiz'],
  'horse-overview': ['kok-boru', 'kyz-kuumai', 'oodarysh', 'eer'],
};

export function glossaryRoute(id: string): string {
  return `/culture/glossary/${id}`;
}
