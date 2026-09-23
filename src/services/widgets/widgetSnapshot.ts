import type { SupportedLanguage } from '@/i18n';

/**
 * Everything an OYNO widget shows, as plain JSON built only from state the
 * app already has - the in-app Widget Gallery renders from this today, and
 * it's the exact payload a native WidgetKit extension would read from a
 * shared App Group once that native target exists (see
 * docs/WIDGETS_NATIVE_SETUP.md). No progress is inferred: every number
 * comes straight from the existing progress functions' results.
 */
export type WidgetSnapshot = {
  version: 1;
  language: SupportedLanguage;
  generatedAt: string;
  /** Today's Daily OYNO item, or null when content isn't loaded. */
  daily: { itemId: string; title: string; minutes: number; isCompleted: boolean } | null;
  /** Home's single recommendation, as its card text. */
  journey: { eyebrow: string; title: string; progress: { completed: number; total: number } | null; route: string };
  /** Discovery Passport count (visited nature sites). */
  passport: { unlocked: number; total: number };
  /** The first Guided Trail in progress, or null when none is active. */
  trail: { id: string; title: string; completed: number; total: number } | null;
  /** Culture's "today discovery" material (culture_materials kind
   * 'today_discovery'), or null. */
  cultureOfDay: { id: string; title: string; description: string | null } | null;
};

export type WidgetSnapshotInput = {
  language: SupportedLanguage;
  now: Date;
  daily: WidgetSnapshot['daily'];
  journey: WidgetSnapshot['journey'];
  passport: { unlocked: number; total: number };
  trails: { id: string; title: string; status: string; completed: number; total: number }[];
  cultureMaterials: { id: string; kind: string; title: string; description: string | null }[];
};

export function buildWidgetSnapshot(input: WidgetSnapshotInput): WidgetSnapshot {
  const activeTrail = input.trails.find((trail) => trail.status === 'inProgress') ?? null;
  const today = input.cultureMaterials.find((material) => material.kind === 'today_discovery') ?? null;
  return {
    version: 1,
    language: input.language,
    generatedAt: input.now.toISOString(),
    daily: input.daily,
    journey: input.journey,
    passport: { unlocked: input.passport.unlocked, total: input.passport.total },
    trail: activeTrail ? { id: activeTrail.id, title: activeTrail.title, completed: activeTrail.completed, total: activeTrail.total } : null,
    cultureOfDay: today ? { id: today.id, title: today.title, description: today.description } : null,
  };
}
