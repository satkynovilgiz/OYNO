import { shuffled } from '@/features/culture/glossary/study/glossaryStudy';
import type { AgeExperience } from '@/services/ageExperience/types';

import type { ChallengeQuestion } from '../questionBank';

/**
 * Culture Topic Quizzes - small, curated quizzes on ONE topic, run by the
 * EXISTING Challenge engine (ChallengeRunScreen: question UI, answers,
 * explanation, result, Mistake Review). Every question is hand-authored and
 * restates a fact from ONE authored field of existing OYNO content
 * (`sourceContentId` + `sourceField`); nothing is generated at runtime.
 *
 * Topic-only questions live here, NOT in QUESTION_BANK, so the Daily
 * Challenge and collection challenges never change because of them. Text
 * lives in i18n `challenges.questions.<id>.*` like every other question.
 */

export type TopicSourceField =
  | 'origin'
  | 'history'
  | 'cultural_meaning'
  | 'traditional_method'
  | 'fun_facts'
  | 'modern_status'
  | 'objects_used'
  /** culture_material text */
  | 'body';

export type TopicQuestionRef = { questionId: string; sourceField: TopicSourceField; sourceSectionKey?: string };

export type TopicQuiz = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  /** "Read again": the topic's main article. */
  readAgainRoute: string;
  /** Hero image: a culture item with a bundled photo. */
  heroItemId: string;
  questions: TopicQuestionRef[];
};

const TF = [{ id: 'true' }, { id: 'false' }];

/** Topic-only questions (each restates one authored sentence - see comments). */
export const TOPIC_QUESTIONS: ChallengeQuestion[] = [
  // komuz-overview.objects_used: "Баш, моюн, корпус, кутуча, тагоо жана үч кыл."
  { id: 'tq-komuz-parts', sourceType: 'culture_item', sourceId: 'komuz-overview', kind: 'multiple', options: [{ id: 'tunduk' }, { id: 'tagoo' }, { id: 'kerege' }], correctOptionId: 'tagoo' },
  // komuz-overview.fun_facts: 'Түрк элдеринде окшош аспаптар ("кобуз", "комыз") кездешет'
  { id: 'tq-komuz-kobuz', sourceType: 'culture_item', sourceId: 'komuz-overview', kind: 'multiple', options: [{ id: 'kobuz' }, { id: 'chang' }, { id: 'surnai' }], correctOptionId: 'kobuz' },
  // komuz-discovery.body: "1935-жылы Москвада комуздун жаңы түрлөрү (прима, секунда, альт, тенор, бас) иштелип чыккан."
  { id: 'tq-komuz-1935', sourceType: 'culture_material', sourceId: 'komuz-discovery', kind: 'multiple', options: [{ id: 'moscow' }, { id: 'osh' }, { id: 'naryn' }], correctOptionId: 'moscow' },
  // shyrdak-craft.traditional_method: 'Тигүү техникасы "шырык" деп аталып, ушундан "шырдак" деген ат келип чыккан.'
  { id: 'tq-shyrdak-shyryk', sourceType: 'culture_item', sourceId: 'shyrdak-craft', kind: 'multiple', options: [{ id: 'sayma' }, { id: 'shyryk' }, { id: 'uzuk' }], correctOptionId: 'shyryk' },
  // shyrdak-ala-kiyiz.cultural_meaning: "ала кийизде оюм жүн уютулуп жатканда эле кийиздин ичине сиңирилет"
  { id: 'tq-ala-kiyiz', sourceType: 'culture_item', sourceId: 'shyrdak-ala-kiyiz', kind: 'multiple', options: [{ id: 'felted' }, { id: 'cut' }, { id: 'painted' }], correctOptionId: 'felted' },
  // shyrdak-at-bashy.origin: "Нарын облусундагы Ат-Башы району шырдак өнөрүнүн мекени катары таанылат."
  { id: 'tq-at-bashy', sourceType: 'culture_item', sourceId: 'shyrdak-at-bashy', kind: 'multiple', options: [{ id: 'talas' }, { id: 'at-bashy' }, { id: 'chuy' }], correctOptionId: 'at-bashy' },
  // horse-tyiyn-enmei.traditional_method: "Жерде жаткан тыйынды ат чаап бара жатып, аттан түшпөй ... эңип алуу керек."
  { id: 'tq-tyiyn-enmei', sourceType: 'culture_item', sourceId: 'horse-tyiyn-enmei', kind: 'multiple', options: [{ id: 'coin' }, { id: 'whip' }, { id: 'cap' }], correctOptionId: 'coin' },
  // horse-jorgo-salysh.traditional_method: "жоргосун бузган ат жарыштан чыгарылат."
  { id: 'tq-jorgo', sourceType: 'culture_item', sourceId: 'horse-jorgo-salysh', kind: 'trueFalse', options: TF, correctOptionId: 'true' },
  // horse-oodarysh.traditional_method: "Эки чабандес атчан кармашып, атаандашын ээрден сууруп түшүрүүгө аракет кылат."
  { id: 'tq-oodarysh', sourceType: 'culture_item', sourceId: 'horse-oodarysh', kind: 'multiple', options: [{ id: 'finish' }, { id: 'saddle' }, { id: 'coin' }], correctOptionId: 'saddle' },
  // oymo-teke-muyuz.cultural_meaning: "Кочкор мүйүздү жандап жүргөн кошумча элемент."
  { id: 'tq-teke-muyuz', sourceType: 'culture_item', sourceId: 'oymo-teke-muyuz', kind: 'multiple', options: [{ id: 'kochkor' }, { id: 'umai' }, { id: 'kaz' }], correctOptionId: 'kochkor' },
  // oymo-kaz-moyun.cultural_meaning: "Каздын моюнуна окшошкон оюу."
  { id: 'tq-kaz-moyun', sourceType: 'culture_item', sourceId: 'oymo-kaz-moyun', kind: 'multiple', options: [{ id: 'goose' }, { id: 'ram' }, { id: 'dog' }], correctOptionId: 'goose' },
];

export const TOPIC_QUIZZES: readonly TopicQuiz[] = [
  {
    id: 'boz-uy',
    titleKey: 'topicQuiz.topics.boz-uy.title',
    descriptionKey: 'topicQuiz.topics.boz-uy.description',
    readAgainRoute: '/culture/item/boz-uy-overview',
    heroItemId: 'boz-uy-overview',
    questions: [
      { questionId: 'tunduk-flag', sourceField: 'cultural_meaning' },
      { questionId: 'tunduk-parts', sourceField: 'cultural_meaning' },
      { questionId: 'tunduk-position', sourceField: 'cultural_meaning' },
      { questionId: 'kerege-wall', sourceField: 'cultural_meaning' },
      { questionId: 'tuurduk', sourceField: 'cultural_meaning' },
      { questionId: 'tor', sourceField: 'cultural_meaning' },
    ],
  },
  {
    id: 'komuz',
    titleKey: 'topicQuiz.topics.komuz.title',
    descriptionKey: 'topicQuiz.topics.komuz.description',
    readAgainRoute: '/culture/item/komuz-overview',
    heroItemId: 'komuz-overview',
    questions: [
      { questionId: 'komuz-strings', sourceField: 'body' },
      { questionId: 'komuz-kashgari', sourceField: 'body' },
      { questionId: 'tq-komuz-parts', sourceField: 'objects_used' },
      { questionId: 'tq-komuz-kobuz', sourceField: 'fun_facts' },
      { questionId: 'tq-komuz-1935', sourceField: 'body' },
    ],
  },
  {
    id: 'shyrdak',
    titleKey: 'topicQuiz.topics.shyrdak.title',
    descriptionKey: 'topicQuiz.topics.shyrdak.description',
    readAgainRoute: '/culture/item/shyrdak-craft',
    heroItemId: 'shyrdak-craft',
    questions: [
      { questionId: 'shyrdak-unesco', sourceField: 'history' },
      { questionId: 'tq-shyrdak-shyryk', sourceField: 'traditional_method' },
      { questionId: 'shyrdak-edges', sourceField: 'fun_facts' },
      { questionId: 'shyrdak-blue', sourceField: 'cultural_meaning' },
      { questionId: 'tq-ala-kiyiz', sourceField: 'cultural_meaning' },
      { questionId: 'tq-at-bashy', sourceField: 'origin' },
    ],
  },
  {
    id: 'horse-games',
    titleKey: 'topicQuiz.topics.horse-games.title',
    descriptionKey: 'topicQuiz.topics.horse-games.description',
    readAgainRoute: '/culture/item/horse-kok-boru',
    heroItemId: 'horse-kok-boru',
    questions: [
      { questionId: 'kok-boru-unesco', sourceField: 'history' },
      { questionId: 'kok-boru-rules', sourceField: 'history' },
      { questionId: 'kyz-kuumai', sourceField: 'cultural_meaning' },
      { questionId: 'tq-tyiyn-enmei', sourceField: 'traditional_method' },
      { questionId: 'tq-jorgo', sourceField: 'traditional_method' },
      { questionId: 'tq-oodarysh', sourceField: 'traditional_method' },
    ],
  },
  {
    id: 'ornament',
    titleKey: 'topicQuiz.topics.ornament.title',
    descriptionKey: 'topicQuiz.topics.ornament.description',
    readAgainRoute: '/culture/item/oymo-overview',
    heroItemId: 'oymo-kochkor-muyuz',
    questions: [
      { questionId: 'kochkor-muyuz', sourceField: 'cultural_meaning' },
      { questionId: 'umai-ene', sourceField: 'origin' },
      { questionId: 'tq-teke-muyuz', sourceField: 'cultural_meaning' },
      { questionId: 'tq-kaz-moyun', sourceField: 'cultural_meaning' },
    ],
  },
];

export const TOPIC_CHALLENGE_PREFIX = 'topic-';
export const TOPIC_RESULT_PREFIX = 'topic:';
export const MAX_TOPIC_QUESTIONS = 8;
export const CHILD_TOPIC_QUESTIONS = 4;

export function topicChallengeId(topicId: string): string {
  return `${TOPIC_CHALLENGE_PREFIX}${topicId}`;
}
export function topicRoute(topicId: string): string {
  return `/challenges/${topicChallengeId(topicId)}`;
}
export function topicFromChallengeId(challengeId: string): TopicQuiz | null {
  if (!challengeId.startsWith(TOPIC_CHALLENGE_PREFIX)) return null;
  const id = challengeId.slice(TOPIC_CHALLENGE_PREFIX.length);
  return TOPIC_QUIZZES.find((topic) => topic.id === id) ?? null;
}
export function topicResultKey(topicId: string): string {
  return `${TOPIC_RESULT_PREFIX}${topicId}`;
}

// -- validation ---------------------------------------------------------

export type ValidationContext = {
  /** Resolves any challenge question (bank or topic-only). */
  getQuestion: (id: string) => ChallengeQuestion | undefined;
  hasKey: (key: string) => boolean;
  /** Authored text of a content field; undefined = unknown here (offline / not loaded). null = known missing. */
  contentField?: (type: ChallengeQuestion['sourceType'], id: string, field: TopicSourceField) => string | null | undefined;
};

export function validateTopicQuestion(ref: TopicQuestionRef, ctx: ValidationContext): string[] {
  const problems: string[] = [];
  const question = ctx.getQuestion(ref.questionId);
  if (!question) return [`${ref.questionId}: unknown question`];
  if (question.sourceType === 'destination') problems.push(`${ref.questionId}: not culture content`);
  const ids = question.options.map((option) => option.id);
  if (ids.length < 2 || ids.length > 4) problems.push(`${ref.questionId}: needs 2-4 choices`);
  if (new Set(ids).size !== ids.length) problems.push(`${ref.questionId}: duplicate choices`);
  if (!ids.includes(question.correctOptionId)) problems.push(`${ref.questionId}: correct answer not in choices`);
  if (question.kind === 'trueFalse' && ids.join(',') !== 'true,false') problems.push(`${ref.questionId}: true/false choices`);
  if (question.kind === 'multiple' && ids.length < 3) problems.push(`${ref.questionId}: multiple choice needs 3+`);
  if ((ref.sourceField === 'body') !== (question.sourceType === 'culture_material')) problems.push(`${ref.questionId}: field ${ref.sourceField} does not fit ${question.sourceType}`);
  for (const key of [`challenges.questions.${question.id}.question`, `challenges.questions.${question.id}.explanation`]) if (!ctx.hasKey(key)) problems.push(`${ref.questionId}: missing ${key}`);
  if (question.kind === 'multiple') for (const id of ids) if (!ctx.hasKey(`challenges.questions.${question.id}.options.${id}`)) problems.push(`${ref.questionId}: missing option ${id}`);
  if (ctx.contentField) {
    const text = ctx.contentField(question.sourceType, question.sourceId, ref.sourceField);
    if (text === null || (typeof text === 'string' && !text.trim())) problems.push(`${ref.questionId}: source ${question.sourceId}.${ref.sourceField} missing`);
  }
  return problems;
}

export function validateTopic(topic: TopicQuiz, ctx: ValidationContext, routeExists: (route: string) => boolean): string[] {
  const problems: string[] = [];
  if (topic.questions.length < 4 || topic.questions.length > MAX_TOPIC_QUESTIONS) problems.push(`${topic.id}: needs 4-${MAX_TOPIC_QUESTIONS} questions`);
  const seen = new Set<string>();
  for (const ref of topic.questions) {
    if (seen.has(ref.questionId)) problems.push(`${topic.id}: duplicate ${ref.questionId}`);
    seen.add(ref.questionId);
    problems.push(...validateTopicQuestion(ref, ctx).map((problem) => `${topic.id}/${problem}`));
  }
  for (const key of [topic.titleKey, topic.descriptionKey]) if (!ctx.hasKey(key)) problems.push(`${topic.id}: missing ${key}`);
  if (!routeExists(topic.readAgainRoute)) problems.push(`${topic.id}: read-again route missing`);
  return problems;
}

/** Only questions that pass validation are ever playable. */
export function playableQuestionIds(topic: TopicQuiz, ctx: ValidationContext): string[] {
  const seen = new Set<string>();
  return topic.questions
    .filter((ref) => (seen.has(ref.questionId) ? false : (seen.add(ref.questionId), true)))
    .filter((ref) => validateTopicQuestion(ref, ctx).length === 0)
    .map((ref) => ref.questionId);
}

/**
 * The questions of one attempt: playable ids in a deterministic seeded
 * order (seed = topic + attempt number, so a retake is reordered but the
 * same attempt always looks the same). Children get at most 4.
 */
export function topicQuestionIds(topic: TopicQuiz, ctx: ValidationContext, attempt: number, age: AgeExperience): string[] {
  const ids = playableQuestionIds(topic, ctx);
  const ordered = attempt === 0 ? ids : shuffled(ids, seedOf(`${topic.id}:${attempt}`));
  return ordered.slice(0, age === 'child' ? CHILD_TOPIC_QUESTIONS : MAX_TOPIC_QUESTIONS);
}

function seedOf(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Topic quizzes that really test this content (via a question's source). */
export function topicsForContent(type: 'culture_item' | 'culture_material', id: string, getQuestion: ValidationContext['getQuestion']): TopicQuiz[] {
  return TOPIC_QUIZZES.filter((topic) =>
    topic.questions.some((ref) => {
      const question = getQuestion(ref.questionId);
      return question?.sourceType === type && question.sourceId === id;
    }),
  );
}

/** The topic a (mistaken) question belongs to - lets Mistake Review point back to it. */
export function topicForQuestion(questionId: string): TopicQuiz | null {
  return TOPIC_QUIZZES.find((topic) => topic.questions.some((ref) => ref.questionId === questionId)) ?? null;
}
