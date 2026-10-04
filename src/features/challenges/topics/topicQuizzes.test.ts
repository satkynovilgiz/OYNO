import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { collectActivityEvents } from '@/features/goals/weeklyGoal';
import { challengeResultKey } from '@/features/learn/learningPaths';
import { recordCompletion } from '@/store/useChallengeStore';

import { pickDailyQuestionIds, scoreAnswers } from '../challengeLogic';
import { recordFinishedAttempt, reviewQueue, wrongIdsOf, EMPTY_MISTAKES } from '../mistakes/mistakesModel';
import { questionExists } from '../mistakes/questionExists';
import { getQuestion, QUESTION_BANK, routeForSource } from '../questionBank';
import {
  playableQuestionIds,
  TOPIC_QUESTIONS,
  TOPIC_QUIZZES,
  topicForQuestion,
  topicFromChallengeId,
  topicQuestionIds,
  topicResultKey,
  topicsForContent,
  validateTopic,
  validateTopicQuestion,
  type ValidationContext,
} from './topicQuizzes';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('@/services/sync/syncTrigger', () => ({ requestAccountSync: jest.fn() }));

const root = path.join(__dirname, '../../../..');
const get = (locale: unknown, key: string) => key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), locale);
const hasAll = (key: string) => [en, ru, kg].every((locale) => typeof get(locale, key) === 'string' && (get(locale, key) as string).length > 0);

/** The authored sentences each question restates (culture_items / culture_materials, read-only audit 2026-10-03). */
const AUTHORED: Record<string, string> = {
  'boz-uy-overview.cultural_meaning': 'Түндүк кыргыз элинин улуттук идентификациясынын символу - Кыргызстандын мамлекеттик желегинде түндүктүн сүрөтү чагылдырылган.',
  'boz-uy-tunduk.cultural_meaning': 'Боз үйдүн чатырынын жогорку бөлүгүндөгү, түтүн чыгуучу тегерек тешик - үйдүн эң ыйык бөлүгү. Эки бөлүктөн турат: алкак (сырткы шакек) жана чамгарак.',
  'boz-uy-karkas.cultural_meaning': 'кереге (дубал катары кызмат кылган тор-каркас), уук ... жана түндүк.',
  'boz-uy-kiyiz-jabuu.cultural_meaning': 'туурдук (керегeни каптаган кийиз ...), үзүк ...',
  'boz-uy-ichki-jasalga.cultural_meaning': 'очоктун арт жагындагы эң урматтуу орун "төр" деп аталып ...',
  'komuz-discovery.body': 'Комуз - кыргыздын эң байыркы үч кылдуу чертме музыкалык аспабы. ... Махмуд Кашкаринин XI кылымда ... 1935-жылы Москвада комуздун жаңы түрлөрү ...',
  'komuz-overview.objects_used': 'Баш, моюн, корпус, кутуча, тагоо жана үч кыл.',
  'komuz-overview.fun_facts': 'Түрк элдеринде окшош аспаптар ("кобуз", "комыз") кездешет',
  'shyrdak-craft.history': '2012-жылы ... ЮНЕСКОнун ... тизмесине кирген.',
  'shyrdak-craft.traditional_method': 'Тигүү техникасы "шырык" деп аталып, ушундан "шырдак" деген ат келип чыккан.',
  'shyrdak-craft.fun_facts': 'Четтери милдеттүү түрдө ак-кара түстөр менен аяктайт - бул кыргыз тоолорунун карлуу чокуларын билдирет.',
  'shyrdak-tustor.cultural_meaning': 'Көк - Теңирдин ыйык түсү, асман менен космосту билдирет.',
  'shyrdak-ala-kiyiz.cultural_meaning': 'ала кийизде оюм жүн уютулуп жатканда эле кийиздин ичине сиңирилет',
  'shyrdak-at-bashy.origin': 'Нарын облусундагы Ат-Башы району шырдак өнөрүнүн мекени катары таанылат.',
  'horse-kok-boru.history': '1996-жылы ... Болот Шамшиев ... 2017-жылы декабрда ЮНЕСКОнун ... тизмесине кирген.',
  'horse-kyz-kuumai.cultural_meaning': 'Кыз куумай - кыздын да ат минүү чеберчилигин көрсөткөн оюн',
  'horse-tyiyn-enmei.traditional_method': 'Жерде жаткан тыйынды ат чаап бара жатып, аттан түшпөй, атты токтотпой эңип алуу керек.',
  'horse-jorgo-salysh.traditional_method': 'жоргосун бузган ат жарыштан чыгарылат.',
  'horse-oodarysh.traditional_method': 'Эки чабандес атчан кармашып, атаандашын ээрден сууруп түшүрүүгө аракет кылат.',
  'oymo-kochkor-muyuz.cultural_meaning': 'Башка элдин оюуларынан кыргыздыкын айырмалап турган ушул элемент.',
  'oymo-umai-ene.origin': 'Умай эне - ... балдар менен төрөлүүчүлөрдүн колдоочусу ...',
  'oymo-teke-muyuz.cultural_meaning': 'Кочкор мүйүздү жандап жүргөн кошумча элемент.',
  'oymo-kaz-moyun.cultural_meaning': 'Каздын моюнуна окшошкон оюу.',
};
const ctx: ValidationContext = { getQuestion, hasKey: hasAll, contentField: (_type, id, field) => AUTHORED[`${id}.${field}`] ?? null };
const routeExists = (route: string) => /^\/culture\/item\/[a-z0-9-]+$/.test(route) && fs.existsSync(path.join(root, 'src/app/culture/item/[itemId]/index.tsx'));

describe('Culture Topic Quizzes - content', () => {
  it('4-6 topics, 4-8 questions each, every one valid and mapped to an authored field', () => {
    expect(TOPIC_QUIZZES.length).toBeGreaterThanOrEqual(4);
    expect(TOPIC_QUIZZES.length).toBeLessThanOrEqual(6);
    for (const topic of TOPIC_QUIZZES) {
      expect(validateTopic(topic, ctx, routeExists)).toEqual([]);
      expect(playableQuestionIds(topic, ctx)).toHaveLength(topic.questions.length);
    }
  });

  it('unique ids; topic-only questions never collide with the shared bank', () => {
    const all = [...QUESTION_BANK, ...TOPIC_QUESTIONS].map((question) => question.id);
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(TOPIC_QUIZZES.map((topic) => topic.id)).size).toBe(TOPIC_QUIZZES.length);
  });

  it('rejects: missing source, wrong field type, unknown question, bad choices, missing translation', () => {
    const ref = TOPIC_QUIZZES[0].questions[0];
    expect(validateTopicQuestion(ref, { ...ctx, contentField: () => null })).toContainEqual(expect.stringContaining('missing'));
    expect(validateTopicQuestion({ ...ref, sourceField: 'body' }, ctx)).toContainEqual(expect.stringContaining('does not fit'));
    expect(validateTopicQuestion({ questionId: 'nope', sourceField: 'history' }, ctx)).toEqual(['nope: unknown question']);
    const broken = { ...getQuestion('tq-kaz-moyun')!, options: [{ id: 'goose' }, { id: 'goose' }, { id: 'ram' }], correctOptionId: 'dog' };
    const problems = validateTopicQuestion({ questionId: 'tq-kaz-moyun', sourceField: 'cultural_meaning' }, { ...ctx, getQuestion: () => broken });
    expect(problems).toEqual(expect.arrayContaining([expect.stringContaining('duplicate choices'), expect.stringContaining('correct answer not in choices')]));
    const five = { ...getQuestion('tq-kaz-moyun')!, options: ['a', 'b', 'c', 'd', 'goose'].map((id) => ({ id })) };
    expect(validateTopicQuestion({ questionId: 'x', sourceField: 'cultural_meaning' }, { ...ctx, getQuestion: () => five })).toContainEqual(expect.stringContaining('2-4 choices'));
    expect(validateTopicQuestion(ref, { ...ctx, hasKey: () => false })).toContainEqual(expect.stringContaining('missing challenges.questions'));
    // An invalid question is never playable; unknown content (offline) keeps bundled questions.
    expect(playableQuestionIds(TOPIC_QUIZZES[0], { ...ctx, contentField: () => null })).toEqual([]);
    expect(playableQuestionIds(TOPIC_QUIZZES[0], { ...ctx, contentField: () => undefined })).toHaveLength(TOPIC_QUIZZES[0].questions.length);
  });

  it('every playable question has 2-4 choices and KG/RU/EN text for question, explanation and options', () => {
    for (const topic of TOPIC_QUIZZES)
      for (const ref of topic.questions) {
        const question = getQuestion(ref.questionId)!;
        expect(question.options.length).toBeGreaterThanOrEqual(2);
        expect(question.options.length).toBeLessThanOrEqual(4);
        expect(hasAll(`challenges.questions.${question.id}.explanation`)).toBe(true);
      }
    for (const topic of TOPIC_QUIZZES) for (const key of [topic.titleKey, topic.descriptionKey]) expect(hasAll(key)).toBe(true);
    for (const key of ['title', 'testWhatYouLearned', 'result', 'reviewMistakes', 'readAgain', 'done', 'retake']) expect(hasAll(`topicQuiz.${key}`)).toBe(true);
  });
});

describe('Culture Topic Quizzes - engine reuse', () => {
  const boz = TOPIC_QUIZZES.find((topic) => topic.id === 'boz-uy')!;

  it('right and wrong answers are scored by the shared scorer', () => {
    const [a, b] = boz.questions.map((ref) => getQuestion(ref.questionId)!);
    const score = scoreAnswers([{ questionId: a.id, optionId: a.correctOptionId }, { questionId: b.id, optionId: b.options.find((o) => o.id !== b.correctOptionId)!.id }]);
    expect(score).toEqual({ correct: 1, total: 2 });
    // Topic-only questions (outside the shared bank) score correctly too.
    expect(scoreAnswers([{ questionId: 'tq-kaz-moyun', optionId: 'goose' }, { questionId: 'tq-teke-muyuz', optionId: 'umai' }])).toEqual({ correct: 1, total: 2 });
  });

  it('wrong answers enter the EXISTING mistake queue and point back to the exact source + topic', () => {
    const questions = ['tq-kaz-moyun', 'tq-teke-muyuz'].map((id) => getQuestion(id)!);
    const wrong = wrongIdsOf(questions, [{ questionId: 'tq-kaz-moyun', optionId: 'ram' }, { questionId: 'tq-teke-muyuz', optionId: 'kochkor' }]);
    expect(wrong).toEqual(['tq-kaz-moyun']);
    const data = recordFinishedAttempt(EMPTY_MISTAKES, wrong, new Date('2026-10-04T08:00:00Z'));
    expect(reviewQueue(data, questionExists).map((record) => record.questionId)).toEqual(['tq-kaz-moyun']);
    expect(routeForSource(getQuestion('tq-kaz-moyun')!)).toBe('/culture/item/oymo-kaz-moyun');
    expect(topicForQuestion('tq-kaz-moyun')?.id).toBe('ornament');
  });

  it('Daily Challenge isolation: topic-only questions are never picked, result key is separate', () => {
    for (let day = 1; day <= 60; day += 1) {
      const ids = pickDailyQuestionIds(`2026-11-${String((day % 28) + 1).padStart(2, '0')}`, 10);
      expect(ids.some((id) => id.startsWith('tq-'))).toBe(false);
    }
    expect(topicResultKey('komuz')).toBe('topic:komuz');
    expect(topicFromChallengeId('topic-komuz')?.id).toBe('komuz');
    expect(topicFromChallengeId('daily')).toBeNull();
    expect(topicFromChallengeId('topic-nope')).toBeNull();
    // The route only runs known topics (unknown ids show Not found, never the Journey Challenge).
    expect(fs.readFileSync(path.join(root, 'src/app/challenges/[challengeId].tsx'), 'utf8')).toContain("if (challengeId.startsWith('topic-')) return !!topicFromChallengeId(challengeId);");
    const run = fs.readFileSync(path.join(root, 'src/features/challenges/ChallengeRunScreen.tsx'), 'utf8');
    expect(run).toMatch(/const resultKey = topic\s*\?\s*topicResultKey\(topic\.id\)/);
  });

  it('deterministic order: first attempt = authored order, retakes reorder reproducibly; children get 4', () => {
    const first = topicQuestionIds(boz, ctx, 0, 'adult');
    expect(first).toEqual(boz.questions.map((ref) => ref.questionId));
    expect(topicQuestionIds(boz, ctx, 3, 'adult')).toEqual(topicQuestionIds(boz, ctx, 3, 'adult'));
    expect([...topicQuestionIds(boz, ctx, 3, 'adult')].sort()).toEqual([...first].sort());
    expect(topicQuestionIds(boz, ctx, 2, 'child')).toHaveLength(4);
  });

  it('works offline: questions are bundled (no network needed to build a quiz)', () => {
    for (const topic of TOPIC_QUIZZES) expect(topicQuestionIds(topic, { getQuestion, hasKey: hasAll }, 0, 'teen').length).toBeGreaterThanOrEqual(4);
  });

  it('Weekly Goal: one finished quiz = one challenge event, retakes and questions never double count', () => {
    let result = recordCompletion(undefined, 3, 6, '2026-10-05T10:00:00.000Z');
    result = recordCompletion(result, 5, 6, '2026-10-05T11:00:00.000Z');
    const events = collectActivityEvents({ readings: [], challengeResults: { [topicResultKey('boz-uy')]: result }, glossarySessions: [], manualPathSteps: {}, gameSessions: [] });
    expect(events.filter((event) => event.kind === 'challenge')).toHaveLength(1);
  });

  it('only shows "Test what you learned" for content a quiz really covers', () => {
    expect(topicsForContent('culture_item', 'oymo-kaz-moyun', getQuestion).map((topic) => topic.id)).toEqual(['ornament']);
    expect(topicsForContent('culture_material', 'komuz-discovery', getQuestion).map((topic) => topic.id)).toEqual(['komuz']);
    expect(topicsForContent('culture_item', 'food-boorsok', getQuestion)).toEqual([]);
  });

  it('Learning Path steps may point at a topic quiz (explicitly), none is auto-inserted', () => {
    expect(challengeResultKey('topic-komuz')).toBe('topic:komuz');
    const paths = fs.readFileSync(path.join(root, 'src/features/learn/learningPaths.ts'), 'utf8');
    expect(paths).not.toMatch(/targetId: 'topic-/);
  });

  it('analytics: only topic_id and question_count', () => {
    const run = fs.readFileSync(path.join(root, 'src/features/challenges/ChallengeRunScreen.tsx'), 'utf8');
    expect(run).toContain("track('topic_quiz_started', { topic_id: topic.id, question_count: questions.length })");
    expect(run).toContain("track('topic_quiz_completed', { topic_id: topic.id, question_count: score.total })");
    expect(fs.readFileSync(path.join(root, 'src/services/analytics/analytics.ts'), 'utf8')).toContain("'topic_quiz_completed'");
  });

  it('server accepts topic: result keys (migration committed)', () => {
    const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261004000001_topic_quiz_results.sql'), 'utf8');
    expect(sql.match(/topic:\[a-z0-9-\]\{1,60\}/g)).toHaveLength(2);
  });
});
