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
/** A public content slug or a fixed route word: "culture", "boz-uy-tunduk", "game-records". */
const PUBLIC_SEGMENT = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when a path segment could identify a person or a private record. */
function isPrivateSegment(segment: string): boolean {
  if (!PUBLIC_SEGMENT.test(segment) || segment.length > 48) return true; // tokens, emails, encoded values, mixed case
  if (UUID.test(segment) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment)) return true; // journal entries, users
  if (/\d{5,}/.test(segment)) return true; // long numbers (ids, phone numbers, timestamps)
  if (/^uc_/.test(segment)) return true; // My Collections ids (per person)
  // Random-looking: many digits mixed into letters ("a8f3k2j9...").
  return segment.length >= 16 && (segment.match(/\d/g)?.length ?? 0) >= 4;
}

/**
 * Route paths keep their shape but lose everything that isn't a public
 * route word or content slug: query strings, fragments, credentials
 * ("user:pass@"), scheme/host, ids of private records and anything
 * token-like become ":id". Always starts with "/".
 */
export function sanitizeRoute(pathname: string): string {
  const raw = String(pathname ?? '');
  // Never keep a scheme, host or credentials - only the path.
  const withoutOrigin = raw.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '');
  const path = withoutOrigin.split('?')[0].split('#')[0].split(';')[0];
  const segments = path
    .split('/')
    .filter((segment) => segment.length > 0)
    .slice(0, MAX_ROUTE_SEGMENTS)
    .map((segment) => {
      let decoded = segment;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        return ':id';
      }
      return isPrivateSegment(decoded) ? ':id' : decoded;
    });
  return `/${segments.join('/')}`.slice(0, MAX_ROUTE_LENGTH);
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
