/**
 * 3D game performance baseline + lifecycle checks (Node/Jest - no GPU).
 * These verify the MEASUREMENT method and the lifecycle fixes; they are not
 * device performance numbers (see docs/3D_GAMES.md "Performance baseline").
 */
import { createElement } from 'react';
import { act, create } from 'react-test-renderer';

import { scheduleCountdown } from '../ui/countdownSchedule';
import { FrameRecorder, median, percentileNearestRank, summarizeFrames } from './frameStats';

const mockSubscriptions = new Set<{ remove: () => void }>();
const mockListeners: ((state: string) => void)[] = [];
jest.mock('expo-screen-orientation', () => ({ lockAsync: jest.fn(async () => undefined), OrientationLock: { LANDSCAPE: 1, PORTRAIT_UP: 2 } }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AppState } = require('react-native') as typeof import('react-native');
// Count real subscriptions through the real AppState API.
jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, listener: (state: string) => void) => {
  mockListeners.push(listener);
  const subscription = {
    remove: () => {
      mockSubscriptions.delete(subscription);
      mockListeners.splice(mockListeners.indexOf(listener), 1);
    },
  };
  mockSubscriptions.add(subscription);
  return subscription;
}) as never);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useGameLifecycle } = require('./useGameLifecycle') as typeof import('./useGameLifecycle');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useLazyRef } = require('./useLazyRef') as typeof import('./useLazyRef');

describe('frame statistics method', () => {
  it('median and nearest-rank p95 on known data', () => {
    const sorted = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20
    expect(median(sorted)).toBe(10.5);
    expect(percentileNearestRank(sorted, 95)).toBe(19); // rank ceil(0.95*20)=19
    expect(median([5])).toBe(5);
    expect(percentileNearestRank([], 95)).toBeNull();
    expect(summarizeFrames([])).toEqual({ frames: 0, medianMs: null, p95Ms: null, maxMs: null });
  });

  it('records only active gameplay; the first frame after each (re)activation is dropped', () => {
    const recorder = new FrameRecorder();
    recorder.frame(1 / 60); // loading - inactive
    recorder.setActive(true);
    recorder.frame(5); // first frame after activation: spans the inactive time -> dropped
    for (let i = 0; i < 10; i += 1) recorder.frame(0.016);
    recorder.setActive(false); // pause
    recorder.frame(0.5); // nothing recorded while paused
    recorder.setActive(true); // resume
    recorder.frame(120); // background/pause gap -> dropped
    recorder.frame(0.02);
    const summary = recorder.summary();
    expect(summary.frames).toBe(11);
    expect(summary.medianMs).toBe(16);
    expect(summary.p95Ms).toBe(20);
    expect(summary.maxMs).toBe(20);
  });

  it('ignores invalid deltas and keeps a bounded window (newest samples)', () => {
    const recorder = new FrameRecorder(5);
    recorder.setActive(true);
    recorder.frame(0.01); // dropped (first)
    for (const delta of [Number.NaN, 0, -1, Infinity]) recorder.frame(delta);
    for (let i = 1; i <= 8; i += 1) recorder.frame(i / 1000);
    expect(recorder.summary()).toMatchObject({ frames: 5, medianMs: 6, maxMs: 8 });
  });

  it('is reproducible: the same frame sequence gives the same summary', () => {
    const run = () => {
      const recorder = new FrameRecorder();
      recorder.setActive(true);
      for (let i = 0; i < 600; i += 1) recorder.frame((16 + (i % 7)) / 1000);
      return recorder.summary();
    };
    expect(run()).toEqual(run());
  });
});

describe('countdown timers (lifecycle fix)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('runs 3-2-1-GO and calls onDone once', () => {
    const steps: number[] = [];
    const done = jest.fn();
    scheduleCountdown(4, 650, (i) => steps.push(i), done);
    jest.advanceTimersByTime(650 * 5);
    expect(steps).toEqual([0, 1, 2, 3]);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('pausing or exiting during the LAST step never fires onDone afterwards', () => {
    const done = jest.fn();
    const cancel = scheduleCountdown(4, 650, () => undefined, done);
    jest.advanceTimersByTime(650 * 3 + 10); // "GO" shown, onDone pending
    cancel();
    jest.advanceTimersByTime(5000);
    expect(done).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cancelling mid-way stops further steps', () => {
    const steps: number[] = [];
    const cancel = scheduleCountdown(4, 650, (i) => steps.push(i), jest.fn());
    jest.advanceTimersByTime(700);
    cancel();
    jest.advanceTimersByTime(5000);
    expect(steps).toEqual([0, 1]);
  });
});

describe('game lifecycle: exit and reopen does not accumulate listeners', () => {
  function Host({ onBackground }: { onBackground: () => void }) {
    useGameLifecycle('landscape', onBackground);
    return null;
  }

  it('one AppState listener per mounted game; none left after exit, across repeated reopen', () => {
    const onBackground = jest.fn();
    for (let round = 0; round < 5; round += 1) {
      let renderer!: ReturnType<typeof create>;
      act(() => {
        renderer = create(createElement(Host, { onBackground }));
      });
      expect(mockSubscriptions.size).toBe(1);
      act(() => renderer.unmount());
      expect(mockSubscriptions.size).toBe(0);
    }
  });

  it('backgrounding pauses exactly once; returning does not resume or add a second loop', () => {
    const onBackground = jest.fn();
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(createElement(Host, { onBackground }));
    });
    act(() => mockListeners.forEach((listener) => listener('background')));
    act(() => mockListeners.forEach((listener) => listener('active')));
    expect(onBackground).toHaveBeenCalledTimes(1);
    expect(mockSubscriptions.size).toBe(1);
    act(() => renderer.unmount());
  });

  it('per-game audio managers are created once per game screen, not per render', () => {
    const factory = jest.fn(() => ({ id: Math.random() }));
    const seen: unknown[] = [];
    function AudioHost({ tick }: { tick: number }) {
      const ref = useLazyRef(factory);
      seen.push(ref.current);
      return tick > -1 ? null : null;
    }
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(createElement(AudioHost, { tick: 0 }));
    });
    for (let tick = 1; tick < 5; tick += 1) act(() => renderer.update(createElement(AudioHost, { tick })));
    expect(factory).toHaveBeenCalledTimes(1);
    expect(new Set(seen).size).toBe(1);
    act(() => renderer.unmount());
  });
});
