import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { EMPTY_RECORDS, recordInto } from '@/store/useGameRecordsStore';
import { ownerMissions, usePracticeMissionsStore } from '@/store/usePracticeMissionsStore';

import { COACH_RULES } from '../coach/gameCoach';
import { COACH_TIP_MISSION, evaluatePracticeMission, missionById, missionsFor, PRACTICE_MISSIONS, validateMissions, type PracticeRoundResult } from './practiceMissions';

const root = path.join(__dirname, '../../../..');
const round = (gameId: string, metrics: Record<string, number>, fields: Partial<PracticeRoundResult> = {}): PracticeRoundResult => ({ gameId, practice: true, finished: true, metrics, ...fields });

describe('Game Practice Academy', () => {
  it('missions are valid: known metrics, targets inside the real ranges, 2-4 per supported game', () => {
    expect(validateMissions(PRACTICE_MISSIONS)).toEqual([]);
    expect(missionsFor('jaa_atuu')).toHaveLength(3);
    expect(missionsFor('kyz_kuumai')).toHaveLength(2);
    expect(missionsFor('kok_boru')).toHaveLength(2);
    // Ordo / Chuko practice never reaches a result -> no missions.
    expect(missionsFor('ordo')).toEqual([]);
    expect(missionsFor('chuko')).toEqual([]);
    expect(validateMissions([...PRACTICE_MISSIONS, { ...PRACTICE_MISSIONS[0], id: 'x', target: 150 }])).toContain('x: target out of range');
  });

  describe.each(PRACTICE_MISSIONS.map((mission) => [mission.id, mission] as const))('%s', (_id, mission) => {
    const metrics = (value: number) => ({ [mission.metric]: value });
    const below = mission.comparison === 'gte' ? mission.target - 1 : mission.target + 1;
    const beyond = mission.comparison === 'gte' ? mission.target + 1 : mission.target - 1;
    it('exact target boundary counts', () => expect(evaluatePracticeMission(mission, round(mission.gameId, metrics(mission.target))).completed).toBe(true));
    it('short of the target does not', () => {
      const result = evaluatePracticeMission(mission, round(mission.gameId, metrics(below)));
      expect(result).toMatchObject({ completed: false, actual: below, target: mission.target });
      expect(result.progress).toBeLessThan(1);
    });
    it('beyond the target counts (correct comparison)', () => expect(evaluatePracticeMission(mission, round(mission.gameId, metrics(beyond))).completed).toBe(true));
    it('another game’s result, a normal round, or a missing metric is rejected', () => {
      expect(evaluatePracticeMission(mission, round('ordo', metrics(mission.target))).completed).toBe(false);
      expect(evaluatePracticeMission(mission, round(mission.gameId, metrics(mission.target), { practice: false })).completed).toBe(false);
      expect(evaluatePracticeMission(mission, round(mission.gameId, {})).completed).toBe(false);
    });
    it('an abandoned round is ignored', () => {
      expect(evaluatePracticeMission(mission, round(mission.gameId, metrics(mission.target), { finished: false })).completed).toBe(false);
      expect(evaluatePracticeMission(mission, null).completed).toBe(false);
    });
  });

  it('missions are evaluated only from the RESULT phase (quitting never counts)', () => {
    for (const game of ['jaa-atuu/JaaAtuuGame.tsx', 'kyz-kuumai/KyzKuumaiGame.tsx', 'kok-boru/KokBoruGame.tsx']) {
      const source = fs.readFileSync(path.join(root, 'src/games3d/games', game), 'utf8');
      const effect = source.slice(source.indexOf("if (game.phase !== 'RESULT'"), source.indexOf('practice.finishRound(') + 40);
      expect(effect).toMatch(/practice\.finishRound\(/);
      expect(source.match(/practice\.finishRound\(/g)).toHaveLength(1);
    }
  });

  it('PB safety: mission rounds stay practice and never become a best', () => {
    const { records } = recordInto(EMPTY_RECORDS, { id: 'p', gameId: 'jaa_atuu', completedAt: '2026-10-04T10:00:00Z', practice: true, result: 'completed', primary: 1400, secondary: {} });
    expect(records.best.jaa_atuu).toBeUndefined();
    const hook = fs.readFileSync(path.join(__dirname, 'usePracticeMission.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    expect(hook).not.toMatch(/recordRound|useGameRecordsStore|friendChallenge|useProgressStore/);
  });

  it('owner storage: completion ids + time only; guest kept locally, adopted on sign-in, no A -> B leak; duplicates safe', () => {
    usePracticeMissionsStore.setState({ saved: {}, isLoaded: true });
    const store = usePracticeMissionsStore.getState();
    store.complete('guest', 'jaa_one_bullseye');
    store.complete('guest', 'jaa_one_bullseye');
    store.complete('guest', 'not-a-mission');
    expect(Object.keys(ownerMissions(usePracticeMissionsStore.getState().saved, 'guest'))).toEqual(['jaa_one_bullseye']);
    usePracticeMissionsStore.getState().adoptGuest('user-a');
    expect(Object.keys(ownerMissions(usePracticeMissionsStore.getState().saved, 'user-a'))).toEqual(['jaa_one_bullseye']);
    expect(ownerMissions(usePracticeMissionsStore.getState().saved, 'guest')).toEqual({});
    expect(ownerMissions(usePracticeMissionsStore.getState().saved, 'user-b')).toEqual({});
    usePracticeMissionsStore.getState().reset('user-a');
    expect(ownerMissions(usePracticeMissionsStore.getState().saved, 'user-a')).toEqual({});
    const lifecycle = fs.readFileSync(path.join(root, 'src/services/sync/accountLifecycle.ts'), 'utf8');
    expect(lifecycle).toMatch(/usePracticeMissionsStore\.getState\(\)\.adoptGuest\(userId\)/);
  });

  it('Game Coach links to a matching mission (explicit mapping, never auto-completes)', () => {
    const tipIds = COACH_RULES.map((rule) => rule.tipId);
    for (const [tip, missionId] of Object.entries(COACH_TIP_MISSION)) {
      expect(tipIds).toContain(tip);
      const mission = missionById(missionId)!;
      expect(COACH_RULES.find((rule) => rule.tipId === tip)!.gameId).toBe(mission.gameId);
    }
    const card = fs.readFileSync(path.join(__dirname, '../coach/GameCoachCard.tsx'), 'utf8');
    expect(card).not.toMatch(/complete\(/);
  });

  it('no rewards, no failure copy', () => {
    const files = ['practiceMissions.ts', 'usePracticeMission.ts', 'PracticePicker.tsx'].map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8')).join('\n');
    expect(files).not.toMatch(/addXp|coins|reward|leaderboard/i);
    for (const dict of [en, ru, kg]) expect(JSON.stringify((dict as unknown as { practiceAcademy: unknown }).practiceAcademy)).not.toMatch(/failed|poor|\bbad\b|провал|плохо/i);
  });

  it('KG / RU / EN', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { practiceAcademy: Record<string, unknown> }).practiceAcademy;
      for (const key of ['practiceGoals', 'chooseGoal', 'freePractice', 'goal', 'goalCompleted', 'yourProgress', 'tryAgain', 'chooseAnother', 'completedCount', 'reset']) expect(block[key]).toBeTruthy();
      for (const mission of PRACTICE_MISSIONS) expect((block.missions as Record<string, { title: string; description: string }>)[mission.id].title).toBeTruthy();
    }
  });
});
