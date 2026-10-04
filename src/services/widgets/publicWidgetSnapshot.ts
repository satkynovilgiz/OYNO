import type { SupportedLanguage } from '@/i18n';
import { parseOYNODeepLink } from '@/services/links/contentLinks';

/**
 * "Today in OYNO" - THE iOS Home Screen widget (systemSmall + systemMedium).
 *
 * The app writes this small, PUBLIC-SAFE snapshot into the existing App
 * Group; the widget only renders it (no network, no Supabase, no
 * recalculation in Swift). Only public content metadata: never a token,
 * user id, email, name, age, Journal, notes, listening, study, collections
 * or any private progress.
 *
 * Priority (decided here, by the app's own rules):
 *   1. a Cultural Calendar date today / within 3 days (calendar rules)
 *   2. today's Daily OYNO item (deterministic)
 *   3. nothing -> the widget's bundled fallback ("Explore OYNO")
 * Secondary (medium only): the newest public "What's New" story, else the
 * curated beginner Learning Path (not progress-based).
 */

export const PUBLIC_WIDGET_VERSION = 2;
export const PUBLIC_WIDGET_KEY = 'oyno.widgetSnapshot.v2';
export const WIDGET_KINDS = ['calendar_event', 'daily', 'whats_new', 'learning_path'] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];

export type WidgetCard = { kind: WidgetKind; eyebrow: string; title: string; subtitle: string | null; url: string };

export type PublicWidgetSnapshot = {
  version: 2;
  generatedAt: string;
  language: SupportedLanguage;
  /** Local date the content is for - the widget shows the fallback when it is a past day. */
  localDate: string;
  labels: { brand: string; open: string; fallbackTitle: string; fallbackSubtitle: string };
  primary: WidgetCard | null;
  secondary: WidgetCard | null;
};

export type PublicWidgetInput = {
  language: SupportedLanguage;
  now: Date;
  localDate: string;
  labels: PublicWidgetSnapshot['labels'];
  calendar: { id: string; title: string; dateText: string; isToday: boolean; eyebrowToday: string; eyebrowSoon: string } | null;
  daily: { itemId: string; title: string; eyebrow: string; subtitle: string | null } | null;
  whatsNew: { type: 'culture_item' | 'culture_material'; id: string; title: string; eyebrow: string } | null;
  path: { id: string; title: string; eyebrow: string } | null;
};

const MAX_TEXT = 80;
const clip = (text: string) => (text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text);
const link = (type: string, id: string) => `oyno://open/${type}/${id}`;

export function buildPublicWidgetSnapshot(input: PublicWidgetInput): PublicWidgetSnapshot {
  const calendar: WidgetCard | null = input.calendar
    ? { kind: 'calendar_event', eyebrow: input.calendar.isToday ? input.calendar.eyebrowToday : input.calendar.eyebrowSoon, title: clip(input.calendar.title), subtitle: clip(input.calendar.dateText), url: link('calendar_event', input.calendar.id) }
    : null;
  const daily: WidgetCard | null = input.daily ? { kind: 'daily', eyebrow: input.daily.eyebrow, title: clip(input.daily.title), subtitle: input.daily.subtitle ? clip(input.daily.subtitle) : null, url: link('culture_item', input.daily.itemId) } : null;
  const whatsNew: WidgetCard | null = input.whatsNew ? { kind: 'whats_new', eyebrow: input.whatsNew.eyebrow, title: clip(input.whatsNew.title), subtitle: null, url: link(input.whatsNew.type, input.whatsNew.id) } : null;
  const path: WidgetCard | null = input.path ? { kind: 'learning_path', eyebrow: input.path.eyebrow, title: clip(input.path.title), subtitle: null, url: link('learning_path', input.path.id) } : null;

  const primary = calendar ?? daily;
  const secondary = [daily, whatsNew, path].find((card) => card && card !== primary && card.url !== primary?.url) ?? null;
  return { version: 2, generatedAt: input.now.toISOString(), language: input.language, localDate: input.localDate, labels: input.labels, primary, secondary };
}

const ALLOWED_TOP = ['version', 'generatedAt', 'language', 'localDate', 'labels', 'primary', 'secondary'];
const ALLOWED_CARD = ['kind', 'eyebrow', 'title', 'subtitle', 'url'];
const ALLOWED_LABELS = ['brand', 'open', 'fallbackTitle', 'fallbackSubtitle'];
/** Values that look like credentials or personal identifiers are refused
 * even inside allowed fields (email, JWT, UUID, bearer/session strings). */
const SECRET_LIKE = [/[^\s@]+@[^\s@]+\.[^\s@]+/, /eyJ[\w-]{8,}\.[\w-]{8,}/, /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, /\b(bearer|sb-[a-z]+-auth-token|refresh_token|access_token)\b/i];
const strings = (value: unknown): string[] => (typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : []);

/** The ONLY gate before anything is written to the App Group. */
export function isWidgetSnapshotPublicSafe(value: unknown): value is PublicWidgetSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  if (snapshot.version !== PUBLIC_WIDGET_VERSION) return false;
  // Allow-list only: any extra key (userId, token, progress, journal...) fails.
  if (Object.keys(snapshot).some((key) => !ALLOWED_TOP.includes(key))) return false;
  if (strings(snapshot).some((text) => SECRET_LIKE.some((pattern) => pattern.test(text)))) return false;
  if (!['kg', 'ru', 'en'].includes(snapshot.language as string)) return false;
  if (typeof snapshot.generatedAt !== 'string' || Number.isNaN(Date.parse(snapshot.generatedAt))) return false;
  if (typeof snapshot.localDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.localDate)) return false;
  const labels = snapshot.labels as Record<string, unknown> | null;
  if (!labels || typeof labels !== 'object' || Object.keys(labels).some((key) => !ALLOWED_LABELS.includes(key)) || ALLOWED_LABELS.some((key) => typeof labels[key] !== 'string')) return false;
  for (const slot of ['primary', 'secondary']) {
    const card = snapshot[slot];
    if (card === null) continue;
    if (!card || typeof card !== 'object' || Array.isArray(card)) return false;
    const fields = card as Record<string, unknown>;
    if (Object.keys(fields).some((key) => !ALLOWED_CARD.includes(key))) return false;
    if (!(WIDGET_KINDS as readonly string[]).includes(fields.kind as string)) return false;
    if (typeof fields.title !== 'string' || typeof fields.eyebrow !== 'string' || (fields.subtitle !== null && typeof fields.subtitle !== 'string')) return false;
    if ([fields.title, fields.eyebrow, fields.subtitle].some((text) => typeof text === 'string' && text.length > MAX_TEXT)) return false;
    // Only public content links, validated by the app's own parser.
    if (typeof fields.url !== 'string' || !parseOYNODeepLink(fields.url) || /[?#]/.test(fields.url)) return false;
  }
  return true;
}
