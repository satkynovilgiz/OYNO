import * as THREE from 'three';

import { arrowPositionAt, getTargetCenter, MAX_FLIGHT_SECONDS, resolveFlight, resolveImpact } from './JaaAtuuBallistics';
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

  describe('resolveFlight (exact impact, frame-rate independent)', () => {
    it('ends exactly on the target plane and scores that exact point', () => {
      const targetCenter = getTargetCenter(NORMAL);
      const flight = resolveFlight({ aimX: 0, aimY: 0, power: 1 }, NORMAL);
      expect(flight.endPoint.z).toBeCloseTo(targetCenter.z, 6);
      expect(flight.impact).toEqual(resolveImpact(flight.endPoint, targetCenter));
      expect(flight.impact.ring).not.toBeNull();
    });

    it('is deterministic and needs no frame stepping: impact = the arc at the solved plane time', () => {
      const shot = { aimX: 0.12, aimY: -0.05, power: 0.9 };
      const flight = resolveFlight(shot, NORMAL);
      expect(resolveFlight(shot, NORMAL)).toEqual(flight);
      const onArc = arrowPositionAt(shot, flight.endTime, NORMAL);
      expect(onArc.distanceTo(flight.endPoint)).toBeLessThan(1e-9);
      // Just before the solved time the arrow has not reached the target yet.
      expect(arrowPositionAt(shot, flight.endTime - 1e-3, NORMAL).z).toBeGreaterThan(getTargetCenter(NORMAL).z);
    });

    it('a weak shot that lands short is a ground miss with no score', () => {
      const flight = resolveFlight({ aimX: 0, aimY: -1, power: 0 }, JAA_ATUU_DIFFICULTY.hard);
      expect(flight.impact).toEqual({ ring: null, score: 0, hitOffset: null });
      expect(flight.endPoint.y).toBeCloseTo(0, 5);
      expect(flight.endTime).toBeLessThanOrEqual(MAX_FLIGHT_SECONDS);
    });

    it('a wide shot crosses the plane outside every ring = miss', () => {
      const flight = resolveFlight({ aimX: 1, aimY: 0, power: 1 }, NORMAL);
      expect(flight.impact.ring).toBeNull();
      expect(flight.impact.score).toBe(0);
    });
  });
});
