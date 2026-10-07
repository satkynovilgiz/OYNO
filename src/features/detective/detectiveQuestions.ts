import type { ImageSourcePropType } from 'react-native';

import { cultureItemImages } from '@/features/culture/data';

/**
 * Culture Detective questions - every clue and explanation RESTATES a
 * reviewed field of an existing culture item (no new claims):
 *   Kyrgyz  - the item's own text (supabase/migrations, culture_items)
 *   RU / EN - its reviewed translation (content/translations/culture_batch1.*.json)
 * `clueFields` / `explanationField` name the field each text comes from;
 * detectiveQuestions.test.ts checks every id, source, field and translation.
 * Answer options are only the TITLES of other real items - a wrong option
 * asserts nothing. Texts live in i18n: detective.questions.<id>.* and
 * detective.names.<culture item id>.
 */
export type SourceField = 'cultural_meaning' | 'origin' | 'history' | 'traditional_method' | 'fun_facts' | 'objects_used' | 'when_used' | 'modern_status';

export type DetectiveQuestion = {
  id: string;
  /** The culture item this is about - the explanation links to /culture/item/<sourceId>. */
  sourceId: string;
  /** Where clue 1, 2, 3 come from (most general first). */
  clueFields: [SourceField, SourceField, SourceField];
  explanationField: SourceField;
  /** Four culture item ids; their titles are the answers. Includes `sourceId`. */
  optionIds: [string, string, string, string];
};

export const DETECTIVE_QUESTIONS: DetectiveQuestion[] = [
  { id: 'tunduk', sourceId: 'boz-uy-tunduk', clueFields: ['cultural_meaning', 'cultural_meaning', 'modern_status'], explanationField: 'fun_facts', optionIds: ['boz-uy-tunduk', 'boz-uy-karkas', 'boz-uy-kiyiz-jabuu', 'boz-uy-ichki-jasalga'] },
  { id: 'karkas', sourceId: 'boz-uy-karkas', clueFields: ['cultural_meaning', 'objects_used', 'traditional_method'], explanationField: 'traditional_method', optionIds: ['boz-uy-karkas', 'boz-uy-tunduk', 'boz-uy-kiyiz-jabuu', 'shyrdak-craft'] },
  { id: 'kiyiz-jabuu', sourceId: 'boz-uy-kiyiz-jabuu', clueFields: ['when_used', 'objects_used', 'cultural_meaning'], explanationField: 'traditional_method', optionIds: ['boz-uy-kiyiz-jabuu', 'boz-uy-ichki-jasalga', 'shyrdak-craft', 'boz-uy-karkas'] },
  { id: 'ichki-jasalga', sourceId: 'boz-uy-ichki-jasalga', clueFields: ['modern_status', 'objects_used', 'cultural_meaning'], explanationField: 'cultural_meaning', optionIds: ['boz-uy-ichki-jasalga', 'boz-uy-kiyiz-jabuu', 'boz-uy-tunduk', 'horse-eer'] },
  { id: 'eer', sourceId: 'horse-eer', clueFields: ['origin', 'cultural_meaning', 'traditional_method'], explanationField: 'fun_facts', optionIds: ['horse-eer', 'boz-uy-karkas', 'horse-at-chabysh', 'shyrdak-craft'] },
  { id: 'kok-boru', sourceId: 'horse-kok-boru', clueFields: ['cultural_meaning', 'traditional_method', 'history'], explanationField: 'origin', optionIds: ['horse-kok-boru', 'horse-oodarysh', 'horse-at-chabysh', 'horse-kyz-kuumai'] },
  { id: 'kyz-kuumai', sourceId: 'horse-kyz-kuumai', clueFields: ['origin', 'objects_used', 'traditional_method'], explanationField: 'cultural_meaning', optionIds: ['horse-kyz-kuumai', 'horse-kok-boru', 'horse-oodarysh', 'horse-at-chabysh'] },
  { id: 'at-chabysh', sourceId: 'horse-at-chabysh', clueFields: ['origin', 'cultural_meaning', 'traditional_method'], explanationField: 'fun_facts', optionIds: ['horse-at-chabysh', 'horse-kyz-kuumai', 'horse-kok-boru', 'horse-oodarysh'] },
  { id: 'oodarysh', sourceId: 'horse-oodarysh', clueFields: ['cultural_meaning', 'origin', 'traditional_method'], explanationField: 'modern_status', optionIds: ['horse-oodarysh', 'horse-kok-boru', 'horse-kyz-kuumai', 'horse-at-chabysh'] },
  { id: 'shyrdak', sourceId: 'shyrdak-craft', clueFields: ['origin', 'traditional_method', 'history'], explanationField: 'fun_facts', optionIds: ['shyrdak-craft', 'boz-uy-kiyiz-jabuu', 'oymo-kochkor-muyuz', 'boz-uy-ichki-jasalga'] },
  { id: 'umai-ene', sourceId: 'oymo-umai-ene', clueFields: ['origin', 'cultural_meaning', 'fun_facts'], explanationField: 'fun_facts', optionIds: ['oymo-umai-ene', 'oymo-kochkor-muyuz', 'shyrdak-craft', 'boz-uy-tunduk'] },
  { id: 'kochkor-muyuz', sourceId: 'oymo-kochkor-muyuz', clueFields: ['cultural_meaning', 'cultural_meaning', 'cultural_meaning'], explanationField: 'cultural_meaning', optionIds: ['oymo-kochkor-muyuz', 'oymo-umai-ene', 'shyrdak-craft', 'boz-uy-ichki-jasalga'] },
  // Added for Expeditions (same sourcing rules).
  { id: 'boz-uy', sourceId: 'boz-uy-overview', clueFields: ['origin', 'history', 'traditional_method'], explanationField: 'cultural_meaning', optionIds: ['boz-uy-overview', 'boz-uy-karkas', 'boz-uy-kiyiz-jabuu', 'horse-eer'] },
  { id: 'shyrdak-colors', sourceId: 'shyrdak-tustor', clueFields: ['fun_facts', 'cultural_meaning', 'cultural_meaning'], explanationField: 'cultural_meaning', optionIds: ['shyrdak-tustor', 'shyrdak-craft', 'oymo-kochkor-muyuz', 'boz-uy-kiyiz-jabuu'] },
];

export function detectiveQuestion(id: string): DetectiveQuestion | undefined {
  return DETECTIVE_QUESTIONS.find((question) => question.id === id);
}

/** The bundled (offline) artwork for a question, or null - a missing picture never blocks answering. */
export function questionArtwork(question: DetectiveQuestion): ImageSourcePropType | null {
  return cultureItemImages[question.sourceId]?.[0] ?? null;
}

export const sourceRoute = (question: DetectiveQuestion) => `/culture/item/${question.sourceId}`;
