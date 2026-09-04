import { DEFAULT_HORSE_CONFIG, HorseController } from './HorseController';

describe('HorseController', () => {
  it('accelerates toward the target speed rather than jumping to it instantly', () => {
    const horse = new HorseController(DEFAULT_HORSE_CONFIG);
    horse.step({ moveX: 0, moveZ: -1, sprintHeld: false }, 1 / 60);
    expect(horse.speed).toBeGreaterThan(0);
    expect(horse.speed).toBeLessThan(DEFAULT_HORSE_CONFIG.maxSpeed);
  });

  it('reaches close to max speed after holding full forward input for a couple of seconds', () => {
    const horse = new HorseController(DEFAULT_HORSE_CONFIG);
    for (let i = 0; i < 180; i += 1) horse.step({ moveX: 0, moveZ: -1, sprintHeld: false }, 1 / 60);
    expect(horse.speed).toBeCloseTo(DEFAULT_HORSE_CONFIG.maxSpeed, 0);
    expect(horse.state).toBe('GALLOP');
  });

  it('never exceeds maxSpeed without sprint, even after a long hold', () => {
    const horse = new HorseController(DEFAULT_HORSE_CONFIG);
    for (let i = 0; i < 600; i += 1) horse.step({ moveX: 0, moveZ: -1, sprintHeld: false }, 1 / 60);
    expect(horse.speed).toBeLessThanOrEqual(DEFAULT_HORSE_CONFIG.maxSpeed + 0.001);
  });

  it('sprint reaches a higher top speed than normal movement but drains stamina', () => {
    const horse = new HorseController(DEFAULT_HORSE_CONFIG);
    for (let i = 0; i < 180; i += 1) horse.step({ moveX: 0, moveZ: -1, sprintHeld: true }, 1 / 60);
    expect(horse.speed).toBeGreaterThan(DEFAULT_HORSE_CONFIG.maxSpeed);
    expect(horse.stamina).toBeLessThan(DEFAULT_HORSE_CONFIG.staminaMax);
  });

  it('never lets stamina go negative, and locks sprint out starting the frame after stamina first hits 0', () => {
    const horse = new HorseController(DEFAULT_HORSE_CONFIG);
    let exhaustedAtFrame = -1;
    for (let i = 0; i < 400; i += 1) {
      horse.step({ moveX: 0, moveZ: -1, sprintHeld: true }, 1 / 60);
      expect(horse.stamina).toBeGreaterThanOrEqual(0);

      if (exhaustedAtFrame === -1 && horse.stamina === 0) {
        // The step that spends the last of the stamina is allowed to have
        // sprinted for that frame's motion - it's the *next* frame that
        // must be locked out.
        exhaustedAtFrame = i;
      } else if (exhaustedAtFrame !== -1 && i === exhaustedAtFrame + 1) {
        expect(horse.isSprinting).toBe(false);
        break;
      }
    }
    expect(exhaustedAtFrame).toBeGreaterThan(-1);
  });

  it('does not resume sprinting the instant stamina ticks above 0 - it must recover past a threshold first (hysteresis, avoids per-frame flicker)', () => {
    const horse = new HorseController(DEFAULT_HORSE_CONFIG);
    // Drain to exhaustion (dynamic loop - the exact frame count to hit 0
    // depends on the discrete step size, not worth hardcoding).
    let guard = 0;
    while (horse.stamina > 0 && guard < 1000) {
      horse.step({ moveX: 0, moveZ: -1, sprintHeld: true }, 1 / 60);
      guard += 1;
    }
    expect(horse.stamina).toBe(0);

    // One recovery frame: stamina ticks up a little but should still be far
    // below a meaningful recovery threshold - sprint must stay locked out.
    horse.step({ moveX: 0, moveZ: -1, sprintHeld: true }, 1 / 60);
    expect(horse.stamina).toBeGreaterThan(0);
    expect(horse.isSprinting).toBe(false);
  });

  it('stamina regenerates when not sprinting', () => {
    const horse = new HorseController(DEFAULT_HORSE_CONFIG);
    for (let i = 0; i < 120; i += 1) horse.step({ moveX: 0, moveZ: -1, sprintHeld: true }, 1 / 60);
    const drained = horse.stamina;
    for (let i = 0; i < 120; i += 1) horse.step({ moveX: 0, moveZ: -1, sprintHeld: false }, 1 / 60);
    expect(horse.stamina).toBeGreaterThan(drained);
  });

  it('turns toward the input direction over time rather than snapping instantly', () => {
    const horse = new HorseController(DEFAULT_HORSE_CONFIG, 0, 0, 0);
    // Get moving forward first so there's a turn rate to observe.
    for (let i = 0; i < 60; i += 1) horse.step({ moveX: 0, moveZ: -1, sprintHeld: false }, 1 / 60);
    const headingBefore = horse.heading;
    horse.step({ moveX: 1, moveZ: 0, sprintHeld: false }, 1 / 60);
    expect(horse.heading).not.toBe(headingBefore);
    // One frame at a reasonable turn rate shouldn't snap a full 90 degrees.
    expect(Math.abs(horse.heading - headingBefore)).toBeLessThan(Math.PI / 2);
  });

  it('stays put with zero input', () => {
    const horse = new HorseController(DEFAULT_HORSE_CONFIG, 5, 5, 0);
    for (let i = 0; i < 30; i += 1) horse.step({ moveX: 0, moveZ: 0, sprintHeld: false }, 1 / 60);
    expect(horse.x).toBeCloseTo(5);
    expect(horse.z).toBeCloseTo(5);
    expect(horse.state).toBe('IDLE');
  });
});
