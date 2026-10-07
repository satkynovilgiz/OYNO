import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

import { currentRoute, diagnosticTrail, ERROR_FINGERPRINT, MAX_TRAIL_EVENTS, sanitizeDiagnosticEvent, sanitizeRoute, type DiagnosticEvent } from './diagnosticTrail';

/**
 * The technical context attached to a beta report, so a tester never has
 * to explain their phone/app state by hand.
 *
 * Built from an explicit ALLOW-list - nothing is copied wholesale from
 * Constants/Updates/auth, so a new field can't leak in by accident.
 * Never included: auth tokens or session, password, email (unless the
 * tester ticks "include my email"), user id (linked server-side only),
 * the device's personal name (Constants.deviceName - often "<Name>'s
 * iPhone"), location, journal/private notes, message text of errors.
 */
export type FeedbackDiagnostics = {
  appVersion: string | null;
  buildNumber: string | null;
  platform: string;
  osVersion: string;
  deviceClass: string | null;
  deviceModel: string | null;
  language: string;
  ageMode: string | null;
  route: string | null;
  /** null = unknown (e.g. a malformed stored value). */
  online: boolean | null;
  channel: string | null;
  runtimeVersion: string | null;
  updateId: string | null;
  embeddedBuild: boolean | null;
  trail: DiagnosticEvent[];
  errorFingerprint?: string;
  contactEmail?: string;
};

export const DIAGNOSTIC_KEYS: (keyof FeedbackDiagnostics)[] = [
  'appVersion',
  'buildNumber',
  'platform',
  'osVersion',
  'deviceClass',
  'deviceModel',
  'language',
  'ageMode',
  'route',
  'online',
  'channel',
  'runtimeVersion',
  'updateId',
  'embeddedBuild',
  'trail',
  'errorFingerprint',
  'contactEmail',
];

type PlatformConstants = { interfaceIdiom?: string; Model?: string; Manufacturer?: string };

function safe<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

export type DiagnosticsInput = {
  language: string;
  ageMode: string | null;
  online: boolean;
  route?: string | null;
  errorFingerprint?: string;
  /** Only when the tester explicitly opted in. */
  contactEmail?: string | null;
};

export function buildDiagnostics(input: DiagnosticsInput): FeedbackDiagnostics {
  const platformConstants = safe(() => (Platform.constants ?? {}) as PlatformConstants, {});
  const diagnostics: FeedbackDiagnostics = {
    appVersion: safe(() => Constants.expoConfig?.version ?? null, null),
    buildNumber: safe(
      () => (Platform.OS === 'ios' ? (Constants.platform?.ios?.buildNumber ?? null) : Platform.OS === 'android' ? String(Constants.platform?.android?.versionCode ?? '') || null : null),
      null,
    ),
    platform: Platform.OS,
    osVersion: String(Platform.Version ?? ''),
    // 'phone' / 'pad' on iOS; model on Android - never the personal device name.
    deviceClass: platformConstants.interfaceIdiom ?? null,
    deviceModel: Platform.OS === 'android' ? [platformConstants.Manufacturer, platformConstants.Model].filter(Boolean).join(' ') || null : null,
    language: input.language,
    ageMode: input.ageMode,
    route: input.route ?? currentRoute(),
    online: input.online,
    channel: safe(() => Updates.channel ?? null, null),
    runtimeVersion: safe(() => Updates.runtimeVersion ?? null, null),
    updateId: safe(() => Updates.updateId ?? null, null),
    embeddedBuild: safe(() => (Updates.isEnabled ? Updates.isEmbeddedLaunch : null), null),
    trail: diagnosticTrail(),
  };
  if (input.errorFingerprint) diagnostics.errorFingerprint = input.errorFingerprint;
  if (input.contactEmail) diagnostics.contactEmail = input.contactEmail;
  // The caller passes an email only when the tester ticked "include my email".
  return sanitizeDiagnostics(diagnostics, { allowContactEmail: !!input.contactEmail });
}

/** The whole diagnostics object, as sent, stays below this (JSON characters). */
export const MAX_DIAGNOSTICS_CHARS = 6000;

const PLATFORMS = new Set(['ios', 'android', 'web', 'windows', 'macos']);
const DEVICE_CLASSES = new Set(['phone', 'pad', 'tv', 'carplay', 'vision', 'unspecified', 'desktop']);
const AGE_MODES = new Set(['child', 'preteen', 'teen', 'adult']);
const EMAIL = /^[^\s@"'<>()[\],;:\\]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

const text = (value: unknown, pattern: RegExp): string | null => (typeof value === 'string' && pattern.test(value) ? value : null);

/**
 * Re-checks diagnostics field by field - TYPES and allowed VALUES, not only
 * key names - so injected or malformed data (including reports read back
 * from storage, written by older versions or tampered with) can't survive:
 *  - only the allow-listed keys, each rebuilt from a validated value;
 *  - trail events re-checked one by one against their schema; malformed
 *    events dropped; unknown nested fields never copied; at most 20;
 *  - routes reduced to public route words / content slugs (no query,
 *    fragment, credentials or private ids);
 *  - contactEmail only with explicit consent (`allowContactEmail`);
 *  - the whole object bounded (oldest trail events go first).
 * Never throws.
 */
export function sanitizeDiagnostics(value: unknown, options: { allowContactEmail?: boolean } = {}): FeedbackDiagnostics {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const field = (key: keyof FeedbackDiagnostics): unknown => (Object.prototype.hasOwnProperty.call(raw, key) ? raw[key] : undefined);
  const platform = field('platform');
  const route = field('route');
  const trailRaw = field('trail');
  const clean: FeedbackDiagnostics = {
    appVersion: text(field('appVersion'), /^[0-9A-Za-z.+-]{1,32}$/),
    buildNumber: text(field('buildNumber'), /^[0-9A-Za-z.]{1,16}$/),
    platform: typeof platform === 'string' && PLATFORMS.has(platform) ? platform : 'unknown',
    osVersion: text(field('osVersion'), /^[0-9A-Za-z._ -]{1,32}$/) ?? '',
    deviceClass: typeof field('deviceClass') === 'string' && DEVICE_CLASSES.has(field('deviceClass') as string) ? (field('deviceClass') as string) : null,
    deviceModel: text(field('deviceModel'), /^[A-Za-z0-9][A-Za-z0-9 ._()+-]{0,59}$/),
    language: text(field('language'), /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/) ?? 'unknown',
    ageMode: typeof field('ageMode') === 'string' && AGE_MODES.has(field('ageMode') as string) ? (field('ageMode') as string) : null,
    route: typeof route === 'string' && route.length <= 2000 ? sanitizeRoute(route) : null,
    online: typeof field('online') === 'boolean' ? (field('online') as boolean) : null,
    channel: text(field('channel'), /^[A-Za-z0-9._-]{1,40}$/),
    runtimeVersion: text(field('runtimeVersion'), /^[A-Za-z0-9._:-]{1,64}$/),
    updateId: text(field('updateId'), /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
    embeddedBuild: typeof field('embeddedBuild') === 'boolean' ? (field('embeddedBuild') as boolean) : null,
    trail: Array.isArray(trailRaw)
      ? trailRaw
          .slice(-MAX_TRAIL_EVENTS * 5)
          .map(sanitizeDiagnosticEvent)
          .filter((event): event is DiagnosticEvent => !!event)
          .slice(-MAX_TRAIL_EVENTS)
      : [],
  };
  const fingerprint = text(field('errorFingerprint'), ERROR_FINGERPRINT);
  if (fingerprint) clean.errorFingerprint = fingerprint;
  const email = field('contactEmail');
  if (options.allowContactEmail && typeof email === 'string' && email.length <= 254 && EMAIL.test(email.trim())) clean.contactEmail = email.trim();
  // Overall bound: every field is already bounded; trim the trail if needed.
  while (clean.trail.length > 0 && JSON.stringify(clean).length > MAX_DIAGNOSTICS_CHARS) clean.trail = clean.trail.slice(1);
  return clean;
}

/** A stable, content-free id for a crash: the error's type plus a short
 * hash - the same crash groups together, but the raw message (which could
 * contain text from the screen) never leaves the device. */
export function errorFingerprint(error: { name?: string; message?: string }): string {
  const source = `${error.name ?? 'Error'}:${error.message ?? ''}`;
  let hash = 5381;
  for (let index = 0; index < source.length; index++) hash = ((hash << 5) + hash + source.charCodeAt(index)) | 0;
  const name = (error.name ?? 'Error').replace(/[^A-Za-z]/g, '').slice(0, 24) || 'Error';
  return `${name}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Screens where "Attach current screen" is switched off because they can
 * show private data (sign-in forms, account details, admin, the private
 * Journal). The tester can still pick an image themselves.
 */
const SENSITIVE_ROUTE_PREFIXES = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/verify-reset-code',
  '/auth-callback',
  '/profile-setup',
  '/settings/account',
  '/settings/security',
  '/settings/privacy',
  '/settings/data',
  '/admin',
  '/journal',
];

export function isSensitiveRoute(route: string | null | undefined): boolean {
  if (!route) return true;
  return SENSITIVE_ROUTE_PREFIXES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
}
