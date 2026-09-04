import { evaluateCaptures } from './OrdoRulesEngine';
import type { OrdoPhysicsPiece } from './OrdoPhysicsWorld';

function piece(id: string, kind: 'regular' | 'khan'): OrdoPhysicsPiece {
  return { id, kind, x: 10, z: 0, vx: 0, vz: 0, radius: 0.1, mass: 1, rotation: 0, angularVelocity: 0 };
}

describe('OrdoRulesEngine.evaluateCaptures', () => {
  it('awards 1 point per regular piece captured to the throwing side', () => {
    const outcome = evaluateCaptures([piece('a', 'regular'), piece('b', 'regular')], 'player', { player: 0, ai: 0 });
    expect(outcome.scoreDelta.player).toBe(2);
    expect(outcome.scoreDelta.ai).toBe(0);
    expect(outcome.legalCaptures.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('rejects a khan capture when the throwing side has fewer than 3 prior captures', () => {
    const outcome = evaluateCaptures([piece('khan', 'khan')], 'player', { player: 1, ai: 0 });
    expect(outcome.rejectedKhanId).toBe('khan');
    expect(outcome.khanCapturedBy).toBeNull();
    expect(outcome.legalCaptures).toHaveLength(0);
    expect(outcome.scoreDelta.player).toBe(0);
  });

  it('allows a khan capture once the throwing side has exactly 3 prior captures', () => {
    const outcome = evaluateCaptures([piece('khan', 'khan')], 'player', { player: 3, ai: 0 });
    expect(outcome.rejectedKhanId).toBeNull();
    expect(outcome.khanCapturedBy).toBe('player');
    expect(outcome.scoreDelta.player).toBe(3);
    expect(outcome.scoreDelta.ai).toBe(2);
  });

  it('counts this turn`s own regular captures toward the 3-before-khan threshold', () => {
    // 0 prior captures, but knocks out 3 regular pieces AND the khan in the
    // same throw - should be legal (thrower now has exactly 3).
    const outcome = evaluateCaptures(
      [piece('a', 'regular'), piece('b', 'regular'), piece('c', 'regular'), piece('khan', 'khan')],
      'ai',
      { player: 0, ai: 0 },
    );
    expect(outcome.khanCapturedBy).toBe('ai');
    expect(outcome.scoreDelta.ai).toBe(3 + 3); // 3 regular + khan bonus
    expect(outcome.scoreDelta.player).toBe(2); // khan consolation
  });
});
