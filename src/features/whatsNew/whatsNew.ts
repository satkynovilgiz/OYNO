/**
 * What's New - only from REAL database timestamps (published_at /
 * content_updated_at, set by triggers from 20261003000001 on). Rows without
 * them (all content that existed before) are never called new or updated.
 * Learning Paths, games and app features have no trustworthy publication
 * time, so they are not included. "Updated" never implies "verified".
 *
 *   New      published within the last WINDOW_DAYS
 *   Updated  authored text changed within WINDOW_DAYS, at least a day after
 *            publication (a same-day fix of a new item stays just "New")
 */

export const WINDOW_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export type WhatsNewSource = { type: 'culture_item' | 'culture_material'; id: string; title: string; published_at?: string | null; content_updated_at?: string | null; update_note?: string | null };
export type WhatsNewItem = { type: WhatsNewSource['type']; id: string; title: string; kind: 'new' | 'updated'; at: string; note: string | null; route: string };

const time = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
};

export function whatsNewItems(sources: readonly WhatsNewSource[], now: Date): WhatsNewItem[] {
  const since = now.getTime() - WINDOW_DAYS * DAY_MS;
  const seen = new Set<string>();
  const items: WhatsNewItem[] = [];
  for (const source of sources) {
    const key = `${source.type}:${source.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const published = time(source.published_at);
    const updated = time(source.content_updated_at);
    const route = source.type === 'culture_item' ? `/culture/item/${source.id}` : `/culture/material/${source.id}`;
    if (published !== null && published >= since && published <= now.getTime()) {
      items.push({ type: source.type, id: source.id, title: source.title, kind: 'new', at: source.published_at!, note: null, route });
    } else if (updated !== null && updated >= since && updated <= now.getTime() && (published === null || updated - published >= DAY_MS)) {
      items.push({ type: source.type, id: source.id, title: source.title, kind: 'updated', at: source.content_updated_at!, note: source.update_note?.trim() || null, route });
    }
  }
  return items.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}

/** Newer than the last time What's New was opened on this device. */
export function unseenItems(items: readonly WhatsNewItem[], lastViewedAt: string | null): WhatsNewItem[] {
  const last = time(lastViewedAt);
  return last === null ? [...items] : items.filter((item) => Date.parse(item.at) > last);
}
