import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { safeJsonParse } from '@/services/storage/safeJson';
import { deleteTempImage, FEEDBACK_IMAGE } from '@/services/media/normalizeImage';
import { createUuid } from '@/services/storage/uuid';
import { supabase } from '@/services/supabase/client';

import { sanitizeDiagnostics, type FeedbackDiagnostics } from './diagnostics';

export const FEEDBACK_QUEUE_KEY = 'oyno.feedback.pending';

export type FeedbackCategory = 'bug' | 'ui' | 'content' | 'translation' | 'performance' | 'other';
export const FEEDBACK_CATEGORIES: FeedbackCategory[] = ['bug', 'ui', 'content', 'translation', 'performance', 'other'];

export const MAX_FEEDBACK_LENGTH = 4000;
/** Unclassified errors are retried this many times, then the report fails. */
const MAX_ATTEMPTS = 8;
/** Failed reports kept for a manual Retry; older ones are dropped. */
const MAX_FAILED_KEPT = 5;

/**
 * One report waiting to be sent. Reports are written to this queue FIRST
 * and sent from it, so "offline" and "online" are the same code path: a
 * report that can't go out now simply stays here until the connection is
 * back. `clientReportId` is generated once on the device and is unique on
 * the server, so however many times a send is retried the server stores
 * it once.
 */
export type PendingFeedback = {
  clientReportId: string;
  createdAt: string;
  category: FeedbackCategory;
  message: string;
  diagnostics: FeedbackDiagnostics;
  /** Local file of an image the tester chose to attach (never automatic). */
  screenshotUri: string | null;
  screenshotPath: string | null;
  /** Who wrote it (null = guest). If a different person is signed in
   * when it finally sends, it is sent unlinked rather than attributed to them. */
  accountId: string | null;
  attempts: number;
  /** 'failed' = the server permanently refused it: never auto-retried, kept
   * for an explicit Retry, and never reported as sent. Absent = pending. */
  status?: 'pending' | 'failed';
  /** Content-free reason for a failure (an error code), for diagnostics. */
  failureCode?: string;
};

export type SubmitResult = 'sent' | 'queued' | 'failed';

/** One id per report, created on the device (deduplicates retries). */
export const createReportId = createUuid;

let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

export async function readFeedbackQueue(): Promise<PendingFeedback[]> {
  const parsed = safeJsonParse<unknown>(await AsyncStorage.getItem(FEEDBACK_QUEUE_KEY).catch(() => null), []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is PendingFeedback => !!item && typeof item === 'object' && typeof (item as PendingFeedback).clientReportId === 'string');
}

async function writeFeedbackQueue(items: PendingFeedback[]): Promise<void> {
  await AsyncStorage.setItem(FEEDBACK_QUEUE_KEY, JSON.stringify(items)).catch(() => {});
}

function fileSystemAvailable(): boolean {
  return Platform.OS !== 'web' && !!requireOptionalNativeModule('FileSystem');
}

/** Moves a temporary capture somewhere that survives until it's sent. */
async function keepScreenshot(uri: string, reportId: string): Promise<string> {
  if (!fileSystemAvailable()) return uri;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Directory, File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
    const folder = new Directory(Paths.document, 'feedback');
    if (!folder.exists) folder.create();
    const target = new File(folder, `${reportId}.jpg`);
    await new File(uri).copy(target);
    return target.uri;
  } catch {
    return uri;
  }
}

function deleteLocalScreenshot(uri: string | null): void {
  if (!uri || !fileSystemAvailable() || !uri.includes('/feedback/')) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { File } = require('expo-file-system') as typeof import('expo-file-system');
    new File(uri).delete();
  } catch {
    // Already gone - nothing to clean up.
  }
}

export async function enqueueFeedback(input: {
  category: FeedbackCategory;
  message: string;
  diagnostics: FeedbackDiagnostics;
  screenshotUri: string | null;
  accountId: string | null;
}): Promise<PendingFeedback> {
  const clientReportId = createReportId();
  const report: PendingFeedback = {
    clientReportId,
    createdAt: new Date().toISOString(),
    category: input.category,
    message: input.message.trim().slice(0, MAX_FEEDBACK_LENGTH),
    diagnostics: sanitizeDiagnostics(input.diagnostics),
    screenshotUri: input.screenshotUri ? await keepScreenshot(input.screenshotUri, clientReportId) : null,
    screenshotPath: null,
    accountId: input.accountId,
    attempts: 0,
  };
  await serialized(async () => writeFeedbackQueue([...(await readFeedbackQueue()), report]));
  // The temp image is now in the queue's own storage.
  if (input.screenshotUri && report.screenshotUri !== input.screenshotUri) deleteTempImage(input.screenshotUri);
  return report;
}

type ErrorLike = { message?: string; status?: number; statusCode?: string | number; code?: string } | null | undefined;

export type FailureKind = 'temporary' | 'permanent' | 'unknown';

/**
 * temporary -> stay queued and retry later (offline, timeout, network,
 *              server overload, rate limiting)
 * permanent -> the server rejected THIS report (invalid request, rejected
 *              payload, unsupported upload); retrying can't help.
 * unknown   -> retried, but only MAX_ATTEMPTS times, then 'failed'.
 */
export function classifyFailure(error: ErrorLike): FailureKind {
  if (!error) return 'unknown';
  const message = error.message ?? '';
  const status = Number(error.status ?? error.statusCode ?? NaN);
  if (/network|fetch|timeout|timed out|offline|RATE_LIMITED/i.test(message) || status === 0 || status === 408 || status === 429 || status >= 500) return 'temporary';
  if ([400, 401, 403, 404, 409, 413, 415, 422].includes(status)) return 'permanent';
  if (/INVALID_|violates|invalid input|payload too large|mime type|not supported/i.test(message)) return 'permanent';
  if (typeof error.code === 'string' && /^(22|23)\d{3}$|^PGRST(1|2)\d{2}$/.test(error.code)) return 'permanent';
  return 'unknown';
}

/** Keep trying? Temporary: always. Unknown: a limited number of times. */
function shouldRetry(kind: FailureKind, attemptsSoFar: number): boolean {
  return kind === 'temporary' || (kind === 'unknown' && attemptsSoFar < MAX_ATTEMPTS);
}

function failureCode(error: ErrorLike): string {
  const code = error?.code ?? error?.statusCode ?? error?.status;
  return code !== undefined && /^[A-Za-z0-9_]{1,16}$/.test(String(code)) ? String(code) : 'error';
}

type SendOutcome = 'sent' | 'retry' | 'failed';

/** 'uploaded' / 'none' (no image) / 'retry' (temporary) / 'skipped' (the
 * image was permanently refused - the text report still goes out). */
async function uploadScreenshot(report: PendingFeedback): Promise<{ path: string | null; state: 'uploaded' | 'none' | 'retry' | 'skipped' }> {
  if (report.screenshotPath) return { path: report.screenshotPath, state: 'uploaded' };
  if (!report.screenshotUri) return { path: null, state: 'none' };
  const path = `screenshots/${report.clientReportId}.jpg`;
  let bytes: ArrayBuffer;
  try {
    bytes = await (await fetch(report.screenshotUri)).arrayBuffer();
  } catch {
    // The local file is gone (cleared temp storage) - send without it.
    return { path: null, state: 'skipped' };
  }
  // Over the bucket limit (3 MB): send the text without the image.
  if (bytes.byteLength > FEEDBACK_IMAGE.maxBytes) return { path: null, state: 'skipped' };
  try {
    const { error } = await supabase.storage.from('beta-feedback').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    // Already uploaded by an earlier, interrupted attempt.
    if (!error || /exists|duplicate/i.test(error.message)) return { path, state: 'uploaded' };
    if (shouldRetry(classifyFailure(error), report.attempts + 1)) return { path: null, state: 'retry' };
    return { path: null, state: 'skipped' };
  } catch (error) {
    return shouldRetry(classifyFailure(error as ErrorLike), report.attempts + 1) ? { path: null, state: 'retry' } : { path: null, state: 'skipped' };
  }
}

async function sendOne(report: PendingFeedback, currentAccountId: string | null): Promise<{ outcome: SendOutcome; report: PendingFeedback }> {
  const upload = await uploadScreenshot(report);
  if (upload.state === 'retry') return { outcome: 'retry', report: { ...report, attempts: report.attempts + 1 } };
  const withPath = { ...report, screenshotPath: upload.path };

  const { error } = await supabase.rpc('submit_beta_feedback', {
    p_client_report_id: withPath.clientReportId,
    p_category: withPath.category,
    p_message: withPath.message,
    // An optional screenshot that couldn't be uploaded never sinks the report.
    p_diagnostics: { ...sanitizeDiagnostics(withPath.diagnostics), ...(upload.state === 'skipped' ? { screenshot: 'not_uploaded' } : {}) },
    p_screenshot_path: withPath.screenshotPath,
    // Linked to an account only if the person who wrote it is the one signed in.
    p_link_account: withPath.accountId !== null && withPath.accountId === currentAccountId,
  });
  if (!error) return { outcome: 'sent', report: withPath };
  const next = { ...withPath, attempts: withPath.attempts + 1 };
  if (shouldRetry(classifyFailure(error), next.attempts)) return { outcome: 'retry', report: next };
  return { outcome: 'failed', report: { ...next, status: 'failed', failureCode: failureCode(error) } };
}

let flushing: Promise<number> | null = null;

function keepRecentFailures(items: PendingFeedback[]): PendingFeedback[] {
  const failed = items.filter((item) => item.status === 'failed');
  if (failed.length <= MAX_FAILED_KEPT) return items;
  const drop = new Set(failed.slice(0, failed.length - MAX_FAILED_KEPT).map((item) => item.clientReportId));
  return items.filter((item) => !drop.has(item.clientReportId));
}

/**
 * Sends every PENDING report, oldest first. Single-flight: overlapping
 * calls (reconnect + submit at the same moment) share one run, so a report
 * is never sent twice in parallel. A report is removed ONLY after the
 * server accepted it; a permanently refused one is marked 'failed' (kept,
 * not auto-retried). Returns how many were sent.
 */
export function flushFeedbackQueue(currentAccountId: string | null): Promise<number> {
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    for (const report of await readFeedbackQueue()) {
      if (report.status === 'failed') continue;
      const { outcome, report: updated } = await sendOne(report, currentAccountId);
      await serialized(async () => {
        const current = await readFeedbackQueue();
        const next = outcome === 'sent' ? current.filter((item) => item.clientReportId !== report.clientReportId) : current.map((item) => (item.clientReportId === report.clientReportId ? updated : item));
        await writeFeedbackQueue(keepRecentFailures(next));
      });
      if (outcome === 'sent') {
        deleteLocalScreenshot(report.screenshotUri);
        sent += 1;
      }
      if (outcome === 'retry') break; // offline again - try the rest later
    }
    return sent;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/** Where a report stands now: gone from the queue means the server has it. */
export async function feedbackStatus(clientReportId: string): Promise<SubmitResult> {
  const report = (await readFeedbackQueue()).find((item) => item.clientReportId === clientReportId);
  if (!report) return 'sent';
  return report.status === 'failed' ? 'failed' : 'queued';
}

/** Explicit Retry of a failed report (from the failure screen). */
export async function retryFeedback(clientReportId: string, options: { online: boolean; currentAccountId: string | null }): Promise<SubmitResult> {
  await serialized(async () => {
    const items = await readFeedbackQueue();
    await writeFeedbackQueue(items.map((item) => (item.clientReportId === clientReportId ? { ...item, status: 'pending', attempts: 0, failureCode: undefined } : item)));
  });
  if (options.online) await flushFeedbackQueue(options.currentAccountId);
  return feedbackStatus(clientReportId);
}

/** Queue, try to send, and report exactly where this report stands. */
export async function sendFeedbackReport(
  input: Parameters<typeof enqueueFeedback>[0],
  options: { online: boolean; currentAccountId: string | null },
): Promise<{ result: SubmitResult; clientReportId: string }> {
  const report = await enqueueFeedback(input);
  if (options.online) await flushFeedbackQueue(options.currentAccountId);
  return { result: await feedbackStatus(report.clientReportId), clientReportId: report.clientReportId };
}

/** Queue, then try to send right away. 'sent' only when the server has it. */
export async function submitFeedback(
  input: Parameters<typeof enqueueFeedback>[0],
  options: { online: boolean; currentAccountId: string | null },
): Promise<SubmitResult> {
  return (await sendFeedbackReport(input, options)).result;
}
