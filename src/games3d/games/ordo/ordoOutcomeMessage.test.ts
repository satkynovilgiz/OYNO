import type { OrdoPhysicsPiece } from './OrdoPhysicsWorld';
import { evaluateCaptures } from './OrdoRulesEngine';
import { describeOrdoOutcome } from './ordoOutcomeMessage';

const piece = (id: string, kind: 'regular' | 'khan') => ({ id, kind }) as unknown as OrdoPhysicsPiece;

describe('describeOrdoOutcome (explains the real rules result)', () => {
  it('khan captured legally', () => {
    const outcome = evaluateCaptures([piece('k', 'khan')], 'player', { player: 3, ai: 0 });
    expect(describeOrdoOutcome(outcome, 'player', 3)).toEqual({ key: 'games3d.ordo.outcome.khanCaptured', tone: 'accent' });
    const ai = evaluateCaptures([piece('k', 'khan')], 'ai', { player: 0, ai: 3 });
    expect(describeOrdoOutcome(ai, 'ai', 3).key).toBe('games3d.ordo.outcome.khanCapturedAi');
  });

  it('khan knocked out too early: says it returns and how many pieces are still needed', () => {
    const outcome = evaluateCaptures([piece('r1', 'regular'), piece('k', 'khan')], 'player', { player: 0, ai: 0 });
    expect(outcome.rejectedKhanId).toBe('k');
    expect(describeOrdoOutcome(outcome, 'player', 0)).toEqual({ key: 'games3d.ordo.outcome.khanTooEarly', params: { count: 2 }, tone: 'neutral' });
  });

  it('clearing the third piece announces that the khan is open', () => {
    const outcome = evaluateCaptures([piece('r1', 'regular')], 'player', { player: 2, ai: 0 });
    expect(describeOrdoOutcome(outcome, 'player', 2)).toEqual({ key: 'games3d.ordo.outcome.khanOpen', params: { count: 1 }, tone: 'accent' });
  });

  it('ordinary clears and misses, for both sides', () => {
    const two = evaluateCaptures([piece('r1', 'regular'), piece('r2', 'regular')], 'player', { player: 3, ai: 0 });
    expect(describeOrdoOutcome(two, 'player', 3)).toEqual({ key: 'games3d.ordo.outcome.cleared', params: { count: 2 }, tone: 'accent' });
    expect(describeOrdoOutcome(evaluateCaptures([], 'player', { player: 0, ai: 0 }), 'player', 0).key).toBe('games3d.ordo.outcome.noCapture');
    expect(describeOrdoOutcome(evaluateCaptures([piece('r1', 'regular')], 'ai', { player: 0, ai: 0 }), 'ai', 0).key).toBe('games3d.ordo.outcome.clearedAi');
    expect(describeOrdoOutcome(evaluateCaptures([], 'ai', { player: 0, ai: 0 }), 'ai', 0).key).toBe('games3d.ordo.outcome.noCaptureAi');
  });
});
