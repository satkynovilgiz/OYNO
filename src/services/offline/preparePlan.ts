import { LEARNING_PATHS } from '@/features/learn/learningPaths';
import { activityFor, type Queue } from '@/features/nextVisit/nextVisitModel';

import { downloadId, type OfflineManifest } from './offlineManifest';
import { buildLearningPathOfflineManifest, pathRequester } from './pathPacks';
import { cancelPackItems, downloadPackItems, repairPackItems, type PackStore, type RegionPackItem } from './regionPacks';

/**
 * "Prepare for offline" - a curated view over the EXISTING download system
 * for one journey (a Learning Path) or the person's My Next Visit plan.
 * Resources come from stable ids only; downloads/cancel/retry reuse the
 * pack functions (claims are tagged, so nothing already downloaded is ever
 * deleted by cancelling, and retry fetches only what is missing).
 *
 * Only public content can be downloaded (articles + the shared article
 * list). Bundled activities need no download. Nothing private (journal,
 * recordings, notes) is ever part of a preparation.
 */
export type PrepareSource = { kind: 'path'; pathId: string } | { kind: 'plan' };
export type ResourceMode = 'download' | 'built_in' | 'unknown' | 'unavailable';
export type Resource = { key: string; kind: 'article' | 'activity' | 'step'; id: string; mode: ResourceMode; deps: string[]; stepType?: string };
export type PreparePlan = { source: PrepareSource; requester: string; resources: Resource[]; items: RegionPackItem[] };

/**
 * Activities whose screens use only bundled code, assets and data (no
 * content query) - checked against their imports when this list was made.
 * Anything else is "unknown": e.g. Daily depends on that day's article.
 */
export const BUNDLED_ACTIVITIES = new Set(['detective', 'mapChallenge', 'jaaAtuu', 'kyzKuumai', 'kokBoru', 'duel', 'restore', 'bozUy', 'shyrdak', 'oymo', 'komuzListen', 'repeatRhythm', 'komuzLesson']);
export const PLAN_REQUESTER = 'plan:next-visit';

export function buildPreparePlan(source: PrepareSource, input: { queue: Queue; articleExists: (id: string) => boolean | undefined }): PreparePlan | null {
  if (source.kind === 'path') {
    const path = LEARNING_PATHS.find((entry) => entry.id === source.pathId);
    if (!path) return null;
    const pack = buildLearningPathOfflineManifest(path);
    return {
      source,
      requester: pathRequester(path.id),
      items: pack.items,
      resources: pack.steps.map((step) => ({ key: `step:${step.stepId}`, kind: 'step', id: step.stepId, stepType: step.type, mode: step.mode === 'download' ? 'download' : step.mode === 'built_in' ? 'built_in' : 'unavailable', deps: step.deps })),
    };
  }
  const seen = new Set<string>();
  const items: RegionPackItem[] = [];
  const add = (kind: 'culture_item' | 'culture_index', contentId: string) => {
    const id = downloadId(kind, contentId);
    if (!seen.has(id)) {
      seen.add(id);
      items.push({ kind, contentId, id });
    }
    return id;
  };
  const resources = input.queue.map((item): Resource => {
    const key = `${item.kind}:${item.id}`;
    if (item.kind === 'activity') {
      if (!activityFor(item.id)) return { key, kind: 'activity', id: item.id, mode: 'unavailable', deps: [] };
      return { key, kind: 'activity', id: item.id, mode: BUNDLED_ACTIVITIES.has(item.id) ? 'built_in' : 'unknown', deps: [] };
    }
    if (input.articleExists(item.id) === false) return { key, kind: 'article', id: item.id, mode: 'unavailable', deps: [] };
    return { key, kind: 'article', id: item.id, mode: 'download', deps: [add('culture_item', item.id), add('culture_index', 'all')] };
  });
  return { source, requester: PLAN_REQUESTER, resources, items };
}

export type ResourceState = 'built_in' | 'downloaded' | 'incomplete' | 'downloading' | 'failed' | 'missing' | 'unavailable' | 'unknown';
/**
 * Is a listed download really USABLE (offlineAvailability.isDownloadUsable:
 * stored results present, not failed the last health check, results in the
 * cache the screens read)? Defaults to "listed = usable" only where no check
 * is given (pure tests of other rules).
 */
export type UsableCheck = (id: string) => boolean;
/** From the real offline manifest, the download queue and the usability check. */
export function resourceState(resource: Resource, manifest: OfflineManifest, inFlight: readonly string[], failed: readonly string[], usable: UsableCheck = (id) => !!manifest.entries[id]): ResourceState {
  if (resource.mode !== 'download') return resource.mode;
  if (resource.deps.some((id) => inFlight.includes(id))) return 'downloading';
  if (resource.deps.every((id) => !!manifest.entries[id])) return resource.deps.every(usable) ? 'downloaded' : 'incomplete';
  if (resource.deps.some((id) => !manifest.entries[id] && inFlight.includes(id))) return 'downloading';
  if (resource.deps.some((id) => !manifest.entries[id] && failed.includes(id))) return 'failed';
  return 'missing';
}

export function readiness(plan: PreparePlan, manifest: OfflineManifest, inFlight: readonly string[], failed: readonly string[], usable: UsableCheck = (id) => !!manifest.entries[id]) {
  const states = plan.resources.map((resource) => resourceState(resource, manifest, inFlight, failed, usable));
  const missingItems = plan.items.filter((item) => !manifest.entries[item.id]);
  /** Listed on the device but not usable (incomplete / missing from the cache): offer Repair. */
  const incompleteItems = plan.items.filter((item) => !!manifest.entries[item.id] && !usable(item.id) && !inFlight.includes(item.id));
  return {
    states,
    ready: states.filter((s) => s === 'built_in' || s === 'downloaded').length,
    total: states.length,
    missingItems,
    incompleteItems,
    failedItems: missingItems.filter((item) => failed.includes(item.id)),
    downloading: plan.items.some((item) => inFlight.includes(item.id)),
    /** Downloaded entries of this plan - their bytes can be measured for real. */
    downloadedEntries: plan.items.map((item) => manifest.entries[item.id]).filter((entry): entry is NonNullable<typeof entry> => !!entry),
  };
}

/** Download the missing (and failed) items only; what is already on the device is just claimed. */
export const prepareDownload = (plan: PreparePlan, store: () => PackStore) => downloadPackItems(plan.requester, plan.items, store);
/** Cancel this preparation's pending requests - finished downloads stay. */
export const prepareCancel = (plan: PreparePlan, store: () => PackStore) => cancelPackItems(plan.requester, plan.items, store);

/** Re-download listed-but-unusable items (the existing repair path). */
export const prepareRepair = (plan: PreparePlan, incomplete: readonly RegionPackItem[], store: () => PackStore) => repairPackItems(plan.requester, plan.items, incomplete, store);
