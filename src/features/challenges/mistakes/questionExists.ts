import { getQuestion } from '../questionBank';

/** A mistake reference is valid only while QUESTION_BANK still has it. */
export const questionExists = (questionId: string): boolean => !!getQuestion(questionId);
