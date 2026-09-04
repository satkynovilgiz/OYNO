/** Shared kinematic horse controller (Section 37/88: "prefer controlled
 * character movement", not a physics-driven horse simulation) - used by
 * both Kyz Kuumai and Kok Boru (Section "Do not implement a completely
 * separate horse controller for Kok Boru later"). Pure TS, no Three.js/
 * React dependency, so it's cheaply unit-testable and reusable from any
 * scene. Position/heading/speed/stamina are plain mutable fields updated by
 * `step()`, meant to be held in a ref and read by the scene's useFrame -
 * never put in React state (Section 86/87). */

export type HorseMovementState = 'IDLE' | 'WALK' | 'TROT' | 'GALLOP';

export type HorseControllerConfig = {
  /** m/s at full input, not sprinting. */
  maxSpeed: number;
  /** m/s at full input while sprinting. */
  maxSprintSpeed: number;
  acceleration: number;
  deceleration: number;
  /** rad/s turn rate at a standstill. */
  turnRateAtIdle: number;
  /** rad/s turn rate at max sprint speed - lower than idle (Section 37:
   * "Turning becomes slightly less sharp at maximum gallop"). */
  turnRateAtMaxSpeed: number;
  staminaMax: number;
  staminaDrainPerSecond: number;
  staminaRegenPerSecond: number;
};

export const DEFAULT_HORSE_CONFIG: HorseControllerConfig = {
  maxSpeed: 6,
  maxSprintSpeed: 11,
  acceleration: 5,
  deceleration: 7,
  turnRateAtIdle: 3.2,
  turnRateAtMaxSpeed: 1.4,
  staminaMax: 100,
  staminaDrainPerSecond: 28,
  staminaRegenPerSecond: 14,
};

export type HorseInput = {
  /** Joystick vector, both roughly -1..1; magnitude clamped to 1. */
  moveX: number;
  moveZ: number;
  sprintHeld: boolean;
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Turns `current` toward `target` (radians) by at most `maxDelta`,
 * shortest way around the circle. */
function stepAngleTowards(current: number, target: number, maxDelta: number): number {
  let diff = (target - current + Math.PI) % (Math.PI * 2);
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > Math.PI) diff -= Math.PI * 2;
  const clamped = Math.max(-maxDelta, Math.min(maxDelta, diff));
  return current + clamped;
}

export class HorseController {
  x: number;
  z: number;
  /** Radians, 0 = facing -Z ("forward" in this world's convention). */
  heading: number;
  speed = 0;
  stamina: number;
  state: HorseMovementState = 'IDLE';
  isSprinting = false;
  /** Hysteresis latch: once stamina hits 0, sprint stays locked out until
   * stamina recovers to RECOVERY_THRESHOLD_RATIO of max, not the instant it
   * ticks above 0 - without this, stamina oscillates every frame right at
   * the 0 boundary (drain->hit 0->regen a hair->drain again), which reads
   * as visible jitter in speed rather than a clean "out of breath, must
   * recover" lockout. Caught by HorseController.test.ts. */
  private canSprint = true;
  private static readonly RECOVERY_THRESHOLD_RATIO = 0.2;

  constructor(
    readonly config: HorseControllerConfig = DEFAULT_HORSE_CONFIG,
    startX = 0,
    startZ = 0,
    startHeading = 0,
  ) {
    this.x = startX;
    this.z = startZ;
    this.heading = startHeading;
    this.stamina = config.staminaMax;
  }

  step(input: HorseInput, dt: number) {
    const inputMagnitude = Math.min(1, Math.hypot(input.moveX, input.moveZ));

    if (this.stamina <= 0) this.canSprint = false;
    else if (this.stamina >= this.config.staminaMax * HorseController.RECOVERY_THRESHOLD_RATIO) this.canSprint = true;

    const wantsSprint = input.sprintHeld && this.canSprint && inputMagnitude > 0.1;
    this.isSprinting = wantsSprint;

    const topSpeed = wantsSprint ? this.config.maxSprintSpeed : this.config.maxSpeed;
    const targetSpeed = inputMagnitude * topSpeed;

    this.speed =
      this.speed < targetSpeed
        ? Math.min(targetSpeed, this.speed + this.config.acceleration * dt)
        : Math.max(targetSpeed, this.speed - this.config.deceleration * dt);

    this.stamina = wantsSprint
      ? Math.max(0, this.stamina - this.config.staminaDrainPerSecond * dt)
      : Math.min(this.config.staminaMax, this.stamina + this.config.staminaRegenPerSecond * dt);

    if (inputMagnitude > 0.15) {
      const desiredHeading = Math.atan2(input.moveX, -input.moveZ);
      const speedFactor = Math.min(1, this.speed / this.config.maxSprintSpeed);
      const turnRate = lerp(this.config.turnRateAtIdle, this.config.turnRateAtMaxSpeed, speedFactor);
      this.heading = stepAngleTowards(this.heading, desiredHeading, turnRate * dt);
    }

    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z -= Math.cos(this.heading) * this.speed * dt;

    const speedRatio = this.speed / this.config.maxSpeed;
    this.state = this.speed < 0.15 ? 'IDLE' : speedRatio < 0.4 ? 'WALK' : speedRatio < 0.95 ? 'TROT' : 'GALLOP';
  }
}
