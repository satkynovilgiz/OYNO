import type { SupportedLanguage } from '@/i18n';
import { resolveContentByDepth } from '@/services/ageExperience/contentDepth';
import type { ContentDepth } from '@/services/ageExperience/types';
import type { CultureItemRow } from '@/services/content/types';

function localizedSimpleSummary(item: CultureItemRow, language: SupportedLanguage): string | null {
  if (language === 'ru') return item.simple_summary_ru;
  if (language === 'en') return item.simple_summary_en;
  return item.simple_summary_kg;
}

/**
 * Picks a short "introduction" for a category detail screen from its own
 * already-researched items - never invents new copy (spec "Do not invent
 * cultural facts"). Prefers the category's richest item (the one with the
 * most sourced fields filled in, usually its "-overview" row), then
 * resolves the age-appropriate depth from real stored fields the same way
 * CultureItemDetailScreen does. Returns null when nothing in the category
 * has real content yet, so the screen can omit the section entirely
 * rather than show a placeholder.
 */
export function pickCategoryIntro(items: CultureItemRow[], language: SupportedLanguage, depth: ContentDepth): string | null {
  const withContent = items.filter((item) => item.history || item.cultural_meaning);
  if (withContent.length === 0) return null;

  const richest = [...withContent].sort((a, b) => a.sort_order - b.sort_order)[0];
  const standard = [richest.history, richest.cultural_meaning].filter(Boolean).join(' ');

  return resolveContentByDepth({ simple: localizedSimpleSummary(richest, language), standard }, depth);
}
