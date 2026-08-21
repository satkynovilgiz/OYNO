/** Linear XP curve: 500 XP per level, level 1 starts at 0 XP. */
export const XP_PER_LEVEL = 500;

export function levelForXp(xp: number): number {
  if (xp <= 0) return 1;
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function xpForLevelStart(level: number): number {
  return Math.max(0, level - 1) * XP_PER_LEVEL;
}

export function xpProgress(xp: number): { level: number; xpCurrent: number; xpMax: number } {
  const level = levelForXp(xp);
  return { level, xpCurrent: xp - xpForLevelStart(level), xpMax: XP_PER_LEVEL };
}
