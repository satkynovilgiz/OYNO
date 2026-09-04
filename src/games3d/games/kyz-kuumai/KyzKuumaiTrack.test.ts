import { distanceBetween, FINISH_POSITION, getPointAtProgress, getTrackProgress, START_POSITION, TRACK_TOTAL_LENGTH, TRACK_WAYPOINTS } from './KyzKuumaiTrack';

describe('KyzKuumaiTrack', () => {
  it('progress at the start waypoint is ~0', () => {
    expect(getTrackProgress(START_POSITION)).toBeCloseTo(0, 1);
  });

  it('progress at the finish waypoint is ~TRACK_TOTAL_LENGTH', () => {
    expect(getTrackProgress(FINISH_POSITION)).toBeCloseTo(TRACK_TOTAL_LENGTH, 0);
  });

  it('progress increases monotonically for a rider moving straight down the track direction', () => {
    // Sample points with increasingly negative Z (roughly following the
    // course) and check progress never goes backwards.
    let previous = -1;
    for (let z = 0; z >= -70; z -= 5) {
      const progress = getTrackProgress({ x: 0, z });
      expect(progress).toBeGreaterThanOrEqual(previous);
      previous = progress;
    }
  });

  it('a rider standing off to the side still gets a sensible progress value close to the nearest waypoint, not NaN/wildly wrong', () => {
    const nearCheckpoint1 = TRACK_WAYPOINTS[1];
    const progress = getTrackProgress({ x: nearCheckpoint1.x + 3, z: nearCheckpoint1.z });
    expect(Number.isFinite(progress)).toBe(true);
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThan(TRACK_TOTAL_LENGTH);
  });

  it('distanceBetween measures straight-line distance regardless of track shape', () => {
    expect(distanceBetween({ x: 0, z: 0 }, { x: 3, z: 4 })).toBeCloseTo(5);
  });

  it('getPointAtProgress is the inverse of getTrackProgress at the endpoints', () => {
    expect(getPointAtProgress(0)).toEqual(START_POSITION);
    const finish = getPointAtProgress(TRACK_TOTAL_LENGTH);
    expect(finish.x).toBeCloseTo(FINISH_POSITION.x);
    expect(finish.z).toBeCloseTo(FINISH_POSITION.z);
  });

  it('getPointAtProgress round-trips through getTrackProgress for an on-track point', () => {
    const point = getPointAtProgress(TRACK_TOTAL_LENGTH * 0.4);
    const progress = getTrackProgress(point);
    expect(progress).toBeCloseTo(TRACK_TOTAL_LENGTH * 0.4, 1);
  });
});
