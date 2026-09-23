/**
 * Curated Knowledge Challenge questions. Every question restates a fact
 * that is ALREADY stored in OYNO - the culture_items / culture_materials /
 * explore_regions text it points to via `sourceType` + `sourceId` - never a
 * new claim. Nothing is generated at runtime. Question, option and
 * explanation text live in i18n (`challenges.questions.<id>.*`, KG/RU/EN);
 * wrong options are simply other answers, not asserted facts.
 * `questionBank.test.ts` checks every id, source and translation.
 */
export type QuestionSourceType = 'culture_item' | 'culture_material' | 'destination';
export type QuestionKind = 'multiple' | 'image' | 'trueFalse';

/** Image options show a real bundled photo of real content. */
export type OptionImageRef = { type: 'culture_item' | 'destination'; id: string };

export type ChallengeOption = { id: string; image?: OptionImageRef };

export type ChallengeQuestion = {
  id: string;
  sourceType: QuestionSourceType;
  sourceId: string;
  kind: QuestionKind;
  options: ChallengeOption[];
  correctOptionId: string;
};

const TRUE_FALSE: ChallengeOption[] = [{ id: 'true' }, { id: 'false' }];

export const QUESTION_BANK: ChallengeQuestion[] = [
  // Boz uy
  { id: 'tunduk-flag', sourceType: 'culture_item', sourceId: 'boz-uy-overview', kind: 'multiple', options: [{ id: 'tunduk' }, { id: 'komuz' }, { id: 'horse' }], correctOptionId: 'tunduk' },
  { id: 'tunduk-parts', sourceType: 'culture_item', sourceId: 'boz-uy-tunduk', kind: 'multiple', options: [{ id: 'kerege' }, { id: 'chamgarak' }, { id: 'uuk' }], correctOptionId: 'chamgarak' },
  { id: 'tunduk-position', sourceType: 'culture_item', sourceId: 'boz-uy-tunduk', kind: 'trueFalse', options: TRUE_FALSE, correctOptionId: 'false' },
  { id: 'kerege-wall', sourceType: 'culture_item', sourceId: 'boz-uy-karkas', kind: 'multiple', options: [{ id: 'uuk' }, { id: 'tunduk' }, { id: 'kerege' }], correctOptionId: 'kerege' },
  { id: 'tuurduk', sourceType: 'culture_item', sourceId: 'boz-uy-kiyiz-jabuu', kind: 'multiple', options: [{ id: 'tuurduk' }, { id: 'uzuk' }, { id: 'chamgarak' }], correctOptionId: 'tuurduk' },
  { id: 'tor', sourceType: 'culture_item', sourceId: 'boz-uy-ichki-jasalga', kind: 'multiple', options: [{ id: 'kerege' }, { id: 'tor' }, { id: 'chamgarak' }], correctOptionId: 'tor' },
  {
    id: 'image-tunduk',
    sourceType: 'culture_item',
    sourceId: 'boz-uy-tunduk',
    kind: 'image',
    options: [
      { id: 'eer', image: { type: 'culture_item', id: 'horse-eer' } },
      { id: 'tunduk', image: { type: 'culture_item', id: 'boz-uy-tunduk' } },
      { id: 'shyrdak', image: { type: 'culture_item', id: 'shyrdak-tustor' } },
    ],
    correctOptionId: 'tunduk',
  },
  // Horse culture
  { id: 'kok-boru-unesco', sourceType: 'culture_item', sourceId: 'horse-kok-boru', kind: 'trueFalse', options: TRUE_FALSE, correctOptionId: 'true' },
  { id: 'kok-boru-rules', sourceType: 'culture_item', sourceId: 'horse-kok-boru', kind: 'multiple', options: [{ id: 'kashgari' }, { id: 'shamshiev' }, { id: 'simakov' }], correctOptionId: 'shamshiev' },
  { id: 'kyz-kuumai', sourceType: 'culture_item', sourceId: 'horse-kyz-kuumai', kind: 'multiple', options: [{ id: 'riding' }, { id: 'yurt' }, { id: 'song' }], correctOptionId: 'riding' },
  { id: 'kymyz', sourceType: 'culture_item', sourceId: 'horse-jylky', kind: 'multiple', options: [{ id: 'ayran' }, { id: 'kymyz' }, { id: 'tea' }], correctOptionId: 'kymyz' },
  { id: 'hooves', sourceType: 'culture_item', sourceId: 'horse-jylky', kind: 'trueFalse', options: TRUE_FALSE, correctOptionId: 'true' },
  { id: 'saddle-dowry', sourceType: 'culture_item', sourceId: 'horse-eer', kind: 'trueFalse', options: TRUE_FALSE, correctOptionId: 'true' },
  {
    id: 'image-kok-boru',
    sourceType: 'culture_item',
    sourceId: 'horse-kok-boru',
    kind: 'image',
    options: [
      { id: 'kok-boru', image: { type: 'culture_item', id: 'horse-kok-boru' } },
      { id: 'kochkor', image: { type: 'culture_item', id: 'oymo-kochkor-muyuz' } },
      { id: 'karkas', image: { type: 'culture_item', id: 'boz-uy-karkas' } },
    ],
    correctOptionId: 'kok-boru',
  },
  // Ornament & shyrdak
  { id: 'shyrdak-unesco', sourceType: 'culture_item', sourceId: 'shyrdak-craft', kind: 'multiple', options: [{ id: 'y2017' }, { id: 'y2012' }, { id: 'y1979' }], correctOptionId: 'y2012' },
  { id: 'shyrdak-edges', sourceType: 'culture_item', sourceId: 'shyrdak-craft', kind: 'multiple', options: [{ id: 'peaks' }, { id: 'rivers' }, { id: 'clouds' }], correctOptionId: 'peaks' },
  { id: 'shyrdak-blue', sourceType: 'culture_item', sourceId: 'shyrdak-tustor', kind: 'multiple', options: [{ id: 'purity' }, { id: 'wealth' }, { id: 'sky' }], correctOptionId: 'sky' },
  { id: 'kochkor-muyuz', sourceType: 'culture_item', sourceId: 'oymo-kochkor-muyuz', kind: 'trueFalse', options: TRUE_FALSE, correctOptionId: 'true' },
  { id: 'umai-ene', sourceType: 'culture_item', sourceId: 'oymo-umai-ene', kind: 'multiple', options: [{ id: 'children' }, { id: 'horses' }, { id: 'travelers' }], correctOptionId: 'children' },
  // Komuz
  { id: 'komuz-strings', sourceType: 'culture_material', sourceId: 'komuz-discovery', kind: 'multiple', options: [{ id: 'two' }, { id: 'three' }, { id: 'four' }], correctOptionId: 'three' },
  { id: 'komuz-kashgari', sourceType: 'culture_material', sourceId: 'komuz-discovery', kind: 'trueFalse', options: TRUE_FALSE, correctOptionId: 'true' },
  // Nature
  { id: 'son-kol-altitude', sourceType: 'destination', sourceId: 'son-kol', kind: 'multiple', options: [{ id: 'm2000' }, { id: 'm3016' }, { id: 'm4895' }], correctOptionId: 'm3016' },
  { id: 'sary-chelek-depth', sourceType: 'destination', sourceId: 'sary-chelek', kind: 'trueFalse', options: TRUE_FALSE, correctOptionId: 'true' },
  { id: 'lenin-peak', sourceType: 'destination', sourceId: 'alay', kind: 'trueFalse', options: TRUE_FALSE, correctOptionId: 'true' },
  { id: 'arslanbob-forest', sourceType: 'destination', sourceId: 'arslanbob', kind: 'multiple', options: [{ id: 'spruce' }, { id: 'walnut' }, { id: 'juniper' }], correctOptionId: 'walnut' },
  { id: 'suusamyr-valley', sourceType: 'destination', sourceId: 'suusamyr', kind: 'trueFalse', options: TRUE_FALSE, correctOptionId: 'false' },
  {
    id: 'image-son-kol',
    sourceType: 'destination',
    sourceId: 'son-kol',
    kind: 'image',
    options: [
      { id: 'arslanbob', image: { type: 'destination', id: 'arslanbob' } },
      { id: 'alay', image: { type: 'destination', id: 'alay' } },
      { id: 'son-kol', image: { type: 'destination', id: 'son-kol' } },
    ],
    correctOptionId: 'son-kol',
  },
];

export function getQuestion(id: string): ChallengeQuestion | undefined {
  return QUESTION_BANK.find((question) => question.id === id);
}

/** The EXISTING screen for a question's source ("Learn more"). */
export function routeForSource(question: Pick<ChallengeQuestion, 'sourceType' | 'sourceId'>): string {
  if (question.sourceType === 'destination') return `/explore/${question.sourceId}`;
  if (question.sourceType === 'culture_material') return `/culture/material/${question.sourceId}`;
  return `/culture/item/${question.sourceId}`;
}
