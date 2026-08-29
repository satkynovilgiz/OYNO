import { xpProgress } from '@/services/progress/levelConfig';

import type { AvatarItem } from './avatarCatalog';

/**
 * A plain, minimal snapshot of the real progress fields these rules read -
 * deliberately not `useProgressStore`'s full state type, so this file has
 * zero store import and stays trivially testable with a fabricated
 * object. Callers (the store, AvatarEditorScreen) build this from the
 * real useProgressStore() state.
 */
export type AvatarUnlockProgressSnapshot = {
  gamesPlayed: number;
  cultureDiscoveryCount: number;
  questFoundCount: number;
  streakDays: number;
  xp: number;
};

export type UnlockRule = {
  ruleId: string;
  isMet: (progress: AvatarUnlockProgressSnapshot) => boolean;
};

/**
 * 5 concrete rules, each tied to one real, already-tracked progress
 * signal - deliberately modest (not dozens of invented ones). ruleId
 * matches the `unlock.ruleId` avatarCatalog.ts's `items()` helper
 * generates (`${categoryId}:${itemId}`).
 */
export const AVATAR_UNLOCK_RULES: UnlockRule[] = [
  { ruleId: 'hair:hair_10', isMet: (p) => p.gamesPlayed >= 10 },
  { ruleId: 'clothing:chapan', isMet: (p) => p.cultureDiscoveryCount >= 1 },
  { ruleId: 'headwear:shokulo', isMet: (p) => p.questFoundCount >= 5 },
  { ruleId: 'background:shyrdakPattern', isMet: (p) => p.streakDays >= 3 },
  { ruleId: 'accessory:ornamentalPin', isMet: (p) => xpProgress(p.xp).level >= 5 },
];

const RULES_BY_ID = new Map(AVATAR_UNLOCK_RULES.map((rule) => [rule.ruleId, rule]));

export function isItemUnlocked(item: AvatarItem, progress: AvatarUnlockProgressSnapshot): boolean {
  if (item.unlock.type === 'free') return true;
  const rule = RULES_BY_ID.get(item.unlock.ruleId);
  // A gated item with no matching rule is a data bug, not a locked state -
  // fail open (unlocked) so a catalog/rule-id typo can't accidentally
  // strand an item as permanently unreachable.
  if (!rule) return true;
  return rule.isMet(progress);
}

export function getUnlockedItemIds(
  catalog: Record<string, AvatarItem[]>,
  progress: AvatarUnlockProgressSnapshot,
): Set<string> {
  const unlocked = new Set<string>();
  for (const categoryItems of Object.values(catalog)) {
    for (const item of categoryItems) {
      if (isItemUnlocked(item, progress)) unlocked.add(item.id);
    }
  }
  return unlocked;
}
