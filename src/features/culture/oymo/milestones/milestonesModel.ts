import type { MotifLayer } from '@/services/culture/oymoEditor';
import type { SymmetryMode } from '@/services/culture/symmetry';

/**
 * Revision Gallery - milestones the user EXPLICITLY saves for one saved
 * Oymo creation. Separate from Undo (temporary, in memory) and from Pattern
 * Recipes (how a design was built). Each milestone is an independent deep
 * copy of the design at that moment, tied to owner + creation id - so two
 * identical designs with different ids have separate galleries.
 *
 * Comparisons list actual model changes only (motifs added/removed, moved,
 * recoloured, turned, resized, hidden; background; symmetry) - never a
 * judgement of quality or meaning.
 */
export const MAX_PER_DESIGN = 12;
/** Total stored size per owner (serialized JSON characters). */
export const MAX_OWNER_CHARS = 400_000;
export const LABEL_MAX = 40;

export type Snapshot = { layers: MotifLayer[]; backgroundColor: string; symmetry: SymmetryMode };
export type Milestone = { id: string; label: string; createdAt: string; snapshot: Snapshot };
export type OwnerMilestones = Record<string, Milestone[]>;

export const copySnapshot = (s: Snapshot): Snapshot => ({ layers: s.layers.map((layer) => ({ ...layer, point: { ...layer.point } })), backgroundColor: s.backgroundColor, symmetry: s.symmetry });
export const cleanLabel = (label: string) => label.replace(/[<>{}]/g, '').trim().slice(0, LABEL_MAX);

export type AddResult = { ok: true; next: OwnerMilestones; milestone: Milestone } | { ok: false; reason: 'limit' | 'size' | 'invalid' };
export function addMilestone(all: OwnerMilestones, creationId: string, snapshot: Snapshot, label: string, now: string, id: string): AddResult {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(creationId) || !Array.isArray(snapshot.layers)) return { ok: false, reason: 'invalid' };
  const list = all[creationId] ?? [];
  if (list.length >= MAX_PER_DESIGN) return { ok: false, reason: 'limit' };
  const milestone: Milestone = { id, label: cleanLabel(label), createdAt: now, snapshot: copySnapshot(snapshot) };
  const next = { ...all, [creationId]: [...list, milestone] };
  if (JSON.stringify(next).length > MAX_OWNER_CHARS) return { ok: false, reason: 'size' };
  return { ok: true, next, milestone };
}

export function removeMilestone(all: OwnerMilestones, creationId: string, milestoneId: string): OwnerMilestones {
  const list = all[creationId];
  if (!list?.some((m) => m.id === milestoneId)) return all;
  const rest = list.filter((m) => m.id !== milestoneId);
  const next = { ...all };
  if (rest.length) next[creationId] = rest;
  else delete next[creationId];
  return next;
}
export function removeAllFor(all: OwnerMilestones, creationId: string): OwnerMilestones {
  if (!all[creationId]) return all;
  const next = { ...all };
  delete next[creationId];
  return next;
}

export type Difference =
  | { kind: 'added'; layerId: string; motifId: string }
  | { kind: 'removed'; layerId: string; motifId: string }
  | { kind: 'moved' | 'recoloured' | 'turned' | 'resized' | 'motif' | 'visibility'; layerId: string; motifId: string; from: string; to: string }
  | { kind: 'background'; from: string; to: string }
  | { kind: 'symmetry'; from: SymmetryMode; to: SymmetryMode };

const pos = (layer: MotifLayer) => `${Math.round(layer.point.x)},${Math.round(layer.point.y)}`;
/** What changed from `a` (earlier) to `b` - computed from the stored models, layer by layer id. */
export function compareSnapshots(a: Snapshot, b: Snapshot): Difference[] {
  const out: Difference[] = [];
  const before = new Map(a.layers.map((layer) => [layer.id, layer]));
  const after = new Map(b.layers.map((layer) => [layer.id, layer]));
  for (const layer of b.layers) if (!before.has(layer.id)) out.push({ kind: 'added', layerId: layer.id, motifId: layer.motifId });
  for (const layer of a.layers) {
    const next = after.get(layer.id);
    if (!next) {
      out.push({ kind: 'removed', layerId: layer.id, motifId: layer.motifId });
      continue;
    }
    const base = { layerId: layer.id, motifId: next.motifId };
    if (layer.motifId !== next.motifId) out.push({ kind: 'motif', ...base, from: layer.motifId, to: next.motifId });
    if (pos(layer) !== pos(next)) out.push({ kind: 'moved', ...base, from: pos(layer), to: pos(next) });
    if (layer.color.toLowerCase() !== next.color.toLowerCase()) out.push({ kind: 'recoloured', ...base, from: layer.color, to: next.color });
    if (layer.rotation !== next.rotation) out.push({ kind: 'turned', ...base, from: `${layer.rotation}°`, to: `${next.rotation}°` });
    if (layer.scale !== next.scale) out.push({ kind: 'resized', ...base, from: `${Math.round(layer.scale * 100)}%`, to: `${Math.round(next.scale * 100)}%` });
    if (layer.visible !== next.visible) out.push({ kind: 'visibility', ...base, from: String(layer.visible), to: String(next.visible) });
  }
  if (a.backgroundColor.toLowerCase() !== b.backgroundColor.toLowerCase()) out.push({ kind: 'background', from: a.backgroundColor, to: b.backgroundColor });
  if (a.symmetry !== b.symmetry) out.push({ kind: 'symmetry', from: a.symmetry, to: b.symmetry });
  return out;
}

/** The Creator state for an UNSAVED copy of a milestone (a deep copy - editing it never touches the milestone). */
export function toCreatorCopy(milestone: Milestone) {
  const snapshot = copySnapshot(milestone.snapshot);
  const ids = snapshot.layers.map((layer) => Number(/(\d+)$/.exec(layer.id)?.[1] ?? 0));
  return { state: { layers: snapshot.layers, backgroundColor: snapshot.backgroundColor, nextId: Math.max(snapshot.layers.length, ...ids.map((n) => n + 1)) }, symmetry: snapshot.symmetry };
}

export function normalizeOwnerMilestones(raw: unknown): OwnerMilestones {
  const out: OwnerMilestones = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [creationId, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[A-Za-z0-9-]{1,64}$/.test(creationId) || !Array.isArray(list)) continue;
    const good = list.filter((m): m is Milestone => !!m && typeof (m as Milestone).id === 'string' && !!(m as Milestone).snapshot && Array.isArray((m as Milestone).snapshot.layers) && typeof (m as Milestone).snapshot.backgroundColor === 'string').slice(0, MAX_PER_DESIGN);
    if (good.length) out[creationId] = good.map((m) => ({ id: m.id, label: cleanLabel(String(m.label ?? '')), createdAt: String(m.createdAt ?? ''), snapshot: copySnapshot({ ...m.snapshot, symmetry: (['none', 'mirror', 'fourWay'] as const).includes(m.snapshot.symmetry) ? m.snapshot.symmetry : 'none' }) }));
  }
  return out;
}

export const milestonesRoute = (creationId: string) => `/culture/oymo/milestones/${encodeURIComponent(creationId)}`;
export const newMilestoneId = () => `ms-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
