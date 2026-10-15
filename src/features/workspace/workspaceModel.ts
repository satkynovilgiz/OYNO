import type { ShelfItem, ShelfType, SourceState } from '@/features/shelf/shelfModel';

/**
 * Project workspaces - a personal page for ONE existing project (an Oymo
 * design or a Mini Museum exhibition). A workspace stores only a REFERENCE
 * (type + the project's stable id), a private note and a few dates. The
 * project itself is always read from its own source through the Shelf
 * adapters (shelfModel.ts) and edited in its own screen - there is no
 * second editor or copy of the project here.
 *
 *   key = '<type>:<id>'  (the same key the Shelf uses)
 *
 * The note is private: it is never part of the project, never passed to a
 * share card or export, and never written to the project's record.
 * `titleSnapshot` is the project's title the last time the workspace
 * resolved it - shown only where the project isn't loaded (Home), labelled
 * as the project, and refreshed from the live record.
 */
export type ProjectType = 'design' | 'exhibition';
export const PROJECT_TYPES: readonly ProjectType[] = ['design', 'exhibition'];
export type ProjectRef = { type: ProjectType; id: string };

export const NOTE_MAX = 1000;
export const TITLE_SNAPSHOT_MAX = 80;
export const MAX_WORKSPACES = 30;
const SAFE_ID = /^[A-Za-z0-9_-]{1,100}$/;

export type Workspace = { type: ProjectType; id: string; note: string; titleSnapshot: string; createdAt: string; updatedAt: string; openedAt: string };
export type OwnerWorkspaces = Record<string, Workspace>;

export const projectKey = (ref: ProjectRef) => `${ref.type}:${ref.id}`;
export function parseProjectKey(key: unknown): ProjectRef | null {
  if (typeof key !== 'string') return null;
  const at = key.indexOf(':');
  const type = key.slice(0, at) as ProjectType;
  const id = key.slice(at + 1);
  return at > 0 && PROJECT_TYPES.includes(type) && SAFE_ID.test(id) ? { type, id } : null;
}

const iso = (value: unknown) => (typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : new Date(0).toISOString());
const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');

/** One owner's stored workspaces, bounded; invalid entries are dropped. */
export function normalizeWorkspaces(raw: unknown): OwnerWorkspaces {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: OwnerWorkspaces = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const ref = parseProjectKey(key);
    if (!ref || !value || typeof value !== 'object') continue;
    const entry = value as Partial<Workspace>;
    if (entry.type !== ref.type || entry.id !== ref.id) continue;
    out[key] = {
      type: ref.type,
      id: ref.id,
      note: clean(entry.note, NOTE_MAX),
      titleSnapshot: clean(entry.titleSnapshot, TITLE_SNAPSHOT_MAX),
      createdAt: iso(entry.createdAt),
      updatedAt: iso(entry.updatedAt),
      openedAt: iso(entry.openedAt),
    };
  }
  return out;
}

export type WorkspaceChange =
  { kind: 'add'; ref: ProjectRef; title: string; now: string } | { kind: 'note'; key: string; note: string; now: string } | { kind: 'opened'; key: string; title: string | null; now: string } | { kind: 'remove'; key: string };

/**
 * The next state, or `current` itself when nothing changes, or null when the
 * change isn't allowed (an unknown workspace, the limit reached).
 */
export function applyWorkspaceChange(current: OwnerWorkspaces, change: WorkspaceChange): OwnerWorkspaces | null {
  if (change.kind === 'add') {
    const key = projectKey(change.ref);
    if (!SAFE_ID.test(change.ref.id) || !PROJECT_TYPES.includes(change.ref.type)) return null;
    if (current[key]) return applyWorkspaceChange(current, { kind: 'opened', key, title: change.title, now: change.now });
    if (Object.keys(current).length >= MAX_WORKSPACES) return null;
    return { ...current, [key]: { type: change.ref.type, id: change.ref.id, note: '', titleSnapshot: change.title.slice(0, TITLE_SNAPSHOT_MAX), createdAt: change.now, updatedAt: change.now, openedAt: change.now } };
  }
  const entry = current[change.key];
  if (!entry) return null;
  if (change.kind === 'remove') {
    const next = { ...current };
    delete next[change.key];
    return next;
  }
  if (change.kind === 'note') {
    const note = change.note.slice(0, NOTE_MAX);
    if (note === entry.note) return current;
    return { ...current, [change.key]: { ...entry, note, updatedAt: change.now } };
  }
  const titleSnapshot = change.title === null ? entry.titleSnapshot : change.title.slice(0, TITLE_SNAPSHOT_MAX);
  return { ...current, [change.key]: { ...entry, titleSnapshot, openedAt: change.now } };
}

/** Most recently opened first (stable on ties). */
export const recentWorkspaces = (workspaces: OwnerWorkspaces): Workspace[] => Object.values(workspaces).sort((a, b) => b.openedAt.localeCompare(a.openedAt) || projectKey(a).localeCompare(projectKey(b)));

/* ---------- the project behind a workspace (live, from its own source) ---------- */

export type ProjectResolution = { status: 'loading' } | { status: 'ready'; item: ShelfItem } | { status: 'missing' } | { status: 'unavailable'; reason: 'signedOut' | 'offline' } | { status: 'error'; retry: () => void };

/**
 * Looks the reference up in the project's own source. Only a READY source
 * can say "missing" (deleted) - loading, offline or a failed load is never
 * reported as deleted.
 */
export function resolveProject(ref: ProjectRef, sources: Record<ShelfType, SourceState>): ProjectResolution {
  const source = sources[ref.type];
  if (source.status !== 'ready') return source;
  const item = source.items.find((entry) => entry.key === projectKey(ref));
  return item ? { status: 'ready', item } : { status: 'missing' };
}

/* ---------- the actions the project type actually supports ---------- */

export type ActionGroupId = 'edit' | 'preview' | 'export';
export type ProjectAction = { id: string; labelKey: string; hintKey: string } & ({ kind: 'route'; route: string } | { kind: 'surfacePreview' | 'museumPreview' | 'shareDesign' | 'shareExhibition' });
export type ActionGroup = { id: ActionGroupId; actions: ProjectAction[] };

/** Each action opens the project's EXISTING screen (or its existing share card). */
export function actionsFor(ref: ProjectRef): ActionGroup[] {
  const id = encodeURIComponent(ref.id);
  const a = (action: string, rest: { kind: 'route'; route: string } | { kind: 'surfacePreview' | 'museumPreview' | 'shareDesign' | 'shareExhibition' }): ProjectAction => ({
    id: action,
    labelKey: `workspace.actions.${ref.type}.${action}`,
    hintKey: `workspace.actions.${ref.type}.${action}Hint`,
    ...rest,
  });
  if (ref.type === 'design')
    return [
      { id: 'edit', actions: [a('edit', { kind: 'route', route: `/culture/oymo/create?creation=${id}` }), a('milestones', { kind: 'route', route: `/culture/oymo/milestones/${id}` })] },
      { id: 'preview', actions: [a('surfaces', { kind: 'surfacePreview' })] },
      { id: 'export', actions: [a('postcard', { kind: 'route', route: `/culture/oymo/postcard?pattern=${id}` }), a('share', { kind: 'shareDesign' })] },
    ];
  return [
    { id: 'edit', actions: [a('edit', { kind: 'route', route: `/profile/my-collections/museum?collection=${id}` }), a('collection', { kind: 'route', route: `/profile/my-collections/${id}` })] },
    { id: 'preview', actions: [a('visitorPreview', { kind: 'museumPreview' })] },
    { id: 'export', actions: [a('share', { kind: 'shareExhibition' })] },
  ];
}

/* ---------- saved record vs. recoverable drafts ---------- */

/**
 * Drafts that belong to this project, from the editors' own draft sources
 * (the Recovery Center's): unsaved design-portfolio edits that include the
 * design. Exhibitions save every change as it is made, and the Oymo Creator
 * keeps no draft after it is closed - so for them there is nothing to recover,
 * and the workspace says so rather than guessing.
 */
export type RelatedDraft = { id: string; kind: 'portfolio'; title: string; route: string };
export function relatedDrafts(ref: ProjectRef, portfolioDrafts: readonly { id: string; title: string; entries: readonly { creationId: string }[] }[]): RelatedDraft[] {
  if (ref.type !== 'design') return [];
  return portfolioDrafts
    .filter((draft) => draft.entries.some((entry) => entry.creationId === ref.id))
    .map((draft) => ({ id: `portfolio:${draft.id}`, kind: 'portfolio' as const, title: draft.title, route: `/profile/oymo-portfolios/${encodeURIComponent(draft.id)}` }));
}

/** The unsaved private note's state: what is typed vs. what is stored. */
export type NoteState = 'clean' | 'unsaved';
export const noteState = (typed: string, stored: string): NoteState => (typed.slice(0, NOTE_MAX) === stored ? 'clean' : 'unsaved');
