export type ThrowDifficultyConfig = { aiAccuracy: number };
export type ThrowAim = { angleOffset: number; power: number };

const MAX_ERROR_RAD = 0.55;
const IDEAL_POWER = 0.72;

/** Shared "honest AI" throw-aim generator (Section "Do not give AI exact
 * impossible perfect physics") used by Ordo and Chuko - both are "aim at
 * the cluster/row, then throw" games with the identical shot shape
 * (`DragPowerController`'s angleOffset + power). It aims at the ideal
 * straight shot, then adds random error scaled by `1 - aiAccuracy`: lower
 * difficulty genuinely misses more, higher difficulty is closer to ideal
 * but never zero error. */
export function computeThrowAim(config: ThrowDifficultyConfig): ThrowAim {
  const errorScale = 1 - config.aiAccuracy;
  const angleOffset = (Math.random() * 2 - 1) * MAX_ERROR_RAD * errorScale;
  const power = Math.max(0.2, Math.min(1, IDEAL_POWER + (Math.random() * 2 - 1) * 0.3 * errorScale));
  return { angleOffset, power };
}
