import type { AgeExperience } from '@/services/ageExperience/types';

import { visibleEntries, type JournalEntry } from '../journalModel';

/**
 * Journal Memory Collage - a private, local arrangement of the person's OWN
 * Journal memories. Nothing is stored: no collage database, no upload, and
 * Journal entries are never modified. Photos are only the person's own
 * Journal photos; a memory without one becomes a paper/text card - OYNO
 * artwork never stands in for a memory.
 */

export const MIN_SELECTED = 2;
export const MAX_SELECTED = 6;
export const CAPTION_MAX = 80;
/** Short excerpt only - never a whole private note on an image. */
export const NOTE_EXCERPT_MAX = 80;

export type CollageLayout = 'grid' | 'scrapbook' | 'story';
export const LAYOUTS: readonly CollageLayout[] = ['grid', 'scrapbook', 'story'];

export type PhotoState = 'photo' | 'missing' | 'none';

export type CollageItem = {
  id: string;
  title: string;
  /** The memory's own date (YYYY-MM-DD, what the memory is about) - not createdAt. */
  memoryDate: string;
  photoUri: string | null;
  /** 'missing': the memory has a photo but its file isn't on this device. */
  photoState: PhotoState;
  /** Only when the person turned on "Include short notes". */
  excerpt: string | null;
  /** The linked OYNO content's public name, as a small label. */
  linkLabel: string | null;
};

/** Same memories for everyone; children pick fewer and get the simple grid. */
export function collagePresentation(age: AgeExperience): { maxSelected: number; layouts: CollageLayout[]; defaultLayout: CollageLayout; editorial: boolean } {
  switch (age) {
    case 'child':
      return { maxSelected: 4, layouts: ['grid'], defaultLayout: 'grid', editorial: false };
    case 'preteen':
      return { maxSelected: MAX_SELECTED, layouts: [...LAYOUTS], defaultLayout: 'scrapbook', editorial: false };
    case 'adult':
      return { maxSelected: MAX_SELECTED, layouts: [...LAYOUTS], defaultLayout: 'story', editorial: true };
    default:
      return { maxSelected: MAX_SELECTED, layouts: [...LAYOUTS], defaultLayout: 'grid', editorial: false };
  }
}

export function eligibleMemories(entries: JournalEntry[]): JournalEntry[] {
  return visibleEntries(entries);
}

/** The entry point appears only when a collage is possible. */
export function canOfferCollage(entries: JournalEntry[]): boolean {
  return eligibleMemories(entries).length >= MIN_SELECTED;
}

/** Toggle one memory: no duplicates, never more than `max`. */
export function toggleSelection(selected: readonly string[], id: string, max = MAX_SELECTED): string[] {
  if (selected.includes(id)) return selected.filter((value) => value !== id);
  if (selected.length >= max) return [...selected];
  return [...selected, id];
}

export function canCreate(selected: readonly string[], max = MAX_SELECTED): boolean {
  const unique = new Set(selected);
  return unique.size === selected.length && selected.length >= MIN_SELECTED && selected.length <= max;
}

export function cleanCaption(caption: string): string {
  return caption.replace(/\s+/g, ' ').trim().slice(0, CAPTION_MAX);
}

export function noteExcerpt(note: string): string | null {
  const text = note.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > NOTE_EXCERPT_MAX ? `${text.slice(0, NOTE_EXCERPT_MAX - 1).trimEnd()}…` : text;
}

/** Read-only view of the chosen memories, in the order they were picked. */
export function collageItems(entries: JournalEntry[], selected: readonly string[], options: { includeNotes: boolean }): CollageItem[] {
  const byId = new Map(eligibleMemories(entries).map((entry) => [entry.id, entry]));
  return [...new Set(selected)].flatMap((id) => {
    const entry = byId.get(id);
    if (!entry) return [];
    const photoState: PhotoState = entry.photo ? (entry.photo.localUri ? 'photo' : 'missing') : 'none';
    return [
      {
        id: entry.id,
        title: entry.title,
        memoryDate: entry.date,
        photoUri: photoState === 'photo' ? entry.photo!.localUri : null,
        photoState,
        excerpt: options.includeNotes ? noteExcerpt(entry.note) : null,
        linkLabel: entry.link?.label ?? null,
      },
    ];
  });
}
