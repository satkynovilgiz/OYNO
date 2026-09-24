/**
 * A tiny, in-memory trail of TECHNICAL events attached to a beta report
 * ("route opened", "went offline", "sharing unavailable"). Not a recording
 * of the user: no taps, no text, no content, never persisted, never sent
 * anywhere unless the tester submits a report. Capped, oldest dropped.
 */
export type DiagnosticEventType = 'route' | 'offline' | 'online' | 'native_unavailable' | 'screen_error' | 'sync_failed';

export type DiagnosticEvent = { at: string; type: DiagnosticEventType; detail?: string };

const MAX_EVENTS = 20;
const trail: DiagnosticEvent[] = [];

// Anything that could carry user data is reduced to a safe token.
const SAFE_DETAIL = /^[a-z0-9/_:.\-[\]]{0,80}$/i;

/** Route paths keep their shape but lose ids that aren't public content
 * (uuids, long numbers) and any query string. */
export function sanitizeRoute(pathname: string): string {
  const path = pathname.split('?')[0].split('#')[0];
  return path
    .split('/')
    .map((segment) => (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment) || /^\d{5,}$/.test(segment) ? ':id' : segment))
    .join('/')
    .slice(0, 80);
}

export function recordDiagnostic(type: DiagnosticEventType, detail?: string): void {
  const safeDetail = detail === undefined ? undefined : type === 'route' ? sanitizeRoute(detail) : SAFE_DETAIL.test(detail) ? detail : 'redacted';
  const last = trail[trail.length - 1];
  if (last && last.type === type && last.detail === safeDetail) return;
  trail.push({ at: new Date().toISOString(), type, detail: safeDetail });
  if (trail.length > MAX_EVENTS) trail.splice(0, trail.length - MAX_EVENTS);
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
