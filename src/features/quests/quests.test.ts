import * as fs from 'fs';
import * as path from 'path';

import { ALL_CHARACTER_IDS, CHARACTERS_WITH_FULL_SHEET } from '@/components/character/characterAssets';
import { getCollection } from '@/features/collections/collectionsData';
import { collectionQuestionIds } from '@/features/challenges/challengeLogic';
import { routeForInteractiveExperience } from '@/features/culture/interactiveExperiences';
import { USER_SCOPED_QUERY_ROOTS } from '@/services/auth/userScopedCache';

import { computeQuestProgress, groupQuests, isQuestStepDone, pickActiveQuest, type QuestSignals } from './questProgress';
import { getGuidedQuest, GUIDED_QUESTS, questStepRoute, serverTargetId } from './questsData';

jest.mock('@/store/useAuthStore', () => ({ useAuthStore: { getState: () => ({ status: 'guest', user: null }), subscribe: () => () => {} } }));

const ROOT = path.join(__dirname, '../../..');
const NONE: QuestSignals = { completionFlags: { bozUyVisited: false, oymoCreated: false, shyrdakCreated: false, komuzLessonCompleted: false }, gameStats: {}, visitedRegionIds: [], completedChallengeKeys: [] };
const signals = (patch: Partial<QuestSignals>): QuestSignals => ({ ...NONE, ...patch, completionFlags: { ...NONE.completionFlags, ...(patch.completionFlags ?? {}) } });

describe('guided quest content', () => {
  it('every quest is localized in KG/RU/EN, 3-4 steps, with an available guide', () => {
    for (const quest of GUIDED_QUESTS) {
      for (const text of [quest.title, quest.theme, quest.intro, quest.completion, ...quest.steps.flatMap((step) => [step.instruction, step.short])]) {
        for (const lang of ['kg', 'ru', 'en'] as const) expect(text[lang]?.trim()).toBeTruthy();
      }
      expect(quest.steps.length).toBeGreaterThanOrEqual(3);
      expect(quest.steps.length).toBeLessThanOrEqual(4);
      expect(CHARACTERS_WITH_FULL_SHEET).toContain(quest.guide);
    }
    // Бөрү / Тулпар / Элчи (no complete art) are never quest guides.
    const unavailable = ALL_CHARACTER_IDS.filter((id) => !CHARACTERS_WITH_FULL_SHEET.includes(id));
    for (const quest of GUIDED_QUESTS) expect(unavailable).not.toContain(quest.guide);
  });

  it('every step deep-links to a real, existing screen and target', () => {
    for (const quest of GUIDED_QUESTS) {
      for (const step of quest.steps) {
        const route = questStepRoute(step);
        expect(route).toBeTruthy();
        if (step.type === 'complete_interactive') expect(routeForInteractiveExperience(step.targetId)).toBe(route);
        if (step.type === 'complete_challenge' && step.targetId.startsWith('collection:')) {
          const collection = getCollection(step.targetId.slice('collection:'.length));
          expect(collection).toBeDefined();
          expect(collectionQuestionIds(collection!).length).toBeGreaterThan(0);
        }
        if (step.type === 'explore_destination') expect(fs.existsSync(path.join(ROOT, `content/explore/${step.targetId}.md`))).toBe(true);
      }
    }
  });

  it('app steps and the server reward requirements are identical', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260927000004_guided_quests.sql'), 'utf8');
    const serverRows = [...sql.matchAll(/\('([a-z-]+)', (\d+), '([a-z_]+)', '([^']+)'\)/g)].map(([, quest, order, type, target]) => `${quest}|${order}|${type}|${target}`);
    const appRows = GUIDED_QUESTS.flatMap((quest) => quest.steps.map((step, index) => `${quest.id}|${index + 1}|${step.type}|${serverTargetId(step)}`));
    expect(serverRows.sort()).toEqual(appRows.sort());
    for (const quest of GUIDED_QUESTS) expect(sql).toContain(`('${quest.id}', ${quest.reward.xp}, ${quest.reward.coins})`);
  });
});

describe('progress from real signals only', () => {
  const horse = getGuidedQuest('horse-games')!;

  it('matches each step type to its real signal', () => {
    const [kokBoru, kyzKuumai, challenge] = horse.steps;
    // Games record snake_case ids (kok_boru) - the step still matches.
    expect(isQuestStepDone(kokBoru, signals({ gameStats: { kok_boru: { played: 1, won: 0 } } }))).toBe(true);
    expect(isQuestStepDone(kyzKuumai, signals({ gameStats: { kok_boru: { played: 1, won: 0 } } }))).toBe(false);
    expect(isQuestStepDone(challenge, signals({ completedChallengeKeys: ['collection:horse-culture'] }))).toBe(true);
    expect(isQuestStepDone(getGuidedQuest('mountain-journey')!.steps[0], signals({ visitedRegionIds: ['son-kol'] }))).toBe(true);
    expect(isQuestStepDone(getGuidedQuest('craft-and-ornament')!.steps[0], signals({ completionFlags: { oymoCreated: true } as never }))).toBe(true);
  });

  it('a started challenge that was never finished does not count', () => {
    expect(isQuestStepDone(horse.steps[2], signals({ completedChallengeKeys: [] }))).toBe(false);
  });

  it('sequential path: done steps stay done, first missing is current, the rest upcoming', () => {
    const progress = computeQuestProgress(horse, signals({ gameStats: { kyz_kuumai: { played: 2, won: 0 } } }));
    expect(progress.steps.map((entry) => entry.state)).toEqual(['current', 'completed', 'upcoming']);
    expect(progress).toMatchObject({ completed: 1, total: 3, status: 'active' });
    expect(progress.currentStep).toBe(horse.steps[0]);
  });

  it('completes only when every step is done', () => {
    const all = signals({ gameStats: { kok_boru: { played: 1, won: 0 }, kyz_kuumai: { played: 1, won: 0 } }, completedChallengeKeys: ['collection:horse-culture'] });
    const progress = computeQuestProgress(horse, all);
    expect(progress.status).toBe('completed');
    expect(progress.currentStep).toBeNull();
  });

  it('one clear active quest; hub groups Continue / Available / Completed', () => {
    const state = signals({ completionFlags: { oymoCreated: true, shyrdakCreated: true } as never, visitedRegionIds: ['son-kol'] });
    const all = GUIDED_QUESTS.map((quest) => computeQuestProgress(quest, state));
    expect(pickActiveQuest(all)?.quest.id).toBe('craft-and-ornament');
    const grouped = groupQuests(all);
    expect(grouped.active?.quest.id).toBe('craft-and-ornament');
    expect(grouped.available.map((entry) => entry.quest.id)).not.toContain('craft-and-ornament');
    expect(grouped.completed).toEqual([]);
  });

  it('account switch: a fresh account has no quest progress, and claimed rewards are user-scoped cache', () => {
    const fresh = GUIDED_QUESTS.map((quest) => computeQuestProgress(quest, NONE));
    expect(fresh.every((entry) => entry.status === 'notStarted')).toBe(true);
    expect(USER_SCOPED_QUERY_ROOTS).toContain('guided_quests_claimed');
  });

  it('offline: progress is computed from locally loaded state alone (no network in the model)', () => {
    const source = fs.readFileSync(path.join(__dirname, 'questProgress.ts'), 'utf8');
    expect(source).not.toMatch(/supabase|fetch\(/);
  });

  it('unknown quest id resolves to nothing (screen shows Not Found)', () => {
    expect(getGuidedQuest('does-not-exist')).toBeUndefined();
  });
});

describe('reward is granted once, server-verified', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260927000004_guided_quests.sql'), 'utf8');

  it('dedupes per account and re-checks every step before paying', () => {
    expect(sql).toMatch(/primary key \(user_id, quest_id\)/);
    expect(sql).toMatch(/alreadyClaimed/);
    expect(sql).toMatch(/not public\.guided_quest_step_done/);
    expect(sql).toMatch(/perform public\.apply_reward\(v_user_id, v_reward\.xp, v_reward\.coins, 'guided_quest', p_quest_id\)/);
  });

  it('the internal step checker cannot be called by clients', () => {
    expect(sql).toMatch(/revoke execute on function public\.guided_quest_step_done\(uuid, text, text\) from public, anon, authenticated/);
  });
});
