import { discsOverlap, distanceFromCenter, isDiscSettled, resolveDiscCollision, stepDisc2D, type Disc2D } from '../../physics/disc2D';
import { CHUKO_FIELD_RADIUS, CHUKO_PIECE_COUNT } from './ChukoTypes';

export type ChukoPhysicsPiece = Disc2D & { id: string };

const PIECE_RADIUS = 0.09;
const STRIKER_RADIUS = 0.1;
const STRIKER_LAUNCH_DISTANCE = CHUKO_FIELD_RADIUS + 1.1;
const MIN_LAUNCH_SPEED = 2.5;
const MAX_LAUNCH_SPEED = 7;
// Lighter, higher-friction pieces than Ordo's - chuko bones settle faster
// and skitter less (Section "CHUKO — PHYSICS": "natural but controllable").
const DISC_CONFIG = { friction: 1.6, angularFriction: 3, restitution: 0.3 };

export function getLaunchPosition(angleOffset: number): { x: number; z: number } {
  const launchAngle = Math.PI + angleOffset;
  return { x: Math.sin(launchAngle) * STRIKER_LAUNCH_DISTANCE, z: Math.cos(launchAngle) * STRIKER_LAUNCH_DISTANCE };
}

function makeCirclePieces(): ChukoPhysicsPiece[] {
  const pieces: ChukoPhysicsPiece[] = [];
  for (let i = 0; i < CHUKO_PIECE_COUNT; i += 1) {
    const angle = (i / CHUKO_PIECE_COUNT) * Math.PI * 2;
    const radius = 0.5;
    pieces.push({
      id: `piece-${i}`,
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      vx: 0,
      vz: 0,
      radius: PIECE_RADIUS,
      mass: 0.4,
      rotation: angle,
      angularVelocity: 0,
    });
  }
  return pieces;
}

/** PHYSICS only (Section "PHYSICS VS RULES") - near-identical shape to
 * OrdoPhysicsWorld (both are "flick a striker at a cluster on a bounded
 * field" games) but no khan/no capture-threshold. */
export class ChukoPhysicsWorld {
  pieces: ChukoPhysicsPiece[] = makeCirclePieces();
  striker: ChukoPhysicsPiece | null = null;
  private capturedIds = new Set<string>();

  reset() {
    this.pieces = makeCirclePieces();
    this.striker = null;
    this.capturedIds.clear();
  }

  launchStriker(angleOffset: number, power: number) {
    const launchAngle = Math.PI + angleOffset;
    const startX = Math.sin(launchAngle) * STRIKER_LAUNCH_DISTANCE;
    const startZ = Math.cos(launchAngle) * STRIKER_LAUNCH_DISTANCE;
    const aimAngle = launchAngle + Math.PI;
    const speed = MIN_LAUNCH_SPEED + (MAX_LAUNCH_SPEED - MIN_LAUNCH_SPEED) * Math.max(0, Math.min(1, power));

    this.striker = {
      id: 'striker',
      x: startX,
      z: startZ,
      vx: Math.sin(aimAngle) * speed,
      vz: Math.cos(aimAngle) * speed,
      radius: STRIKER_RADIUS,
      mass: 0.5,
      rotation: 0,
      angularVelocity: 8,
    };
  }

  step(dt: number) {
    const active: ChukoPhysicsPiece[] = this.striker ? [this.striker, ...this.pieces] : [...this.pieces];
    const stepped = active.map((disc) => stepDisc2D(disc, dt, DISC_CONFIG) as ChukoPhysicsPiece);

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

  isSettled(): boolean {
    const all = this.striker ? [this.striker, ...this.pieces] : this.pieces;
    return all.every((disc) => isDiscSettled(disc));
  }

  collectNewlyOutOfBounds(): ChukoPhysicsPiece[] {
    const result: ChukoPhysicsPiece[] = [];
    for (const piece of this.pieces) {
      if (this.capturedIds.has(piece.id)) continue;
      if (distanceFromCenter(piece, 0, 0) > CHUKO_FIELD_RADIUS) {
        this.capturedIds.add(piece.id);
        result.push(piece);
      }
    }
    return result;
  }

  removePiece(id: string) {
    this.pieces = this.pieces.filter((piece) => piece.id !== id);
  }

  clearStriker() {
    this.striker = null;
  }
}
