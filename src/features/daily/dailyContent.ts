import type { SupportedLanguage } from '@/i18n';
import type { AgeExperience } from '@/services/ageExperience/types';
import type { CultureItemRow } from '@/services/content/types';
import { DAILY_TEXT_FIELDS, type DailyTextField } from '@/services/daily/dailyDiscovery';

export type DailyTextBlock = {
  /** i18n key for the block's label (the same `culture.item.*Label` keys
   * the full detail screen uses), or null for an unlabeled lead paragraph. */
  labelKey: string | null;
  text: string;
  /** The language this text is actually written in - the simple summary
   * is authored per language, the other fields are Kyrgyz. Used by the
   * audio guide so it never reads text with the wrong voice. */
  lang: SupportedLanguage;
};

const LABEL_KEY_BY_FIELD: Record<DailyTextField, string> = {
  cultural_meaning: 'culture.item.culturalMeaningLabel',
  history: 'culture.item.historyLabel',
  origin: 'culture.item.originLabel',
  fun_facts: 'culture.item.funFactsLabel',
  when_used: 'culture.item.whenUsedLabel',
  regional_notes: 'culture.item.regionalNotesLabel',
};

/** How much of the item each experience reads (spec "Child → visual + tiny
 * challenge / Teen → discovery/challenge / Adult → richer editorial
 * context"). `blocks` caps how many authored fields are shown; `sentences`
 * trims each one to its opening sentences (child only) so a long history
 * paragraph stays a 1-minute read. `challenge` toggles the picture quiz. */
const DEPTH: Record<AgeExperience, { blocks: number; sentences: number | null; challenge: boolean }> = {
  child: { blocks: 1, sentences: 2, challenge: true },
  preteen: { blocks: 1, sentences: 3, challenge: true },
  teen: { blocks: 2, sentences: null, challenge: true },
  adult: { blocks: 4, sentences: null, challenge: false },
};

export function dailyHasChallenge(experience: AgeExperience): boolean {
  return DEPTH[experience].challenge;
}

/** Opening `count` sentences of `text` - an excerpt of the authored text,
 * never a rewrite. Returns the text unchanged if it's already shorter. */
export function firstSentences(text: string, count: number): string {
  const sentences = text.trim().match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g);
  if (!sentences || sentences.length <= count) return text.trim();
  return sentences.slice(0, count).join('').trim();
}

function simpleSummary(item: CultureItemRow, language: SupportedLanguage): string | null {
  if (language === 'ru') return item.simple_summary_ru ?? null;
  if (language === 'en') return item.simple_summary_en ?? null;
  return item.simple_summary_kg ?? null;
}

/**
 * The text a day's discovery shows, picked from the item's own stored
 * fields. Child/preteen get the pre-authored simple summary when one
 * exists in the current language (same rule as CultureItemDetailScreen),
 * otherwise an excerpt of the first authored field; teen/adult get the
 * first 2/4 authored fields, each labeled like the full detail page.
 */
export function buildDailyTextBlocks(item: CultureItemRow, experience: AgeExperience, language: SupportedLanguage): DailyTextBlock[] {
  const depth = DEPTH[experience];

  if (depth.sentences !== null) {
    const summary = simpleSummary(item, language);
    if (summary) return [{ labelKey: null, text: summary, lang: language }];
  }

  const fields = DAILY_TEXT_FIELDS.filter((field) => !!item[field]?.trim()).slice(0, depth.blocks);
  // Field text is in the app language only when the localized resolver
  // found a full reviewed translation; otherwise it is the Kyrgyz source.
  const fieldLang: SupportedLanguage = language !== 'kg' && item.translation?.status === 'available' && item.translation.language === language ? language : 'kg';
  return fields.map((field, index) => {
    const raw = (item[field] as string).trim();
    return {
      labelKey: depth.sentences !== null && index === 0 ? null : LABEL_KEY_BY_FIELD[field],
      text: depth.sentences !== null ? firstSentences(raw, depth.sentences) : raw,
      lang: fieldLang,
    };
  });
}
