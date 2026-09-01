export type KomuzQuizQuestion = {
  id: string;
  questionKey: string;
  choicesKey: string;
  correctIndex: number;
};

/** Written from the same sourced facts as the migration's `komuz-overview`
 * content (ky.wikipedia.org/Комуз + kutbilim.kg - already cited for the
 * `komuz-discovery` material in V1). Question/choice text lives in i18n
 * (returnObjects: true for the choices array), not here - this file is
 * just the scoring structure. */
export const KOMUZ_QUIZ_QUESTIONS: readonly KomuzQuizQuestion[] = [
  { id: 'q1', questionKey: 'culture.komuz.quiz.q1.question', choicesKey: 'culture.komuz.quiz.q1.choices', correctIndex: 0 },
  { id: 'q2', questionKey: 'culture.komuz.quiz.q2.question', choicesKey: 'culture.komuz.quiz.q2.choices', correctIndex: 1 },
  { id: 'q3', questionKey: 'culture.komuz.quiz.q3.question', choicesKey: 'culture.komuz.quiz.q3.choices', correctIndex: 0 },
] as const;
