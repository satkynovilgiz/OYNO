import * as THREE from 'three';

import { arrowPositionAt, getTargetCenter, resolveImpact } from './JaaAtuuBallistics';
import { JAA_ATUU_DIFFICULTY } from './JaaAtuuTypes';

const NORMAL = JAA_ATUU_DIFFICULTY.normal;

describe('JaaAtuuBallistics', () => {
  it('resolveImpact scores a dead-center hit as 100', () => {
    const targetCenter = getTargetCenter(NORMAL);
    const impact = resolveImpact(targetCenter.clone(), targetCenter);
    expect(impact.ring).toBe('center');
    expect(impact.score).toBe(100);
  });

  it('resolveImpact returns a miss outside every ring radius', () => {
    const targetCenter = getTargetCenter(NORMAL);
    const farPoint = targetCenter.clone().add(new THREE.Vector3(5, 0, 0));
    const impact = resolveImpact(farPoint, targetCenter);
    expect(impact.ring).toBeNull();
    expect(impact.score).toBe(0);
  });

  it('a straight, full-power shot (aimX=0, aimY=0, power=1) lands close to the target height at the target distance', () => {
    // Walk the analytic trajectory forward until it reaches the target's
    // z-plane, then check it lands near the target's vertical center -
    // this is what makes a "straight" shot feel fair (Section 24).
    const targetCenter = getTargetCenter(NORMAL);
    const shot = { aimX: 0, aimY: 0, power: 1 };
    let t = 0;
    let position = arrowPositionAt(shot, t, NORMAL);
    while (position.z > targetCenter.z && t < 4) {
      t += 1 / 60;
      position = arrowPositionAt(shot, t, NORMAL);
    }
    expect(Math.abs(position.y - targetCenter.y)).toBeLessThan(0.3);
  });

  it('every difficulty preset produces a solvable straight-shot arc (no NaN) at full power', () => {
    for (const config of Object.values(JAA_ATUU_DIFFICULTY)) {
      const targetCenter = getTargetCenter(config);
      const shot = { aimX: 0, aimY: 0, power: 1 };
      let t = 0;
      let position = arrowPositionAt(shot, t, config);
      while (position.z > targetCenter.z && position.y > 0 && t < 4) {
        t += 1 / 60;
        position = arrowPositionAt(shot, t, config);
      }
      expect(Number.isFinite(position.z)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
    }
  });

  it('a low-power shot still produces finite motion (either reaches the target or falls short)', () => {
    const targetCenter = getTargetCenter(NORMAL);
    const shot = { aimX: 0, aimY: 0, power: 0.15 };
    let t = 0;
    let position = arrowPositionAt(shot, t, NORMAL);
    while (position.z > targetCenter.z && position.y > 0 && t < 4) {
      t += 1 / 60;
      position = arrowPositionAt(shot, t, NORMAL);
    }
    expect(Number.isFinite(position.z)).toBe(true);
  });
});
