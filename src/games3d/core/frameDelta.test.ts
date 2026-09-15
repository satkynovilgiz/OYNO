import { clampFrameDelta, MAX_FRAME_DELTA_S } from './frameDelta';

describe('clampFrameDelta', () => {
  it('passes through a normal 60fps-ish delta unchanged', () => {
    expect(clampFrameDelta(1 / 60)).toBeCloseTo(1 / 60);
  });

  it('passes through a delta right at the ceiling unchanged', () => {
    expect(clampFrameDelta(MAX_FRAME_DELTA_S)).toBe(MAX_FRAME_DELTA_S);
  });

  it('clamps a huge delta (e.g. resuming after a long background/pause) to the ceiling', () => {
    expect(clampFrameDelta(600)).toBe(MAX_FRAME_DELTA_S);
  });

  it('clamps a small but over-ceiling delta (e.g. a dropped-frame stutter)', () => {
    expect(clampFrameDelta(0.2)).toBe(MAX_FRAME_DELTA_S);
  });
});
