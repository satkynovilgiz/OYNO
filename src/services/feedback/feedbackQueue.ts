import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { safeJsonParse } from '@/services/storage/safeJson';
import { createUuid } from '@/services/storage/uuid';
import { supabase } from '@/services/supabase/client';

import { sanitizeDiagnostics, type FeedbackDiagnostics } from './diagnostics';

export const FEEDBACK_QUEUE_KEY = 'oyno.feedback.pending';

export type FeedbackCategory = 'bug' | 'ui' | 'content' | 'translation' | 'performance' | 'other';
export const FEEDBACK_CATEGORIES: FeedbackCategory[] = ['bug', 'ui', 'content', 'translation', 'performance', 'other'];

export const MAX_FEEDBACK_LENGTH = 4000;
const MAX_ATTEMPTS = 8;

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
};

export type SubmitResult = 'sent' | 'queued';

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
  return report;
}

function isNetworkError(error: { message?: string; status?: number } | null | undefined): boolean {
  if (!error) return false;
  return /network|fetch|timeout|offline/i.test(error.message ?? '') || error.status === 0;
}

type SendOutcome = 'sent' | 'retry' | 'drop';

async function uploadScreenshot(report: PendingFeedback): Promise<{ path: string | null; retry: boolean }> {
  if (report.screenshotPath || !report.screenshotUri) return { path: report.screenshotPath, retry: false };
  const path = `screenshots/${report.clientReportId}.jpg`;
  try {
    const bytes = await (await fetch(report.screenshotUri)).arrayBuffer();
    const { error } = await supabase.storage.from('beta-feedback').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    // Already uploaded by an earlier, interrupted attempt.
    if (!error || /exists|duplicate/i.test(error.message)) return { path, retry: false };
    return { path: null, retry: isNetworkError(error) };
  } catch (error) {
    // Local file gone (cleared temp) -> send the report without it.
    return { path: null, retry: isNetworkError(error as { message?: string }) };
  }
}

async function sendOne(report: PendingFeedback, currentAccountId: string | null): Promise<{ outcome: SendOutcome; report: PendingFeedback }> {
  const upload = await uploadScreenshot(report);
  if (upload.retry) return { outcome: 'retry', report: { ...report, attempts: report.attempts + 1 } };
  const withPath = { ...report, screenshotPath: upload.path };

  const { error } = await supabase.rpc('submit_beta_feedback', {
    p_client_report_id: withPath.clientReportId,
    p_category: withPath.category,
    p_message: withPath.message,
    p_diagnostics: { ...sanitizeDiagnostics(withPath.diagnostics), ...(report.screenshotUri && !upload.path ? { screenshot: 'not_uploaded' } : {}) },
    p_screenshot_path: withPath.screenshotPath,
    // Linked to an account only if the person who wrote it is the one signed in.
    p_link_account: withPath.accountId !== null && withPath.accountId === currentAccountId,
  });
  if (!error) return { outcome: 'sent', report: withPath };
  const next = { ...withPath, attempts: withPath.attempts + 1 };
  if (isNetworkError(error) || next.attempts < MAX_ATTEMPTS) return { outcome: 'retry', report: next };
  return { outcome: 'drop', report: next };
}

let flushing: Promise<number> | null = null;

/**
 * Sends everything in the queue, oldest first. Single-flight: overlapping
 * calls (reconnect + submit at the same moment) share one run, so a report
 * is never sent twice in parallel. Returns how many were sent.
 */
export function flushFeedbackQueue(currentAccountId: string | null): Promise<number> {
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    for (const report of await readFeedbackQueue()) {
      const { outcome, report: updated } = await sendOne(report, currentAccountId);
      await serialized(async () => {
        const current = await readFeedbackQueue();
        const rest = current.filter((item) => item.clientReportId !== report.clientReportId);
        await writeFeedbackQueue(outcome === 'retry' ? [...rest, updated] : rest);
      });
      if (outcome !== 'retry') deleteLocalScreenshot(report.screenshotUri);
      if (outcome === 'sent') sent += 1;
      if (outcome === 'retry') break; // offline again - try the rest later
    }
    return sent;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/** Queue, then try to send right away. */
export async function submitFeedback(
  input: Parameters<typeof enqueueFeedback>[0],
  options: { online: boolean; currentAccountId: string | null },
): Promise<SubmitResult> {
  const report = await enqueueFeedback(input);
  if (!options.online) return 'queued';
  await flushFeedbackQueue(options.currentAccountId);
  const stillQueued = (await readFeedbackQueue()).some((item) => item.clientReportId === report.clientReportId);
  return stillQueued ? 'queued' : 'sent';
}
