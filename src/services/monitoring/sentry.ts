import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/**
 * No Sentry account/DSN existed in this project - EXPO_PUBLIC_SENTRY_DSN
 * is unset until the project owner creates a (free) Sentry project and
 * provides one, same pattern as every other optional external service in
 * this codebase (LocalAuthService's fallback, OAuth's "not configured"
 * alerts): initSentry() no-ops instead of throwing when it's missing, so
 * this ships safely today and turns on the moment a DSN is added to .env.
 *
 * Deliberately conservative defaults for a first pass: no PII forwarding
 * (sendDefaultPii off), no performance tracing (tracesSampleRate 0), no
 * session replay - this is crash/error reporting only. Widen later with
 * real product input on what's worth the privacy/cost tradeoff.
 *
 * Not wired here: source-map upload for readable native stack traces
 * (needs the @sentry/react-native/expo config plugin + Metro wrapper +
 * a SENTRY_AUTH_TOKEN build secret, all keyed to a real org/project slug)
 * - JS-level errors/messages still report correctly without it, just with
 * minified stack traces in the Sentry UI until that's set up.
 */
export function initSentry(): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!dsn) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
