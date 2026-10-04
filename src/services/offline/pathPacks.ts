import { GLOSSARY } from '@/features/culture/glossary/glossaryData';
import { LEARNING_PATHS, type LearningPath, type StepType } from '@/features/learn/learningPaths';

import { downloadId, requestersOf, type OfflineKind, type OfflineManifest } from './offlineManifest';
import { downloadPackItems, releasePackItems, type PackStore, type RegionPackItem } from './regionPacks';

/**
 * Learning Path offline packs - the SAME offline system as Region packs:
 * a pack is a list of EXISTING downloads, claimed with a 'path:<id>' tag.
 * Anything already on the device (saved on its own, by a Region pack or by
 * another path) is only tagged, never stored twice; removing a path drops
 * only its tag. Built-in steps (games, labs, challenges - their code,
 * assets and questions ship with the app) are never "downloaded".
 */

export type StepOfflineMode = 'download' | 'built_in' | 'not_offline_capable';
export type StepOfflineState = 'built_in' | 'downloaded' | 'missing' | 'failed' | 'not_offline_capable';

export type PathStepOffline = { stepId: string; type: StepType; mode: StepOfflineMode; deps: string[] };

export type LearningPathOfflineManifest = {
  pathId: string;
  steps: PathStepOffline[];
  /** Unique downloads the pack needs (shared deps appear once). */
  items: RegionPackItem[];
};

/** The shared culture list (glossary terms + step titles). */
export const CULTURE_INDEX_ID = downloadId('culture_index', 'all');

export function pathRequester(pathId: string): string {
  return `path:${pathId}`;
}

/**
 * Inspects every step (nothing hand-listed per screen):
 *   culture_item  -> that article's existing 'culture_item' download
 *   glossary      -> its SOURCE article's download + the shared culture
 *                    list (definitions derive from Culture - no copy)
 *   challenge     -> built in (question bank ships with the app)
 *   game          -> built in (bundled game code + 3D assets)
 *   interactive_lab -> built in (bundled lab)
 * The shared culture list is a path-level dependency (step titles).
 */
export function buildLearningPathOfflineManifest(path: LearningPath): LearningPathOfflineManifest {
  const seen = new Set<string>();
  const items: RegionPackItem[] = [];
  const add = (kind: OfflineKind, contentId: string) => {
    const id = downloadId(kind, contentId);
    if (!seen.has(id)) {
      seen.add(id);
      items.push({ kind, contentId, id });
    }
    return id;
  };
  add('culture_index', 'all');
  const steps = path.steps.map((step): PathStepOffline => {
    switch (step.type) {
      case 'culture_item':
        return { stepId: step.id, type: step.type, mode: 'download', deps: [add('culture_item', step.targetId)] };
      case 'glossary': {
        const entry = GLOSSARY.find((term) => term.id === step.targetId);
        if (!entry || entry.sourceContentType !== 'culture_item') return { stepId: step.id, type: step.type, mode: 'not_offline_capable', deps: [] };
        return { stepId: step.id, type: step.type, mode: 'download', deps: [add('culture_item', entry.sourceContentId), CULTURE_INDEX_ID] };
      }
      default:
        return { stepId: step.id, type: step.type, mode: 'built_in', deps: [] };
    }
  });
  return { pathId: path.id, steps, items };
}

export function stepOfflineState(step: PathStepOffline, manifest: OfflineManifest, failed: readonly string[]): StepOfflineState {
  if (step.mode === 'built_in') return 'built_in';
  if (step.mode === 'not_offline_capable') return 'not_offline_capable';
  if (step.deps.every((id) => !!manifest.entries[id])) return 'downloaded';
  return step.deps.some((id) => !manifest.entries[id] && failed.includes(id)) ? 'failed' : 'missing';
}

export type PathPackStatus = 'none' | 'downloading' | 'available' | 'partial' | 'attention';

export type PathPackState = {
  status: PathPackStatus;
  totalSteps: number;
  builtIn: number;
  downloadable: number;
  /** Steps that open offline now (built in + downloaded). */
  offlineCapable: number;
  unavailable: number;
  requested: boolean;
  /** Downloads still needed (for "N items to download" - no fake MB). */
  missingItems: number;
  stepStates: StepOfflineState[];
};

/**
 * Derived from the real offline manifest only. "Available offline" only
 * when EVERY step opens offline AND the shared culture list is present;
 * otherwise "x of y" (never rounded up).
 */
export function learningPathPackState(pack: LearningPathOfflineManifest, manifest: OfflineManifest, inFlight: readonly string[], failed: readonly string[]): PathPackState {
  const requester = pathRequester(pack.pathId);
  const stepStates = pack.steps.map((step) => stepOfflineState(step, manifest, failed));
  const builtIn = stepStates.filter((state) => state === 'built_in').length;
  const downloaded = stepStates.filter((state) => state === 'downloaded').length;
  const missingItems = pack.items.filter((item) => !manifest.entries[item.id]).length;
  const requested = pack.items.some((item) => requestersOf(manifest.entries[item.id]).includes(requester));
  const downloading = pack.items.some((item) => inFlight.includes(item.id));
  const anyFailed = stepStates.includes('failed') || pack.items.some((item) => !manifest.entries[item.id] && failed.includes(item.id));
  const offlineCapable = builtIn + downloaded;
  const status: PathPackStatus = downloading
    ? 'downloading'
    : missingItems === 0 && offlineCapable === pack.steps.length
      ? 'available'
      : anyFailed
        ? 'attention'
        : requested || downloaded > 0
          ? 'partial'
          : 'none';
  return {
    status,
    totalSteps: pack.steps.length,
    builtIn,
    downloadable: pack.steps.filter((step) => step.mode === 'download').length,
    offlineCapable,
    unavailable: pack.steps.length - offlineCapable,
    requested,
    missingItems,
    stepStates,
  };
}

/** Path ids whose pack was asked for (Offline manager + reconnect retry). */
export function requestedPathIds(manifest: OfflineManifest): string[] {
  const ids = new Set<string>();
  for (const entry of Object.values(manifest.entries)) {
    for (const requester of requestersOf(entry)) if (requester.startsWith('path:')) ids.add(requester.slice('path:'.length));
  }
  return [...ids].sort();
}

/** Download / Retry: claims what is on the device, fetches only what is missing or failed. */
export function downloadPathPack(pack: LearningPathOfflineManifest, store: () => PackStore): Promise<number> {
  return downloadPackItems(pathRequester(pack.pathId), pack.items, store);
}

/** Remove: only this path's claim; shared copies other owners need stay. */
export function removePathPack(pack: LearningPathOfflineManifest, store: () => PackStore): Promise<void> {
  return releasePackItems(pathRequester(pack.pathId), pack.items, store);
}

/**
 * Offline "Continue": the first unfinished step that really opens offline.
 * The real next step stays the real next step - if it is unavailable the
 * caller says so; nothing is skipped in completion order or marked done.
 */
export function offlineContinue(nextIndex: number | null, completed: readonly boolean[], available: readonly boolean[]): { index: number | null; trueNextUnavailable: boolean } {
  if (nextIndex === null) return { index: null, trueNextUnavailable: false };
  if (available[nextIndex]) return { index: nextIndex, trueNextUnavailable: false };
  const index = completed.findIndex((done, position) => !done && available[position]);
  return { index: index >= 0 ? index : null, trueNextUnavailable: true };
}

/** Connection back: requested packs that are incomplete download only
 * their missing items (already-present items are just re-tagged). */
export async function retryPartialPathPacks(store: () => PackStore): Promise<void> {
  for (const pathId of requestedPathIds(store().manifest)) {
    const path = LEARNING_PATHS.find((candidate) => candidate.id === pathId);
    if (!path) continue;
    const pack = buildLearningPathOfflineManifest(path);
    // Background priority: anything the person starts by hand goes first.
    if (pack.items.some((item) => !store().manifest.entries[item.id])) await downloadPackItems(pathRequester(pack.pathId), pack.items, store, 'background');
  }
}
