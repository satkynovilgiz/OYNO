import { discsOverlap, distanceFromCenter, isDiscSettled, resolveDiscCollision, stepDisc2D, type Disc2D } from '../../physics/disc2D';
import { ORDO_FIELD_RADIUS, ORDO_PIECE_COUNT, type OrdoPieceKind } from './OrdoTypes';

export type OrdoPhysicsPiece = Disc2D & { id: string; kind: OrdoPieceKind };

const REGULAR_RADIUS = 0.16;
const KHAN_RADIUS = 0.22;
const STRIKER_RADIUS = 0.18;
const STRIKER_LAUNCH_DISTANCE = ORDO_FIELD_RADIUS + 1.5;
const MIN_LAUNCH_SPEED = 3;
const MAX_LAUNCH_SPEED = 9;
const DISC_CONFIG = { friction: 1.1, angularFriction: 2.2, restitution: 0.35 };

/** Shared with the aim indicator (OrdoScene) so it points from exactly
 * where the striker will actually spawn, instead of duplicating these
 * constants. */
export function getLaunchPosition(angleOffset: number): { x: number; z: number } {
  const baseAngle = Math.PI;
  const launchAngle = baseAngle + angleOffset;
  return {
    x: Math.sin(launchAngle) * STRIKER_LAUNCH_DISTANCE,
    z: Math.cos(launchAngle) * STRIKER_LAUNCH_DISTANCE,
  };
}

function makeClusterPieces(): OrdoPhysicsPiece[] {
  const pieces: OrdoPhysicsPiece[] = [
    { id: 'khan', kind: 'khan', x: 0, z: 0, vx: 0, vz: 0, radius: KHAN_RADIUS, mass: 2.2, rotation: 0, angularVelocity: 0 },
  ];

  // Ring the khan with regular pieces (Section "core rule": pieces cluster
  // around a central khan) - deterministic layout, not random.
  const ringRadius = 0.55;
  for (let i = 0; i < ORDO_PIECE_COUNT; i += 1) {
    const angle = (i / ORDO_PIECE_COUNT) * Math.PI * 2;
    pieces.push({
      id: `piece-${i}`,
      kind: 'regular',
      x: Math.cos(angle) * ringRadius,
      z: Math.sin(angle) * ringRadius,
      vx: 0,
      vz: 0,
      radius: REGULAR_RADIUS,
      mass: 1,
      rotation: angle,
      angularVelocity: 0,
    });
  }
  return pieces;
}

/** Owns all of Ordo's live disc state and steps it - PHYSICS only (Section
 * "PHYSICS VS RULES"): it reports what physically happened (which pieces
 * are now outside the boundary), never what that means for score. That's
 * OrdoRulesEngine's job. Held in a ref, not React state (Section 86) -
 * OrdoScene reads `.pieces`/`.striker` every frame to update meshes. */
export class OrdoPhysicsWorld {
  pieces: OrdoPhysicsPiece[] = makeClusterPieces();
  striker: OrdoPhysicsPiece | null = null;
  private capturedIds = new Set<string>();

  reset() {
    this.pieces = makeClusterPieces();
    this.striker = null;
    this.capturedIds.clear();
  }

  /** `launchAngleOffset` in radians, applied on top of the straight line
   * from the launch point to the field center; `power` is 0..1. */
  launchStriker(launchAngleOffset: number, power: number) {
    const baseAngle = Math.PI; // launch from "south" of the field, aimed north toward center
    const launchAngle = baseAngle + launchAngleOffset;
    const startX = Math.sin(launchAngle) * STRIKER_LAUNCH_DISTANCE;
    const startZ = Math.cos(launchAngle) * STRIKER_LAUNCH_DISTANCE;

    const aimAngle = launchAngle + Math.PI; // pointed back toward center
    const speed = MIN_LAUNCH_SPEED + (MAX_LAUNCH_SPEED - MIN_LAUNCH_SPEED) * Math.max(0, Math.min(1, power));

    this.striker = {
      id: 'striker',
      kind: 'regular',
      x: startX,
      z: startZ,
      vx: Math.sin(aimAngle) * speed,
      vz: Math.cos(aimAngle) * speed,
      radius: STRIKER_RADIUS,
      mass: 1.3,
      rotation: 0,
      angularVelocity: 6,
    };
  }

  step(dt: number) {
    const active: OrdoPhysicsPiece[] = this.striker ? [this.striker, ...this.pieces] : [...this.pieces];

    const stepped = active.map((disc) => stepDisc2D(disc, dt, DISC_CONFIG) as OrdoPhysicsPiece);

    for (let i = 0; i < stepped.length; i += 1) {
      for (let j = i + 1; j < stepped.length; j += 1) {
        if (discsOverlap(stepped[i], stepped[j])) {
          const [a, b] = resolveDiscCollision(stepped[i], stepped[j], DISC_CONFIG.restitution);
          stepped[i] = { ...stepped[i], ...a };
          stepped[j] = { ...stepped[j], ...b };
        }
      }
    }

    if (this.striker) {
      this.striker = stepped[0];
      this.pieces = stepped.slice(1);
    } else {
      this.pieces = stepped;
    }
  }

  /** True once the striker and every piece has stopped moving/spinning. */
  isSettled(): boolean {
    const all = this.striker ? [this.striker, ...this.pieces] : this.pieces;
    return all.every((disc) => isDiscSettled(disc));
  }

  /** Pieces that just crossed outside the field boundary and haven't
   * already been reported as captured this game. Marks them internally so
   * the same physical exit isn't reported twice. */
  collectNewlyOutOfBounds(): OrdoPhysicsPiece[] {
    const result: OrdoPhysicsPiece[] = [];
    for (const piece of this.pieces) {
      if (this.capturedIds.has(piece.id)) continue;
      if (distanceFromCenter(piece, 0, 0) > ORDO_FIELD_RADIUS) {
        this.capturedIds.add(piece.id);
        result.push(piece);
      }
    }
    return result;
  }

  removePiece(id: string) {
    this.pieces = this.pieces.filter((piece) => piece.id !== id);
  }

  /** Used when the rules engine rejects a physically-out-of-bounds capture
   * (khan knocked out before the throwing side has 3 prior captures - see
   * the ADAPTATION note in OrdoTypes.ts) - nudges the piece back just
   * inside the boundary along its current direction from center and kills
   * its velocity, rather than leaving it resting illegally outside. */
  returnPieceToField(id: string) {
    this.pieces = this.pieces.map((piece) => {
      if (piece.id !== id) return piece;
      const distance = distanceFromCenter(piece, 0, 0) || 1;
      const scale = (ORDO_FIELD_RADIUS - piece.radius * 2) / distance;
      return { ...piece, x: piece.x * scale, z: piece.z * scale, vx: 0, vz: 0, angularVelocity: 0 };
    });
  }

  clearStriker() {
    this.striker = null;
  }
}
