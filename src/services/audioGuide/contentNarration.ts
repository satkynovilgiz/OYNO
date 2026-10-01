import type { SupportedLanguage } from '@/i18n';
import { resolveContentByDepth } from '@/services/ageExperience/contentDepth';
import type { ContentDepth } from '@/services/ageExperience/types';
import type { CultureItemRow, CultureMaterialRow } from '@/services/content/types';

import { joinNarration, type Narration } from './narration';

/**
 * What each detail screen's Listen control reads - one definition, shared
 * by the detail screens and the Regional Audio Journeys, so a journey stop
 * never says something different from the page it stands for.
 */

type PlaceText = {
  name: Partial<Record<SupportedLanguage, string | null>> & { kg: string };
  tagline: string;
  facts: string[];
  factsTranslation?: string;
};

/** Destination: name, tagline (only when the facts are in the app
 * language), and facts (two for children). */
export function placeNarration(place: PlaceText, appLanguage: SupportedLanguage, isChild: boolean): Narration {
  const factsLanguage: SupportedLanguage = place.factsTranslation === 'available' ? appLanguage : 'kg';
  const facts = isChild ? place.facts.slice(0, 2) : place.facts;
  return {
    lang: factsLanguage,
    text: joinNarration([place.name[factsLanguage] ?? place.name.kg, ...(factsLanguage === appLanguage ? [place.tagline] : []), ...facts]),
  };
}

export const CULTURE_ITEM_DETAIL_FIELDS: (keyof CultureItemRow)[] = [
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
];

/** The simple-depth summary in the app language (null until authored). */
export function localizedSimpleSummary(item: CultureItemRow, language: SupportedLanguage): string | null {
  if (language === 'ru') return item.simple_summary_ru;
  if (language === 'en') return item.simple_summary_en;
  return item.simple_summary_kg;
}

/** Culture item: the simple summary (app language) at 'simple' depth when
 * one exists, else the filled detail fields in the language they're
 * actually in (never mixing languages). */
export function cultureItemNarration(item: CultureItemRow, appLanguage: SupportedLanguage, depth: ContentDepth): Narration {
  const simpleSummary = resolveContentByDepth({ simple: localizedSimpleSummary(item, appLanguage) }, depth);
  if (simpleSummary) return { lang: appLanguage, text: joinNarration([item.title, simpleSummary]) };
  const bodyLanguage: SupportedLanguage = item.translation?.status === 'available' ? appLanguage : 'kg';
  const fields = CULTURE_ITEM_DETAIL_FIELDS.filter((key) => !!item[key]).map((key) => item[key] as string);
  return { lang: bodyLanguage, text: joinNarration([bodyLanguage === 'kg' ? (item.translation?.titles.kg ?? item.title) : item.title, ...fields]) };
}

/** Culture material: title + body; null when there's no body to read. */
export function materialNarration(material: CultureMaterialRow, appLanguage: SupportedLanguage): Narration | null {
  if (!material.body) return null;
  const bodyLanguage: SupportedLanguage = appLanguage !== 'kg' && material.translation?.status === 'available' ? appLanguage : 'kg';
  return { lang: bodyLanguage, text: joinNarration([bodyLanguage === 'kg' ? (material.translation?.titles.kg ?? material.title) : material.title, material.body]) };
}
