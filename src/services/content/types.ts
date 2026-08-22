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

export function mapExploreRegionName(row: ExploreRegionRow): LocalizedText {
  return { kg: row.name_kg, ru: row.name_ru, en: row.name_en };
}
