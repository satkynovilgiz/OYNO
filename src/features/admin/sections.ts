import { fetchTable, fetchViaRpc } from '@/services/admin/adminService';

export type AdminFieldType = 'text' | 'textarea' | 'number' | 'array' | 'select';

export type AdminFieldConfig = {
  key: string;
  label: string;
  type: AdminFieldType;
  options?: string[];
  /** array fields: newline-separated in the UI, split/joined on save/load. */
};

export type AdminRow = Record<string, unknown>;

export type AdminSectionConfig = {
  id: string;
  label: string;
  idField: string;
  titleField: string;
  fields: AdminFieldConfig[];
  fetch: () => Promise<AdminRow[]>;
  upsertRpc: string;
  deleteRpc: string;
  /** Maps this section's fields (all strings in the editor's form state) to
   * the RPC's named params (p_-prefixed, correctly typed) - matches each
   * admin_upsert_* function's signature in
   * supabase/migrations/20260825000001_admin.sql and
   * 20260829000004_admin_content_extended.sql. */
  toParams: (values: Record<string, string>) => Record<string, unknown>;
};

function toIntOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toArray(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export const ADMIN_SECTIONS: AdminSectionConfig[] = [
  {
    id: 'culture_categories',
    label: 'Culture categories',
    idField: 'id',
    titleField: 'title',
    fetch: () => fetchTable('culture_categories'),
    upsertRpc: 'admin_upsert_culture_category',
    deleteRpc: 'admin_delete_culture_category',
    fields: [
      { key: 'id', label: 'ID (slug)', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'sort_order', label: 'Sort order', type: 'number' },
    ],
    toParams: (v) => ({ p_id: v.id, p_title: v.title, p_sort_order: toIntOrNull(v.sort_order) ?? 0 }),
  },
  {
    id: 'culture_materials',
    label: 'Culture materials',
    idField: 'id',
    titleField: 'title',
    fetch: () => fetchTable('culture_materials'),
    upsertRpc: 'admin_upsert_culture_material',
    deleteRpc: 'admin_delete_culture_material',
    fields: [
      { key: 'id', label: 'ID (slug)', type: 'text' },
      { key: 'kind', label: 'Kind', type: 'select', options: ['today_discovery', 'reading', 'video', 'game'] },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'duration_minutes', label: 'Duration (minutes)', type: 'number' },
      { key: 'sort_order', label: 'Sort order', type: 'number' },
    ],
    toParams: (v) => ({
      p_id: v.id,
      p_kind: v.kind,
      p_title: v.title,
      p_description: v.description.trim() || null,
      p_duration_minutes: toIntOrNull(v.duration_minutes),
      p_sort_order: toIntOrNull(v.sort_order) ?? 0,
    }),
  },
  {
    id: 'culture_items',
    label: 'Culture items (customs/dishes/crafts)',
    idField: 'id',
    titleField: 'title',
    fetch: () => fetchTable('culture_items'),
    upsertRpc: 'admin_upsert_culture_item',
    deleteRpc: 'admin_delete_culture_item',
    fields: [
      { key: 'id', label: 'ID (slug)', type: 'text' },
      {
        key: 'category_id',
        label: 'Category',
        type: 'select',
        options: ['boz-uy', 'oymo', 'shyrdak', 'komuz', 'music', 'clothing', 'horse', 'food', 'games', 'tradition'],
      },
      { key: 'subgroup', label: 'Subgroup', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'alt_names', label: 'Alternate names', type: 'text' },
      { key: 'type_label', label: 'Type', type: 'select', options: ['', 'custom', 'practice', 'ritual', 'ceremony', 'festival'] },
      { key: 'origin', label: 'Origin', type: 'textarea' },
      { key: 'history', label: 'History', type: 'textarea' },
      { key: 'cultural_meaning', label: 'Cultural meaning', type: 'textarea' },
      { key: 'when_used', label: 'When used', type: 'text' },
      { key: 'ingredients', label: 'Ingredients', type: 'textarea' },
      { key: 'traditional_method', label: 'Traditional method', type: 'textarea' },
      { key: 'who_participates', label: 'Who participates', type: 'text' },
      { key: 'objects_used', label: 'Objects used', type: 'text' },
      { key: 'regional_notes', label: 'Regional notes', type: 'textarea' },
      { key: 'modern_status', label: 'Modern status', type: 'text' },
      { key: 'fun_facts', label: 'Fun facts', type: 'textarea' },
      { key: 'accuracy_level', label: 'Accuracy level', type: 'select', options: ['verified', 'partially_verified', 'unverified'] },
      { key: 'sources', label: 'Sources (one URL per line)', type: 'array' },
      { key: 'sort_order', label: 'Sort order', type: 'number' },
    ],
    toParams: (v) => ({
      p_id: v.id,
      p_category_id: v.category_id,
      p_subgroup: v.subgroup.trim() || null,
      p_title: v.title,
      p_alt_names: v.alt_names.trim() || null,
      p_type_label: v.type_label.trim() || null,
      p_origin: v.origin.trim() || null,
      p_history: v.history.trim() || null,
      p_cultural_meaning: v.cultural_meaning.trim() || null,
      p_when_used: v.when_used.trim() || null,
      p_ingredients: v.ingredients.trim() || null,
      p_traditional_method: v.traditional_method.trim() || null,
      p_who_participates: v.who_participates.trim() || null,
      p_objects_used: v.objects_used.trim() || null,
      p_regional_notes: v.regional_notes.trim() || null,
      p_modern_status: v.modern_status.trim() || null,
      p_fun_facts: v.fun_facts.trim() || null,
      p_accuracy_level: v.accuracy_level || 'unverified',
      p_sources: toArray(v.sources),
      p_sort_order: toIntOrNull(v.sort_order) ?? 0,
    }),
  },
  {
    id: 'explore_regions',
    label: 'Explore regions & nature sites',
    idField: 'id',
    titleField: 'name_kg',
    fetch: () => fetchTable('explore_regions'),
    upsertRpc: 'admin_upsert_explore_region',
    deleteRpc: 'admin_delete_explore_region',
    fields: [
      { key: 'id', label: 'ID (slug)', type: 'text' },
      { key: 'kind', label: 'Kind', type: 'select', options: ['region', 'nature'] },
      { key: 'name_kg', label: 'Name (Kyrgyz)', type: 'text' },
      { key: 'name_ru', label: 'Name (Russian)', type: 'text' },
      { key: 'name_en', label: 'Name (English)', type: 'text' },
      { key: 'tagline', label: 'Tagline', type: 'text' },
      { key: 'facts', label: 'Facts (one per line, cited/sourced)', type: 'array' },
      { key: 'status', label: 'Verification status', type: 'select', options: ['verified', 'partially_verified', 'unverified'] },
      { key: 'sort_order', label: 'Sort order', type: 'number' },
    ],
    toParams: (v) => ({
      p_id: v.id,
      p_kind: v.kind,
      p_name_kg: v.name_kg,
      p_name_ru: v.name_ru,
      p_name_en: v.name_en,
      p_tagline: v.tagline,
      p_facts: toArray(v.facts),
      p_status: v.status || 'unverified',
      p_sort_order: toIntOrNull(v.sort_order) ?? 0,
    }),
  },
  {
    id: 'quests',
    label: 'Quests',
    idField: 'id',
    titleField: 'title',
    fetch: () => fetchTable('quests'),
    upsertRpc: 'admin_upsert_quest',
    deleteRpc: 'admin_delete_quest',
    fields: [
      { key: 'id', label: 'ID (slug)', type: 'text' },
      { key: 'character_id', label: 'Character', type: 'select', options: ['bek', 'aidana', 'aiana', 'boru', 'tulpar', 'elchi'] },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'total_count', label: 'Total steps', type: 'number' },
      { key: 'cta_label', label: 'CTA label', type: 'text' },
    ],
    toParams: (v) => ({
      p_id: v.id,
      p_character_id: v.character_id,
      p_title: v.title,
      p_subtitle: v.subtitle,
      p_total_count: toIntOrNull(v.total_count) ?? 1,
      p_cta_label: v.cta_label,
    }),
  },
  {
    id: 'quiz_questions',
    label: 'Culture quiz questions',
    idField: 'id',
    titleField: 'question',
    fetch: () => fetchViaRpc('admin_get_quiz_questions'),
    upsertRpc: 'admin_upsert_quiz_question',
    deleteRpc: 'admin_delete_quiz_question',
    fields: [
      { key: 'id', label: 'ID (slug)', type: 'text' },
      { key: 'question', label: 'Question', type: 'textarea' },
      { key: 'choices', label: 'Choices (exactly 4 lines)', type: 'array' },
      { key: 'correct_index', label: 'Correct choice index (0-3)', type: 'number' },
      { key: 'source_region_id', label: 'Source region ID (optional)', type: 'text' },
      { key: 'sort_order', label: 'Sort order', type: 'number' },
    ],
    toParams: (v) => ({
      p_id: v.id,
      p_question: v.question,
      p_choices: toArray(v.choices),
      p_correct_index: toIntOrNull(v.correct_index) ?? 0,
      p_source_region_id: v.source_region_id.trim() || null,
      p_sort_order: toIntOrNull(v.sort_order) ?? 0,
    }),
  },
];

export function getAdminSection(id: string): AdminSectionConfig | undefined {
  return ADMIN_SECTIONS.find((section) => section.id === id);
}

/** Converts a fetched row into the editor's string-keyed form state -
 * arrays join to newline-separated text, numbers/nulls stringify, exactly
 * mirroring how each section's toParams reads it back on save. */
export function rowToFormValues(section: AdminSectionConfig, row: AdminRow | null): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of section.fields) {
    const raw = row?.[field.key];
    if (raw == null) {
      values[field.key] = '';
    } else if (Array.isArray(raw)) {
      values[field.key] = raw.join('\n');
    } else {
      values[field.key] = String(raw);
    }
  }
  return values;
}
