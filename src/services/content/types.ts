import type { LocalizedText, VerificationStatus } from '@/features/explore/types';

export type CultureCategoryRow = {
  id: string;
  title: string;
  sort_order: number;
};

export type CultureMaterialKind = 'today_discovery' | 'reading' | 'video' | 'game';

export type CultureMaterialRow = {
  id: string;
  kind: CultureMaterialKind;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  sort_order: number;
};

export type ExploreRegionRow = {
  id: string;
  kind: 'region' | 'nature';
  name_kg: string;
  name_ru: string;
  name_en: string;
  tagline: string;
  facts: string[];
  status: VerificationStatus;
  sort_order: number;
};

export type QuestRow = {
  id: string;
  character_id: string;
  title: string;
  subtitle: string;
  total_count: number;
  cta_label: string;
};

export type CultureAccuracyLevel = 'verified' | 'partially_verified' | 'unverified';

/** A single culture item (custom, dish, etc.) under a culture_categories
 * row. Most optional fields are null until that item's own research pass
 * is done - see the migration comment in
 * supabase/migrations/20260826000001_culture_items.sql. */
export type CultureItemRow = {
  id: string;
  category_id: string;
  subgroup: string | null;
  title: string;
  alt_names: string | null;
  origin: string | null;
  history: string | null;
  cultural_meaning: string | null;
  when_used: string | null;
  ingredients: string | null;
  traditional_method: string | null;
  fun_facts: string | null;
  accuracy_level: CultureAccuracyLevel;
  sources: string[] | null;
  sort_order: number;
};

export function mapExploreRegionName(row: ExploreRegionRow): LocalizedText {
  return { kg: row.name_kg, ru: row.name_ru, en: row.name_en };
}
