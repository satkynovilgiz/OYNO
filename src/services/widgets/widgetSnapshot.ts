import type { SupportedLanguage } from '@/i18n';

/**
 * Everything an OYNO widget shows, as plain JSON built only from state the
 * app already has - the in-app Widget Gallery renders from this today, and
 * it's the exact payload a native WidgetKit extension would read from a
 * shared App Group once that native target exists (see
 * docs/WIDGETS_NATIVE_SETUP.md). No progress is inferred: every number
 * comes straight from the existing progress functions' results.
 */
/** Already-localized text the native widgets display (KG/RU/EN from the
 * app's own i18n), so SwiftUI never hardcodes UI copy. */
export type WidgetLabels = {
  daily: string;
  dailyDone: string;
  minutes: string;
  journey: string;
  passport: string;
  passportProgress: string;
  trail: string;
  noTrail: string;
  cultureOfDay: string;
  openApp: string;
};

export type WidgetSnapshot = {
  version: 1;
  language: SupportedLanguage;
  generatedAt: string;
  /** The local calendar date the snapshot describes (YYYY-MM-DD) - the
   * widget treats Daily as stale once the day has changed. */
  localDate: string;
  labels: WidgetLabels;
  /** Deep-link routes (expo-router paths) each widget opens. */
  routes: { daily: string; journey: string; passport: string; trail: string | null; cultureOfDay: string | null };
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
  localDate: string;
  labels: WidgetLabels;
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
    localDate: input.localDate,
    labels: input.labels,
    routes: {
      daily: '/daily',
      journey: input.journey.route,
      // Passport lives in My Journey.
      passport: '/journey',
      trail: activeTrail ? `/trails/${activeTrail.id}` : null,
      cultureOfDay: today ? `/culture/material/${today.id}` : null,
    },
    daily: input.daily,
    journey: input.journey,
    passport: { unlocked: input.passport.unlocked, total: input.passport.total },
    trail: activeTrail ? { id: activeTrail.id, title: activeTrail.title, completed: activeTrail.completed, total: activeTrail.total } : null,
    cultureOfDay: today ? { id: today.id, title: today.title, description: today.description } : null,
  };
}
