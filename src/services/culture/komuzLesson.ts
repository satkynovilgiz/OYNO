/**
 * Komuz Learning's step sequence and local quiz scoring. The quiz here is
 * a completion gate only (client-scored, no server round trip) - it
 * deliberately does NOT touch culture_quiz_questions or the daily quiz
 * reward, so it can't become a second XP-quiz economy (see the V2 plan).
 */
export type KomuzLessonStepId = 'introduction' | 'parts' | 'strings' | 'quiz';

export type KomuzLessonStep = { id: KomuzLessonStepId };

export const KOMUZ_LESSON_STEPS: readonly KomuzLessonStep[] = [
  { id: 'introduction' },
  { id: 'parts' },
  { id: 'strings' },
  { id: 'quiz' },
] as const;

export function clampStepIndex(index: number): number {
  return Math.min(Math.max(index, 0), KOMUZ_LESSON_STEPS.length - 1);
}

export function isLastStep(stepIndex: number): boolean {
  return stepIndex >= KOMUZ_LESSON_STEPS.length - 1;
}

export const KOMUZ_QUIZ_PASS_RATIO = 0.7;

export type QuizAnswer = { questionId: string; choiceIndex: number };
export type QuizQuestionKey = { id: string; correctIndex: number };

export function scoreQuiz(
  answers: QuizAnswer[],
  questions: readonly QuizQuestionKey[],
): { correct: number; total: number; passed: boolean } {
  const total = questions.length;
  const correct = answers.filter((answer) => {
    const question = questions.find((q) => q.id === answer.questionId);
    return question ? question.correctIndex === answer.choiceIndex : false;
  }).length;
  return { correct, total, passed: total > 0 && correct / total >= KOMUZ_QUIZ_PASS_RATIO };
}
