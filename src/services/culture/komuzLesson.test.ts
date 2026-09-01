import { KOMUZ_LESSON_STEPS, clampStepIndex, isLastStep, scoreQuiz } from './komuzLesson';

describe('KOMUZ_LESSON_STEPS', () => {
  it('has the 4 steps in order', () => {
    expect(KOMUZ_LESSON_STEPS.map((s) => s.id)).toEqual(['introduction', 'parts', 'strings', 'quiz']);
  });
});

describe('clampStepIndex', () => {
  it('clamps to the valid range', () => {
    expect(clampStepIndex(-1)).toBe(0);
    expect(clampStepIndex(99)).toBe(KOMUZ_LESSON_STEPS.length - 1);
    expect(clampStepIndex(2)).toBe(2);
  });
});

describe('isLastStep', () => {
  it('is true only on the last step', () => {
    expect(isLastStep(0)).toBe(false);
    expect(isLastStep(KOMUZ_LESSON_STEPS.length - 1)).toBe(true);
  });
});

describe('scoreQuiz', () => {
  const questions = [
    { id: 'q1', correctIndex: 0 },
    { id: 'q2', correctIndex: 1 },
    { id: 'q3', correctIndex: 2 },
  ];

  it('scores all-correct answers as a pass', () => {
    const result = scoreQuiz(
      [
        { questionId: 'q1', choiceIndex: 0 },
        { questionId: 'q2', choiceIndex: 1 },
        { questionId: 'q3', choiceIndex: 2 },
      ],
      questions,
    );
    expect(result).toEqual({ correct: 3, total: 3, passed: true });
  });

  it('fails below the 70% pass threshold', () => {
    const result = scoreQuiz(
      [
        { questionId: 'q1', choiceIndex: 1 },
        { questionId: 'q2', choiceIndex: 1 },
        { questionId: 'q3', choiceIndex: 0 },
      ],
      questions,
    );
    expect(result).toEqual({ correct: 1, total: 3, passed: false });
  });

  it('treats an answer for an unknown question id as incorrect rather than throwing', () => {
    const result = scoreQuiz([{ questionId: 'unknown', choiceIndex: 0 }], questions);
    expect(result.correct).toBe(0);
  });
});
