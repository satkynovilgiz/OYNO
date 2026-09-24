import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

import { currentRoute, diagnosticTrail, type DiagnosticEvent } from './diagnosticTrail';

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
  online: boolean;
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
  return sanitizeDiagnostics(diagnostics);
}

/** Drops every key that isn't on the allow-list (defence in depth for
 * anything read back from storage, too). */
export function sanitizeDiagnostics(value: Record<string, unknown> | FeedbackDiagnostics): FeedbackDiagnostics {
  const clean: Record<string, unknown> = {};
  for (const key of DIAGNOSTIC_KEYS) if (key in value) clean[key] = (value as Record<string, unknown>)[key];
  return clean as FeedbackDiagnostics;
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
