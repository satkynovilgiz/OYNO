import type { AgeExperience } from '@/services/ageExperience/types';

import { ALL_HOME_SECTIONS, getHomeSectionOrder, type HomeSectionId } from './homeSections';

/**
 * Customize Home - a small OVERRIDE on top of the age experience's
 * recommended order (homeSections.ts). Home stays one architecture; this
 * only decides which optional sections render and in what order.
 *
 * Stored (device-level display preference, like Appearance): the custom
 * ORDER (or none) and the HIDDEN ids - never a copy of the Home config.
 *
 * Rules:
 *   - 'hero' (the ONE primary recommendation) is required: always first,
 *     always shown, never duplicated. The header and bottom navigation are
 *     outside the section list and can't be touched.
 *   - Only sections the CURRENT age experience has are listed/rendered; a
 *     stored id the age (or a newer/older app) doesn't have is ignored.
 *   - A section missing from the stored order (new in this app version, or
 *     new for this age) starts SHOWN at its default place: right after the
 *     section that precedes it in the age default order.
 *   - A section with nothing to show still hides itself (Home's own rule).
 */

export const REQUIRED_SECTIONS: readonly HomeSectionId[] = ['hero'];

export type HomeLayoutPrefs = { order: HomeSectionId[] | null; hidden: HomeSectionId[] };
export const DEFAULT_LAYOUT: HomeLayoutPrefs = { order: null, hidden: [] };

const isSection = (value: unknown): value is HomeSectionId => typeof value === 'string' && (ALL_HOME_SECTIONS as string[]).includes(value);

/** Untrusted storage -> clean prefs (unknown ids dropped, no duplicates). */
export function sanitizeLayout(raw: unknown): HomeLayoutPrefs {
  const value = raw && typeof raw === 'object' ? (raw as { order?: unknown; hidden?: unknown }) : {};
  const order = Array.isArray(value.order) ? [...new Set(value.order.filter(isSection))] : null;
  const hidden = Array.isArray(value.hidden) ? [...new Set(value.hidden.filter(isSection))].filter((id) => !REQUIRED_SECTIONS.includes(id)) : [];
  return { order: order && order.length > 0 ? order : null, hidden };
}

/** The full ordered list for this age (shown and hidden), hero first. */
export function orderedSections(experience: AgeExperience, prefs: HomeLayoutPrefs): HomeSectionId[] {
  const defaults = getHomeSectionOrder(experience);
  if (!prefs.order) return [...defaults];
  const order = prefs.order.filter((id) => defaults.includes(id) && !REQUIRED_SECTIONS.includes(id));
  for (const id of defaults) {
    if (REQUIRED_SECTIONS.includes(id) || order.includes(id)) continue;
    // New for this age/app version: default place, after its default predecessor.
    const before = defaults.slice(0, defaults.indexOf(id)).reverse().find((other) => order.includes(other));
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, id);
  }
  return [...REQUIRED_SECTIONS.filter((id) => defaults.includes(id)), ...order];
}

/** What Home renders, in order. */
export function visibleSections(experience: AgeExperience, prefs: HomeLayoutPrefs): HomeSectionId[] {
  return orderedSections(experience, prefs).filter((id) => REQUIRED_SECTIONS.includes(id) || !prefs.hidden.includes(id));
}

export function setShown(prefs: HomeLayoutPrefs, id: HomeSectionId, shown: boolean): HomeLayoutPrefs {
  if (REQUIRED_SECTIONS.includes(id)) return prefs;
  const hidden = shown ? prefs.hidden.filter((value) => value !== id) : [...new Set([...prefs.hidden, id])];
  return { ...prefs, hidden };
}

/** Move one optional section up (-1) or down (+1); hero never moves. */
export function moveSection(prefs: HomeLayoutPrefs, experience: AgeExperience, id: HomeSectionId, delta: -1 | 1): HomeLayoutPrefs {
  const list = orderedSections(experience, prefs).filter((value) => !REQUIRED_SECTIONS.includes(value));
  const index = list.indexOf(id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= list.length) return prefs;
  [list[index], list[target]] = [list[target], list[index]];
  // Keep ids from other ages so switching back keeps their places too.
  const others = (prefs.order ?? []).filter((value) => !list.includes(value) && !REQUIRED_SECTIONS.includes(value));
  return { ...prefs, order: [...list, ...others] };
}

export function isCustomized(prefs: HomeLayoutPrefs, experience: AgeExperience): boolean {
  const defaults = getHomeSectionOrder(experience);
  return prefs.hidden.some((id) => defaults.includes(id)) || orderedSections(experience, prefs).join() !== defaults.join();
}
