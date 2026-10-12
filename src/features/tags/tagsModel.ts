/**
 * Theme tags - PERSONAL organisation for the owner's own saved records
 * (not cultural classification). A tag stores only references - stable
 * record type + id - never a copy of the record. Deleting or merging tags
 * never touches the records. Time capsules are not taggable (their sealed
 * contents stay out of every other view).
 */
export const TAG_TYPES = ['note', 'question', 'moment', 'scrapbook', 'design', 'board'] as const;
export type TagRecordType = (typeof TAG_TYPES)[number];
export type RecordRef = { type: TagRecordType; id: string };
export type Tag = { id: string; name: string; createdAt: string };
export type OwnerTags = { tags: Record<string, Tag>; refs: Record<string, RecordRef[]> };
export const EMPTY_TAGS: OwnerTags = { tags: {}, refs: {} };
export const NAME_MAX = 30;
export const MAX_TAGS = 50;
export const MAX_REFS_PER_TAG = 200;

const REF_ID = /^[A-Za-z0-9_.:#-]{1,160}$/;
export const refKey = (ref: RecordRef) => `${ref.type}|${ref.id}`;
export const validRef = (ref: unknown): ref is RecordRef => !!ref && typeof ref === 'object' && (TAG_TYPES as readonly string[]).includes((ref as RecordRef).type) && typeof (ref as RecordRef).id === 'string' && REF_ID.test((ref as RecordRef).id);
export const cleanName = (name: string) => name.replace(/[<>{}]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
const sameName = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

export type TagChange =
  | { type: 'create'; id: string; name: string; now: string }
  | { type: 'rename'; id: string; name: string }
  | { type: 'merge'; from: string; into: string }
  | { type: 'delete'; id: string }
  | { type: 'attach'; id: string; ref: RecordRef }
  | { type: 'detach'; id: string; ref: RecordRef };

/** One change; returns the SAME object when it isn't allowed (duplicate name, unknown tag, limits) or changes nothing. */
export function applyTagChange(data: OwnerTags, change: TagChange): OwnerTags {
  const names = Object.values(data.tags);
  switch (change.type) {
    case 'create': {
      const name = cleanName(change.name);
      if (!name || names.length >= MAX_TAGS || data.tags[change.id] || names.some((t) => sameName(t.name, name))) return data;
      return { tags: { ...data.tags, [change.id]: { id: change.id, name, createdAt: change.now } }, refs: { ...data.refs, [change.id]: [] } };
    }
    case 'rename': {
      const tag = data.tags[change.id];
      const name = cleanName(change.name);
      if (!tag || !name || name === tag.name || names.some((t) => t.id !== tag.id && sameName(t.name, name))) return data;
      return { ...data, tags: { ...data.tags, [tag.id]: { ...tag, name } } };
    }
    case 'merge': {
      if (change.from === change.into || !data.tags[change.from] || !data.tags[change.into]) return data;
      const seen = new Set<string>();
      const merged = [...(data.refs[change.into] ?? []), ...(data.refs[change.from] ?? [])].filter((ref) => {
        const k = refKey(ref);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      const tags = { ...data.tags };
      const refs = { ...data.refs, [change.into]: merged.slice(0, MAX_REFS_PER_TAG) };
      delete tags[change.from];
      delete refs[change.from];
      return { tags, refs };
    }
    case 'delete': {
      if (!data.tags[change.id]) return data;
      const tags = { ...data.tags };
      const refs = { ...data.refs };
      delete tags[change.id];
      delete refs[change.id];
      return { tags, refs };
    }
    case 'attach': {
      const list = data.refs[change.id] ?? [];
      if (!data.tags[change.id] || !validRef(change.ref) || list.length >= MAX_REFS_PER_TAG || list.some((r) => refKey(r) === refKey(change.ref))) return data;
      return { ...data, refs: { ...data.refs, [change.id]: [...list, { type: change.ref.type, id: change.ref.id }] } };
    }
    case 'detach': {
      const list = data.refs[change.id] ?? [];
      if (!list.some((r) => refKey(r) === refKey(change.ref))) return data;
      return { ...data, refs: { ...data.refs, [change.id]: list.filter((r) => refKey(r) !== refKey(change.ref)) } };
    }
  }
}

export const tagsOf = (data: OwnerTags, ref: RecordRef) => Object.values(data.tags).filter((tag) => (data.refs[tag.id] ?? []).some((r) => refKey(r) === refKey(ref)));
export const sortedTags = (data: OwnerTags) => Object.values(data.tags).sort((a, b) => a.name.localeCompare(b.name));

export function normalizeTags(raw: unknown): OwnerTags {
  if (!raw || typeof raw !== 'object') return EMPTY_TAGS;
  const value = raw as Partial<OwnerTags>;
  const tags: Record<string, Tag> = {};
  const refs: Record<string, RecordRef[]> = {};
  for (const [id, tag] of Object.entries(value.tags ?? {})) {
    if (!tag || tag.id !== id || typeof tag.name !== 'string' || !cleanName(tag.name)) continue;
    tags[id] = { id, name: cleanName(tag.name), createdAt: String(tag.createdAt ?? '') };
    const seen = new Set<string>();
    refs[id] = (Array.isArray(value.refs?.[id]) ? value.refs![id] : []).filter((r) => validRef(r) && !seen.has(refKey(r)) && !!seen.add(refKey(r))).slice(0, MAX_REFS_PER_TAG);
  }
  return { tags, refs };
}

export const newTagId = () => `tag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
export const tagRoute = (id: string) => `/profile/tags/${encodeURIComponent(id)}`;
