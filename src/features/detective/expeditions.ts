import { DETECTIVE_QUESTIONS } from './detectiveQuestions';

/**
 * Themed Expeditions - sets of the EXISTING verified Detective questions
 * (no new claims; every clue keeps its source id). A theme uses only the
 * questions it has: if that is fewer than the others, the expedition is
 * honestly shorter - a question is never repeated to fill it.
 */
export type ExpeditionId = 'yurt' | 'horse' | 'ornament';
export type Expedition = { id: ExpeditionId; questionIds: string[] };

export const EXPEDITIONS: Expedition[] = [
  { id: 'yurt', questionIds: ['boz-uy', 'karkas', 'kiyiz-jabuu', 'tunduk', 'ichki-jasalga'] },
  { id: 'horse', questionIds: ['eer', 'kok-boru', 'kyz-kuumai', 'at-chabysh', 'oodarysh'] },
  { id: 'ornament', questionIds: ['shyrdak', 'shyrdak-colors', 'kochkor-muyuz', 'umai-ene'] },
];

export const expedition = (id: string) => EXPEDITIONS.find((item) => item.id === id);

/** Every question of an expedition exists in the verified pool. */
export const expeditionQuestions = (item: Expedition) => item.questionIds.map((id) => DETECTIVE_QUESTIONS.find((question) => question.id === id)!);
