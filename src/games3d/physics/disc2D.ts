/** Hand-rolled 2D disc physics (position/velocity/friction/collision) for
 * games where pieces slide on a flat surface - Ordo and Chuko. Deliberately
 * NOT cannon-es/a physics engine (Section 14: "use physics only where
 * useful, don't make everything a dynamic rigid body") - a flat-surface
 * slide-and-collide game is fully, testably solvable analytically, the same
 * way Jaa Atuu's arrow uses analytic projectile motion instead of a physics
 * engine. `cannon-es` stays installed and available if a future game
 * genuinely needs full 3D rigid bodies.
 *
 * Positions are on the XZ ground plane; Y is each game's fixed piece
 * height. Rotation is a single angle (yaw) with its own angular velocity,
 * for a chuko-style tumble/spin rather than full 3D rigid rotation. */

export type Disc2D = {
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  mass: number;
  rotation: number;
  angularVelocity: number;
};

export type Disc2DConfig = {
  /** Per-second linear velocity decay factor (0..1, applied as
   * v *= (1 - friction * dt)) - higher = stops sooner. */
  friction: number;
  angularFriction: number;
  /** Collision bounciness, 0 = fully inelastic, 1 = fully elastic. */
  restitution: number;
};

export function stepDisc2D(disc: Disc2D, dt: number, config: Disc2DConfig): Disc2D {
  const frictionFactor = Math.max(0, 1 - config.friction * dt);
  const angularFrictionFactor = Math.max(0, 1 - config.angularFriction * dt);

  return {
    ...disc,
    x: disc.x + disc.vx * dt,
    z: disc.z + disc.vz * dt,
    vx: disc.vx * frictionFactor,
    vz: disc.vz * frictionFactor,
    rotation: disc.rotation + disc.angularVelocity * dt,
    angularVelocity: disc.angularVelocity * angularFrictionFactor,
  };
}

/** Resolves an elastic-ish collision between two discs already known to be
 * overlapping (circle-circle). Mutates neither input - returns the two
 * post-collision discs. Also separates them along the collision normal so
 * they don't stay stuck overlapping and re-trigger every frame. */
export function resolveDiscCollision(a: Disc2D, b: Disc2D, restitution: number): [Disc2D, Disc2D] {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const distance = Math.hypot(dx, dz) || 0.0001;
  const nx = dx / distance;
  const nz = dz / distance;

  const overlap = a.radius + b.radius - distance;
  const totalMass = a.mass + b.mass;
  const pushA = overlap * (b.mass / totalMass);
  const pushB = overlap * (a.mass / totalMass);

  const relativeVelocity = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
  // Only apply an impulse if they're actually closing (avoids re-separating
  // discs that are drifting apart but still numerically overlapping).
  const impulse = relativeVelocity < 0 ? (-(1 + restitution) * relativeVelocity) / (1 / a.mass + 1 / b.mass) : 0;

  return [
    {
      ...a,
      x: a.x - nx * pushA,
      z: a.z - nz * pushA,
      vx: a.vx - (impulse * nx) / a.mass,
      vz: a.vz - (impulse * nz) / a.mass,
      angularVelocity: a.angularVelocity + relativeVelocity * 0.5,
    },
    {
      ...b,
      x: b.x + nx * pushB,
      z: b.z + nz * pushB,
      vx: b.vx + (impulse * nx) / b.mass,
      vz: b.vz + (impulse * nz) / b.mass,
      angularVelocity: b.angularVelocity - relativeVelocity * 0.5,
    },
  ];
}

export function discsOverlap(a: Disc2D, b: Disc2D): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return Math.hypot(dx, dz) < a.radius + b.radius;
}

export function isDiscSettled(disc: Disc2D, linearThreshold = 0.05, angularThreshold = 0.3): boolean {
  return Math.hypot(disc.vx, disc.vz) < linearThreshold && Math.abs(disc.angularVelocity) < angularThreshold;
}

export function distanceFromCenter(disc: Disc2D, centerX: number, centerZ: number): number {
  return Math.hypot(disc.x - centerX, disc.z - centerZ);
}
