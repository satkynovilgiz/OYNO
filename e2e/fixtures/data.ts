/**
 * Deterministic public content for the smoke suite. Real OYNO ids and
 * titles (so routes, learning paths and glossary links resolve), short
 * fixture text. Never fetched from the live project.
 */
const item = (id: string, category: string, title: string, sort: number, extra: Record<string, unknown> = {}) => ({
  id,
  category_id: category,
  subgroup: null,
  title,
  alt_names: null,
  type_label: null,
  origin: `${title}: origin (fixture text).`,
  history: `${title}: history (fixture text). `.repeat(12),
  cultural_meaning: `${title}: cultural meaning (fixture text). `.repeat(12),
  when_used: null,
  ingredients: null,
  traditional_method: null,
  who_participates: null,
  objects_used: null,
  regional_notes: null,
  modern_status: `${title}: today (fixture text). `.repeat(12),
  fun_facts: null,
  simple_summary_kg: null,
  simple_summary_ru: null,
  simple_summary_en: null,
  accuracy_level: 'partially_verified',
  sources: [],
  sort_order: sort,
  image_url: null,
  published_at: null,
  content_updated_at: null,
  update_note: null,
  ...extra,
});

export const FIXTURE_TABLES: Record<string, Record<string, unknown>[]> = {
  culture_categories: [
    // Same shape as the real culture_categories rows (id, title, sort_order).
    { id: 'boz-uy', title: 'Боз үй', sort_order: 0 },
    { id: 'shyrdak', title: 'Шырдак', sort_order: 1 },
  ],
  culture_items: [
    item('boz-uy-overview', 'boz-uy', 'Боз үй', 0),
    item('boz-uy-karkas', 'boz-uy', 'Жыгач каркас', 1),
    item('boz-uy-tunduk', 'boz-uy', 'Түндүк', 2),
    item('shyrdak-craft', 'shyrdak', 'Шырдак', 3),
    item('oymo-overview', 'shyrdak', 'Кыргыз оймо-чийимдери', 4),
  ],
  culture_materials: [],
  content_translations: [],
  explore_regions: [],
  discoveries: [],
  region_content_links: [],
  region_intros: [],
  oymo_creations: [],
  quests: [],
  quest_steps: [],
};
