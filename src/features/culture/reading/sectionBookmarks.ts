import { isSectionKey } from '@/features/culture/reader/navigator/sectionNavigator';

import type { ReadingContentType } from './readingModel';

/**
 * Reading Companion - bookmarks of NAMED article sections, each with an
 * optional note in the reader's own words. A bookmark points at a section
 * by its stable KEY (the authored field: "history", "cultural_meaning"),
 * never by position or pixels - so when an article changes, a note stays
 * on its own section, or is marked "section no longer in the article";
 * it never moves to another section.
 *
 * A bookmark says only that the reader marked the section - not that it
 * was read or understood.
 */
export const NOTE_MAX = 600;
export const MAX_BOOKMARKS = 200;

export type SectionBookmark = {
  contentType: ReadingContentType;
  contentId: string;
  sectionKey: string;
  /** Titles at the time of bookmarking - shown if the article or section is gone. */
  articleTitle: string;
  sectionLabel: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};
export type Bookmarks = Record<string, SectionBookmark>;

export const bookmarkKey = (contentType: string, contentId: string, sectionKey: string) => `${contentType}:${contentId}#${sectionKey}`;
const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/[<>{}]/g, '').slice(0, max) : '');
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

/** Adds the bookmark, or updates its note (one per section). */
export function upsertBookmark(data: Bookmarks, input: { contentType: ReadingContentType; contentId: string; sectionKey: string; articleTitle: string; sectionLabel: string; note: string }, now = new Date()): Bookmarks {
  if (!isSectionKey(input.sectionKey) || !SAFE_ID.test(input.contentId)) return data;
  const key = bookmarkKey(input.contentType, input.contentId, input.sectionKey);
  const existing = data[key];
  if (!existing && Object.keys(data).length >= MAX_BOOKMARKS) return data;
  const at = now.toISOString();
  return {
    ...data,
    [key]: {
      contentType: input.contentType,
      contentId: input.contentId,
      sectionKey: input.sectionKey,
      articleTitle: clean(input.articleTitle, 160) || existing?.articleTitle || '',
      sectionLabel: clean(input.sectionLabel, 80) || existing?.sectionLabel || '',
      note: clean(input.note, NOTE_MAX),
      createdAt: existing?.createdAt ?? at,
      updatedAt: at,
    },
  };
}
export function removeBookmark(data: Bookmarks, key: string): Bookmarks {
  if (!data[key]) return data;
  const next = { ...data };
  delete next[key];
  return next;
}

/** Newest first. */
export const listBookmarks = (data: Bookmarks) => Object.entries(data).sort(([, a], [, b]) => b.updatedAt.localeCompare(a.updatedAt));

export type BookmarkStatus = 'ok' | 'sectionMissing' | 'articleMissing' | 'unknown';
/**
 * Where a bookmark stands NOW. `sections` = the article's rendered section
 * keys (null while the article isn't known yet / loading).
 */
export function bookmarkStatus(bookmark: SectionBookmark, article: { exists: boolean; sections: readonly string[] | null } | null): BookmarkStatus {
  if (!article) return 'unknown';
  if (!article.exists) return 'articleMissing';
  if (!article.sections) return 'unknown';
  return article.sections.includes(bookmark.sectionKey) ? 'ok' : 'sectionMissing';
}

/** The route that reopens the bookmarked section by its anchor (the article's own `section` param). */
export function bookmarkRoute(bookmark: Pick<SectionBookmark, 'contentType' | 'contentId' | 'sectionKey'>): string {
  const base = bookmark.contentType === 'culture_item' ? `/culture/item/${bookmark.contentId}` : `/culture/material/${bookmark.contentId}`;
  return `${base}?section=${encodeURIComponent(bookmark.sectionKey)}`;
}

export function normalizeBookmarks(raw: unknown): Bookmarks {
  const out: Bookmarks = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const value of Object.values(raw as Record<string, Partial<SectionBookmark>>)) {
    if (!value || (value.contentType !== 'culture_item' && value.contentType !== 'culture_material') || typeof value.contentId !== 'string' || !SAFE_ID.test(value.contentId) || !isSectionKey(value.sectionKey)) continue;
    const key = bookmarkKey(value.contentType, value.contentId, value.sectionKey);
    out[key] = {
      contentType: value.contentType,
      contentId: value.contentId,
      sectionKey: value.sectionKey,
      articleTitle: clean(value.articleTitle, 160),
      sectionLabel: clean(value.sectionLabel, 80),
      note: clean(value.note, NOTE_MAX),
      createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
    };
  }
  return out;
}
