export type TrackPoint = { x: number; z: number };

/** One polished course (Section 39: "do not create an open world"),
 * a gentle S-curve down the jailoo. Checkpoints are named waypoints along
 * it (Section "KYZ KUUMAI — TRACK": ordered checkpoints, not a raw finish
 * line you can cut across to). */
export const TRACK_WAYPOINTS: TrackPoint[] = [
  { x: 0, z: 0 }, // START
  { x: 2.5, z: -18 }, // CHECKPOINT_1
  { x: -2, z: -36 }, // CHECKPOINT_2
  { x: 1.5, z: -54 }, // CHECKPOINT_3
  { x: 0, z: -70 }, // FINISH
];

export const START_POSITION: TrackPoint = TRACK_WAYPOINTS[0];
export const FINISH_POSITION: TrackPoint = TRACK_WAYPOINTS[TRACK_WAYPOINTS.length - 1];

function segmentLength(a: TrackPoint, b: TrackPoint): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

export const TRACK_TOTAL_LENGTH = TRACK_WAYPOINTS.reduce(
  (sum, point, i) => (i === 0 ? 0 : sum + segmentLength(TRACK_WAYPOINTS[i - 1], point)),
  0,
);

/**
 * Arc-length distance along the track of the closest point on the track to
 * `position` - used for checkpoint/finish progress instead of raw world Z
 * (Section "KYZ KUUMAI — DISTANCE SYSTEM": "Do not display meaningless
 * distance based only on world Z coordinate"). Robust to the rider
 * wandering laterally off the ideal line.
 */
export function getTrackProgress(position: TrackPoint): number {
  let bestDistanceSq = Infinity;
  let bestArcLength = 0;
  let cumulative = 0;

  for (let i = 0; i < TRACK_WAYPOINTS.length - 1; i += 1) {
    const a = TRACK_WAYPOINTS[i];
    const b = TRACK_WAYPOINTS[i + 1];
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const segLenSq = abx * abx + abz * abz;
    const segLen = Math.sqrt(segLenSq);

    const apx = position.x - a.x;
    const apz = position.z - a.z;
    const t = segLenSq > 0 ? Math.max(0, Math.min(1, (apx * abx + apz * abz) / segLenSq)) : 0;

    const projX = a.x + abx * t;
    const projZ = a.z + abz * t;
    const dx = position.x - projX;
    const dz = position.z - projZ;
    const distanceSq = dx * dx + dz * dz;

    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestArcLength = cumulative + t * segLen;
    }
    cumulative += segLen;
  }

  return bestArcLength;
}

export function distanceBetween(a: TrackPoint, b: TrackPoint): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Inverse of getTrackProgress - the world point at a given arc-length
 * along the track. Used for AI lookahead steering. */
export function getPointAtProgress(arcLength: number): TrackPoint {
  const clamped = Math.max(0, Math.min(TRACK_TOTAL_LENGTH, arcLength));
  let cumulative = 0;

  for (let i = 0; i < TRACK_WAYPOINTS.length - 1; i += 1) {
    const a = TRACK_WAYPOINTS[i];
    const b = TRACK_WAYPOINTS[i + 1];
    const segLen = segmentLength(a, b);

    if (clamped <= cumulative + segLen || i === TRACK_WAYPOINTS.length - 2) {
      const t = segLen > 0 ? (clamped - cumulative) / segLen : 0;
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    }
    cumulative += segLen;
  }

  return FINISH_POSITION;
}
