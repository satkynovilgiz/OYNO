/**
 * A tiny, in-memory trail of TECHNICAL events attached to a beta report
 * ("route opened", "went offline", "sharing unavailable"). Not a recording
 * of the user: no taps, no text, no content, never persisted, never sent
 * anywhere unless the tester submits a report. Capped, oldest dropped.
 */
export const DIAGNOSTIC_EVENT_TYPES = ['route', 'offline', 'online', 'native_unavailable', 'screen_error', 'sync_failed', 'playback_error'] as const;
export type DiagnosticEventType = (typeof DIAGNOSTIC_EVENT_TYPES)[number];

export type DiagnosticEvent = { at: string; type: DiagnosticEventType; detail?: string };

export const MAX_TRAIL_EVENTS = 20;
const trail: DiagnosticEvent[] = [];

const MAX_ROUTE_LENGTH = 80;
const MAX_ROUTE_SEGMENTS = 8;
/** The placeholder for a removed value. It survives re-sanitizing unchanged. */
export const ROUTE_PLACEHOLDER = ':id';
/** A public content slug or a fixed route word: "culture", "boz-uy-tunduk", "game-records". */
const PUBLIC_SEGMENT = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The app's top-level routes (src/app). A first segment that isn't one of
 * these (a mistyped or crafted URL) could be anything the person typed, so
 * it is replaced. Kept in step with the route files by a test.
 */
export const KNOWN_TOP_LEVEL_ROUTES = [
  'achievements', 'admin', 'age-group', 'appearance', 'auth-callback', 'avatar-editor', 'challenges', 'character-select', 'collection', 'collections',
  'culture', 'daily', 'explore', 'forgot-password', 'games', 'home', 'journal', 'journey', 'language', 'learn', 'notifications', 'offline', 'onboarding',
  'open', 'profile', 'profile-setup', 'quests', 'reset-password', 'saved', 'search', 'settings', 'sign-in', 'sign-up', 'study', 'trails', 'verify-email',
  'verify-reset-code', 'whats-new',
] as const;
const TOP_LEVEL = new Set<string>(KNOWN_TOP_LEVEL_ROUTES);
/** Deep-link types (services/links/contentLinks.ts CONTENT_LINK_TYPES) - public content only. */
const OPEN_TYPES = new Set(['culture_item', 'culture_material', 'glossary', 'game', 'learning_path', 'komuz_track', 'calendar_event']);
const JOURNAL_STATIC = new Set(['book', 'calendar', 'collage', 'new']);
/** Auth screens never have meaningful extra segments - anything after them could be a token. */
const AUTH_ROUTES = new Set(['auth-callback', 'reset-password', 'verify-email', 'verify-reset-code', 'forgot-password', 'sign-in', 'sign-up']);

/** True when a path segment could identify a person or a private record by its SHAPE. */
function looksPrivate(segment: string): boolean {
  if (!PUBLIC_SEGMENT.test(segment) || segment.length > 48) return true; // tokens, emails, encoded values, mixed case
  if (UUID.test(segment) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment)) return true;
  if (/\d{5,}/.test(segment)) return true; // long numbers (ids, phone numbers, timestamps)
  if (/^uc_/.test(segment)) return true; // My Collections ids
  return segment.length >= 16 && (segment.match(/\d/g)?.length ?? 0) >= 4; // random-looking
}

/**
 * Positions that hold a PRIVATE value by the route's STRUCTURE - whatever
 * the value looks like (a short lowercase id can look like a public slug):
 *   /journal/<entry>                 (not book / calendar / collage / new)
 *   /profile/my-collections/<id>
 *   /open/<type>/<id>                unknown type -> both replaced
 *   /<auth screen>/<anything>
 *   /<unknown top-level route>/...   the whole path is unknown text
 */
function privateByStructure(segments: string[], index: number): boolean {
  const [first, second] = segments;
  if (index === 0) return !TOP_LEVEL.has(first);
  if (!TOP_LEVEL.has(first)) return true;
  if (AUTH_ROUTES.has(first)) return true;
  if (first === 'journal') return index > 1 || !JOURNAL_STATIC.has(second);
  if (first === 'profile' && second === 'my-collections') return index >= 2;
  if (first === 'open') return index === 1 ? !OPEN_TYPES.has(second) : !OPEN_TYPES.has(second) || index > 2;
  return false;
}

/**
 * Route paths keep their public shape and lose every private value:
 *  - scheme, host and credentials go (http/https); for app links
 *    (oyno://open/...) the "host" is the first path segment;
 *  - query strings, fragments and ;params go;
 *  - each segment is decoded once (malformed encoding -> ":id");
 *  - "." segments and empty segments go; ".." -> ":id";
 *  - private values by route structure, then by shape -> ":id";
 *  - at most 8 segments / 80 characters, cut at whole segments only.
 * Idempotent: sanitizeRoute(sanitizeRoute(x)) === sanitizeRoute(x).
 */
export function sanitizeRoute(pathname: string): string {
  let raw = String(pathname ?? '').replace(/\\/g, '/');
  const scheme = raw.match(/^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)/i);
  if (scheme) {
    const host = scheme[2].replace(/^.*@/, ''); // never credentials
    raw = /^https?$/i.test(scheme[1]) ? raw.slice(scheme[0].length) : `/${host}${raw.slice(scheme[0].length)}`;
  }
  const path = raw.split(/[?#;]/)[0];
  const decoded = path
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.')
    .map((segment) => {
      if (segment === ROUTE_PLACEHOLDER) return segment;
      try {
        return decodeURIComponent(segment);
      } catch {
        return ROUTE_PLACEHOLDER;
      }
    });
  const segments = decoded.map((segment, index) =>
    segment === ROUTE_PLACEHOLDER || segment === '..' || privateByStructure(decoded, index) || looksPrivate(segment) ? ROUTE_PLACEHOLDER : segment,
  );
  let out = '';
  for (const segment of segments.slice(0, MAX_ROUTE_SEGMENTS)) {
    if (out.length + 1 + segment.length > MAX_ROUTE_LENGTH) break;
    out += `/${segment}`;
  }
  return out || '/';
}

const IDENTIFIER = /^[a-z][a-z0-9_]{0,31}$/;
export const ERROR_FINGERPRINT = /^[A-Za-z]{1,24}-[0-9a-f]{8}$/;

/** What each event type may carry as `detail` - anything else becomes 'redacted' (or is dropped). */
function sanitizeDetail(type: DiagnosticEventType, detail: unknown): string | undefined {
  if (detail === undefined || detail === null) return undefined;
  if (typeof detail !== 'string') return 'redacted';
  switch (type) {
    case 'route':
      return sanitizeRoute(detail);
    case 'online':
    case 'offline':
      return undefined; // these carry nothing
    case 'screen_error':
      return ERROR_FINGERPRINT.test(detail) || IDENTIFIER.test(detail) ? detail : 'redacted';
    case 'playback_error':
      return detail === 'recording' || detail === 'speech' ? detail : 'redacted';
    default:
      return IDENTIFIER.test(detail) ? detail : 'redacted';
  }
}

const isIso = (value: unknown): value is string => typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value));

/** One trail event re-checked against its schema; null = malformed (dropped). Unknown fields never survive. */
export function sanitizeDiagnosticEvent(raw: unknown): DiagnosticEvent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const event = raw as Record<string, unknown>;
  if (!isIso(event.at) || !(DIAGNOSTIC_EVENT_TYPES as readonly unknown[]).includes(event.type)) return null;
  const type = event.type as DiagnosticEventType;
  const detail = sanitizeDetail(type, event.detail);
  return detail === undefined ? { at: new Date(event.at).toISOString(), type } : { at: new Date(event.at).toISOString(), type, detail };
}

export function recordDiagnostic(type: DiagnosticEventType, detail?: string): void {
  const safeDetail = sanitizeDetail(type, detail);
  const last = trail[trail.length - 1];
  if (last && last.type === type && last.detail === safeDetail) return;
  trail.push(safeDetail === undefined ? { at: new Date().toISOString(), type } : { at: new Date().toISOString(), type, detail: safeDetail });
  if (trail.length > MAX_TRAIL_EVENTS) trail.splice(0, trail.length - MAX_TRAIL_EVENTS);
}

export function diagnosticTrail(): DiagnosticEvent[] {
  return trail.map((event) => ({ ...event }));
}

export function currentRoute(): string | null {
  for (let index = trail.length - 1; index >= 0; index--) if (trail[index].type === 'route') return trail[index].detail ?? null;
  return null;
}

/** Tests only. */
export function __clearDiagnosticTrail(): void {
  trail.length = 0;
}
