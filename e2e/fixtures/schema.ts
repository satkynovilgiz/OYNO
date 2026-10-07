/**
 * The query contract of the E2E fake backend: every mocked table and the
 * columns the app's anonymous client can READ from it. Filters, select and
 * order are validated against this list - never against fixture rows - and
 * fixture rows must fit it too, so changing fixture data cannot change which
 * queries are accepted.
 *
 * Hand-written on purpose. fixtures/schema.test.ts checks it against
 * supabase/migrations (CREATE / ALTER TABLE, column-level grants) and against
 * the column names used by the content queries in src/services. It is a
 * contract for the smoke suite, not a substitute for integration tests
 * against a real Supabase/PostgREST.
 */
export const TABLE_SCHEMA = {
  // 20260824000001_content.sql
  culture_categories: ['id', 'title', 'sort_order'],
  // 20260826000001_culture_items.sql + customs_expansion, storage_pipeline,
  // simple_summary (renamed to _kg), content_depth_locale_columns,
  // content_publication_timestamps
  culture_items: [
    'id',
    'category_id',
    'subgroup',
    'title',
    'alt_names',
    'type_label',
    'origin',
    'history',
    'cultural_meaning',
    'when_used',
    'ingredients',
    'traditional_method',
    'who_participates',
    'objects_used',
    'regional_notes',
    'modern_status',
    'fun_facts',
    'simple_summary_kg',
    'simple_summary_ru',
    'simple_summary_en',
    'accuracy_level',
    'sources',
    'sort_order',
    'image_url',
    'published_at',
    'content_updated_at',
    'update_note',
  ],
  // 20260824000001_content.sql + culture_materials_content, content_publication_timestamps
  culture_materials: [
    'id',
    'kind',
    'title',
    'description',
    'duration_minutes',
    'sort_order',
    'body',
    'accuracy_level',
    'sources',
    'image_url',
    'published_at',
    'content_updated_at',
    'update_note',
  ],
  // 20260927000001_content_translations.sql
  content_translations: ['content_type', 'content_id', 'language', 'field', 'value', 'status', 'updated_at'],
  // 20260824000001_content.sql + content_verification (sources)
  explore_regions: ['id', 'kind', 'name_kg', 'name_ru', 'name_en', 'tagline', 'facts', 'status', 'sort_order', 'sources'],
  // 20260901000002_explore_v2.sql
  discoveries: ['id', 'region_id', 'category', 'title_kg', 'title_ru', 'title_en', 'xp_reward', 'accuracy_level', 'sources', 'published', 'sort_order'],
  // 20260930000002_region_content_links.sql - column grant: updated_by is NOT readable
  region_content_links: ['region_id', 'content_type', 'content_id', 'sort_order', 'created_at', 'updated_at'],
  // 20260930000002_region_content_links.sql - column grant: updated_by is NOT readable
  region_intros: ['region_id', 'language', 'intro', 'updated_at'],
  // 20260901000001_culture_v2_creations.sql - RLS: a guest reads none (fixture: no rows)
  oymo_creations: ['id', 'user_id', 'name', 'layers', 'background_color', 'symmetry_mode', 'created_at', 'updated_at'],
  // 20260824000001_content.sql
  quests: ['id', 'character_id', 'title', 'subtitle', 'total_count', 'cta_label'],
  // 20260901000002_explore_v2.sql
  quest_steps: ['id', 'quest_id', 'step_order', 'step_type', 'target_id', 'title_kg', 'title_ru', 'title_en', 'sort_order'],
} as const satisfies Record<string, readonly string[]>;

export type MockedTable = keyof typeof TABLE_SCHEMA;

export const isMockedTable = (table: string): table is MockedTable => Object.prototype.hasOwnProperty.call(TABLE_SCHEMA, table);
