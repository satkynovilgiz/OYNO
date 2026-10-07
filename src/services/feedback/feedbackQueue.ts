import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { safeJsonParse } from '@/services/storage/safeJson';
import { deleteTempImage, FEEDBACK_IMAGE } from '@/services/media/normalizeImage';
import { createUuid } from '@/services/storage/uuid';
import { supabase } from '@/services/supabase/client';

import { sanitizeDiagnostics, type FeedbackDiagnostics } from './diagnostics';
import { isFreshWebImageSource, keepWebAttachment, readWebAttachment, removeWebAttachment, webAttachmentId, type AttachmentDurability } from './webAttachments';
import { isValidReportUrl, legacyCategory, legacyMessage, MAX_CORRECTION_LENGTH, toServerContent, type ReportContent, type ReportContentType } from './reportContent';

export const FEEDBACK_QUEUE_KEY = 'oyno.feedback.pending';
/** Ids (only) of reports the server CONFIRMED - proof for "sent". */
export const FEEDBACK_DELIVERED_KEY = 'oyno.feedback.delivered';
/** How many confirmations are remembered (oldest forgotten first). */
const MAX_DELIVERED_KEPT = 200;
/**
 * Queue capacity, enforced when ADDING a report: a new report is refused
 * (visibly - 'queue_full') rather than pushing an older one out. Reports
 * already stored are never dropped to make room, even when an older app
 * version left more than this.
 */
export const MAX_QUEUED_REPORTS = 50;

/** What a reporter can pick. */
export type FeedbackCategory = 'bug' | 'translation' | 'culture_correction' | 'image' | 'suggestion' | 'other';
export const FEEDBACK_CATEGORIES: FeedbackCategory[] = ['bug', 'translation', 'culture_correction', 'image', 'suggestion', 'other'];
/** Earlier categories - still valid for reports already queued on a phone. */
type LegacyFeedbackCategory = 'ui' | 'content' | 'performance';

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
  category: FeedbackCategory | LegacyFeedbackCategory;
  message: string;
  diagnostics: FeedbackDiagnostics;
  /** Which content a content report is about (public ids only). */
  content?: ReportContent | null;
  /** Local file of an image the tester chose to attach (never automatic). */
  screenshotUri: string | null;
  screenshotPath: string | null;
  /** The tester's explicit "include my email" choice when writing it.
   * false = contactEmail is never sent. Absent = queued by an older version,
   * where an email was only ever stored after that same opt-in. */
  contactConsent?: boolean;
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

/**
 * sent        the server confirmed it (recorded on this device)
 * queued      stored here, waiting to be sent
 * failed      the server refused it; kept for an explicit Retry
 * queue_full  NOT stored: too many reports are waiting (nothing else changed)
 * not_saved   NOT stored: the device couldn't write it (nothing else changed)
 * unknown     not in the queue and no confirmation recorded - never claimed as sent
 */
export type SubmitResult = 'sent' | 'queued' | 'failed' | 'queue_full' | 'not_saved' | 'unknown';

/**
 * What happened to the image the tester attached - so the sheet never
 * shows an image as attached when it isn't:
 *  none            no image was attached
 *  kept            stored with the queued report (native file / web IndexedDB)
 *  session_only    web without IndexedDB: kept only while this page is open
 *  dropped         couldn't be stored - the report is queued without it
 *  sent            uploaded with the report
 *  not_sent        the report was sent without it (image missing or refused)
 */
export type AttachmentState = 'none' | 'kept' | 'session_only' | 'dropped' | 'sent' | 'not_sent';

/** One id per report, created on the device (deduplicates retries). */
export const createReportId = createUuid;

let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

const REPORT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Same shape as an owner id everywhere else (journalPhotos.sanitizeOwner). */
const ACCOUNT_ID = /^[A-Za-z0-9-]{1,64}$/;
const ALL_CATEGORIES: readonly string[] = [...FEEDBACK_CATEGORIES, 'ui', 'content', 'performance'];
const CONTENT_TYPES: readonly ReportContentType[] = ['culture_item', 'culture_material', 'explore_region', 'discovery', 'collection', 'trail', 'game'];
const CONTENT_ID = /^[a-z0-9][a-z0-9_-]{0,119}$/;

/**
 * An image a report may upload: only one OYNO made for feedback - its own
 * kept copy (documents/feedback/<id>.jpg) or a temp capture in the cache.
 * Anything else read back from storage (a journal photo, another app's
 * file, a remote URL, a path with "..") is dropped: the report goes
 * without an image.
 */
export function isFeedbackImageUri(uri: unknown): uri is string {
  // Web: only OYNO's own reference to bytes it stored (see webAttachments.ts).
  if (webAttachmentId(uri)) return true;
  if (typeof uri !== 'string' || uri.length > 1000 || !uri.startsWith('file://') || uri.includes('..') || uri.includes('/journal/')) return false;
  return /\/feedback\/[^/]+\.jpg$/i.test(uri) || /\/(Caches|cache|tmp)\//.test(uri);
}

function parseContent(raw: unknown): ReportContent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (!CONTENT_TYPES.includes(value.contentType as ReportContentType) || typeof value.contentId !== 'string' || !CONTENT_ID.test(value.contentId)) return null;
  const content: ReportContent = { contentType: value.contentType as ReportContentType, contentId: value.contentId, language: value.language === 'ru' || value.language === 'en' ? value.language : 'kg' };
  if (typeof value.suggestedCorrection === 'string' && value.suggestedCorrection.trim()) content.suggestedCorrection = value.suggestedCorrection.slice(0, MAX_CORRECTION_LENGTH);
  if (typeof value.sourceUrl === 'string' && isValidReportUrl(value.sourceUrl)) content.sourceUrl = value.sourceUrl.trim();
  return content;
}

const isIso = (value: unknown): value is string => typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value));

/**
 * One queued report read back from storage, re-validated as if it were
 * new (old versions, interrupted writes or tampering): null when it can't
 * be a real report (no valid id / category / message), otherwise rebuilt
 * from validated fields only - unknown fields are dropped and diagnostics
 * are re-sanitized with the report's own email consent.
 */
export function parseQueuedReport(raw: unknown): PendingFeedback | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.clientReportId !== 'string' || !REPORT_ID.test(value.clientReportId)) return null;
  if (typeof value.category !== 'string' || !ALL_CATEGORIES.includes(value.category)) return null;
  if (typeof value.message !== 'string' || !value.message.trim()) return null;
  const clientReportId = value.clientReportId;
  const contactConsent = typeof value.contactConsent === 'boolean' ? value.contactConsent : undefined;
  const screenshotPath = value.screenshotPath === `screenshots/${clientReportId}.jpg` ? value.screenshotPath : null;
  const report: PendingFeedback = {
    clientReportId,
    createdAt: isIso(value.createdAt) ? value.createdAt : new Date(0).toISOString(),
    category: value.category as PendingFeedback['category'],
    message: value.message.slice(0, MAX_FEEDBACK_LENGTH),
    diagnostics: sanitizeDiagnostics(value.diagnostics, { allowContactEmail: contactConsent !== false }),
    content: parseContent(value.content),
    // A web reference must name THIS report's own stored image.
    screenshotUri: isFeedbackImageUri(value.screenshotUri) && (!webAttachmentId(value.screenshotUri) || webAttachmentId(value.screenshotUri) === clientReportId) ? value.screenshotUri : null,
    screenshotPath,
    accountId: typeof value.accountId === 'string' && ACCOUNT_ID.test(value.accountId) ? value.accountId : null,
    attempts: typeof value.attempts === 'number' && Number.isInteger(value.attempts) && value.attempts >= 0 ? Math.min(value.attempts, 1000) : 0,
  };
  if (contactConsent !== undefined) report.contactConsent = contactConsent;
  if (value.status === 'failed') report.status = 'failed';
  if (typeof value.failureCode === 'string' && /^[A-Za-z0-9_]{1,16}$/.test(value.failureCode)) report.failureCode = value.failureCode;
  return report;
}

export async function readFeedbackQueue(): Promise<PendingFeedback[]> {
  const parsed = safeJsonParse<unknown>(await AsyncStorage.getItem(FEEDBACK_QUEUE_KEY).catch(() => null), []);
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  const reports: PendingFeedback[] = [];
  // Every valid stored report - none is cut off to fit a limit.
  for (const item of parsed) {
    let report: PendingFeedback | null = null;
    try {
      report = parseQueuedReport(item);
    } catch {
      report = null; // never let one stored value stop the queue
    }
    if (report && !seen.has(report.clientReportId)) {
      seen.add(report.clientReportId);
      reports.push(report);
    }
  }
  return reports;
}

/** false = not stored (the queue on disk is unchanged). */
async function writeFeedbackQueue(items: PendingFeedback[]): Promise<boolean> {
  return AsyncStorage.setItem(FEEDBACK_QUEUE_KEY, JSON.stringify(items)).then(
    () => true,
    () => false,
  );
}

async function readDelivered(): Promise<string[]> {
  const parsed = safeJsonParse<unknown>(await AsyncStorage.getItem(FEEDBACK_DELIVERED_KEY).catch(() => null), []);
  return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string' && REPORT_ID.test(id)) : [];
}

async function recordDelivered(clientReportId: string): Promise<void> {
  const delivered = (await readDelivered()).filter((id) => id !== clientReportId);
  delivered.push(clientReportId);
  await AsyncStorage.setItem(FEEDBACK_DELIVERED_KEY, JSON.stringify(delivered.slice(-MAX_DELIVERED_KEPT))).catch(() => undefined);
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
  content?: ReportContent | null;
  screenshotUri: string | null;
  accountId: string | null;
  /** The tester ticked "include my email". Without it no email is stored or sent. */
  contactConsent?: boolean;
}): Promise<PendingFeedback> {
  return (await enqueueWithAttachment(input)).report;
}

/** The report was NOT added to the queue. Nothing already queued changed. */
export class FeedbackQueueError extends Error {
  constructor(readonly reason: 'queue_full' | 'storage_failed') {
    super(reason);
    this.name = 'FeedbackQueueError';
  }
}

async function enqueueWithAttachment(input: Parameters<typeof enqueueFeedback>[0]): Promise<{ report: PendingFeedback; attachment: AttachmentState }> {
  const clientReportId = createReportId();
  let screenshotUri: string | null = null;
  let attachment: AttachmentState = 'none';
  if (input.screenshotUri && isFreshWebImageSource(input.screenshotUri)) {
    // Web: a blob: URL dies with the page - keep the bytes instead.
    const kept: { uri: string; durability: AttachmentDurability } | null = await keepWebAttachment(input.screenshotUri, clientReportId, FEEDBACK_IMAGE.maxBytes);
    screenshotUri = kept?.uri ?? null;
    attachment = !kept ? 'dropped' : kept.durability === 'durable' ? 'kept' : 'session_only';
  } else if (input.screenshotUri) {
    screenshotUri = await keepScreenshot(input.screenshotUri, clientReportId);
    attachment = isFeedbackImageUri(screenshotUri) ? 'kept' : 'dropped';
    if (attachment === 'dropped') screenshotUri = null;
  }
  const report: PendingFeedback = {
    clientReportId,
    createdAt: new Date().toISOString(),
    category: input.category,
    message: input.message.trim().slice(0, MAX_FEEDBACK_LENGTH),
    diagnostics: sanitizeDiagnostics(input.diagnostics, { allowContactEmail: input.contactConsent === true }),
    contactConsent: input.contactConsent === true,
    content: parseContent(input.content),
    screenshotUri,
    screenshotPath: null,
    accountId: input.accountId,
    attempts: 0,
  };
  const stored = await serialized(async () => {
    const current = await readFeedbackQueue();
    // Capacity is checked against what is REALLY stored, inside the same
    // serialized step as the write - two reports at once can't both squeeze in.
    if (current.length >= MAX_QUEUED_REPORTS) return 'full' as const;
    return (await writeFeedbackQueue([...current, report])) ? ('ok' as const) : ('failed' as const);
  });
  if (stored !== 'ok') {
    // Not queued: whatever was copied for it goes; the tester's text stays in the sheet.
    deleteLocalScreenshot(report.screenshotUri);
    await removeWebAttachment(report.screenshotUri);
    throw new FeedbackQueueError(stored === 'full' ? 'queue_full' : 'storage_failed');
  }
  // The temp image is now in the queue's own storage.
  if (input.screenshotUri && report.screenshotUri && report.screenshotUri !== input.screenshotUri) deleteTempImage(input.screenshotUri);
  return { report, attachment };
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

/** PostgREST "function not found" - the v2 migration isn't applied yet. */
export function isMissingFunction(error: ErrorLike): boolean {
  return error?.code === 'PGRST202' || /could not find the function/i.test(error?.message ?? '');
}

/** 'uploaded' / 'none' (no image) / 'retry' (temporary) / 'skipped' (the
 * image was permanently refused - the text report still goes out). */
async function uploadScreenshot(report: PendingFeedback): Promise<{ path: string | null; state: 'uploaded' | 'none' | 'retry' | 'skipped' }> {
  if (report.screenshotPath) return { path: report.screenshotPath, state: 'uploaded' };
  if (!report.screenshotUri) return { path: null, state: 'none' };
  const path = `screenshots/${report.clientReportId}.jpg`;
  let bytes: ArrayBuffer;
  if (webAttachmentId(report.screenshotUri)) {
    // Web: the bytes stored with the report (gone after a reload without IndexedDB).
    const stored = await readWebAttachment(report.screenshotUri);
    if (!stored) return { path: null, state: 'skipped' };
    bytes = stored;
  } else {
    try {
      bytes = await (await fetch(report.screenshotUri)).arrayBuffer();
    } catch {
      // The local file is gone (cleared temp storage) - send without it.
      return { path: null, state: 'skipped' };
    }
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

/** How the last successful send of a report went for its image (this app run). */
const sentImage = new Map<string, 'sent' | 'not_sent'>();

async function sendOne(report: PendingFeedback, currentAccountId: string | null): Promise<{ outcome: SendOutcome; report: PendingFeedback }> {
  const upload = await uploadScreenshot(report);
  if (upload.state === 'retry') return { outcome: 'retry', report: { ...report, attempts: report.attempts + 1 } };
  const withPath = { ...report, screenshotPath: upload.path };

  const common = {
    p_client_report_id: withPath.clientReportId,
    // An optional screenshot that couldn't be uploaded never sinks the report.
    // The final boundary: re-checked again right before it leaves the device.
    p_diagnostics: { ...sanitizeDiagnostics(withPath.diagnostics, { allowContactEmail: withPath.contactConsent !== false }), ...(upload.state === 'skipped' ? { screenshot: 'not_uploaded' } : {}) },
    p_screenshot_path: withPath.screenshotPath,
    // Linked to an account only if the person who wrote it is the one signed in.
    p_link_account: withPath.accountId !== null && withPath.accountId === currentAccountId,
  };
  let { error } = await supabase.rpc('submit_beta_feedback_v2', { ...common, p_category: withPath.category, p_message: withPath.message, p_content: toServerContent(withPath.content) });
  // A server without v2 yet: send through the original function, with the
  // nearest old category and the content context kept in the message.
  if (error && isMissingFunction(error)) {
    ({ error } = await supabase.rpc('submit_beta_feedback', { ...common, p_category: legacyCategory(withPath.category), p_message: legacyMessage(withPath.message, withPath.content) }));
  }
  if (!error) {
    if (report.screenshotUri || report.screenshotPath) sentImage.set(report.clientReportId, upload.state === 'uploaded' ? 'sent' : 'not_sent');
    return { outcome: 'sent', report: withPath };
  }
  const next = { ...withPath, attempts: withPath.attempts + 1 };
  if (shouldRetry(classifyFailure(error), next.attempts)) return { outcome: 'retry', report: next };
  return { outcome: 'failed', report: { ...next, status: 'failed', failureCode: failureCode(error) } };
}

let running: Promise<number> | null = null;
let queued: Promise<number> | null = null;

function keepRecentFailures(items: PendingFeedback[]): PendingFeedback[] {
  const failed = items.filter((item) => item.status === 'failed');
  if (failed.length <= MAX_FAILED_KEPT) return items;
  const drop = new Set(failed.slice(0, failed.length - MAX_FAILED_KEPT).map((item) => item.clientReportId));
  for (const item of items) {
    if (!drop.has(item.clientReportId)) continue;
    deleteLocalScreenshot(item.screenshotUri);
    void removeWebAttachment(item.screenshotUri);
  }
  return items.filter((item) => !drop.has(item.clientReportId));
}

async function runFlush(currentAccountId: string | null): Promise<number> {
  let sent = 0;
  for (const report of await readFeedbackQueue()) {
    if (report.status === 'failed') continue;
    const { outcome, report: updated } = await sendOne(report, currentAccountId);
    await serialized(async () => {
      // Proof first: "sent" is only ever answered from this record.
      if (outcome === 'sent') await recordDelivered(report.clientReportId);
      // Re-read: reports added, retried or changed meanwhile are kept as they are now.
      const current = await readFeedbackQueue();
      const next =
        outcome === 'sent'
          ? current.filter((item) => item.clientReportId !== report.clientReportId)
          : current.map((item) => (item.clientReportId === report.clientReportId && item.status !== 'failed' ? { ...updated, attempts: Math.max(updated.attempts, item.attempts) } : item));
      await writeFeedbackQueue(keepRecentFailures(next));
    });
    if (outcome === 'sent') {
      deleteLocalScreenshot(report.screenshotUri);
      await removeWebAttachment(report.screenshotUri);
      sent += 1;
    }
    if (outcome === 'retry') break; // offline again - try the rest later
  }
  return sent;
}

/**
 * Sends every PENDING report, oldest first. At most ONE run at a time, so
 * a report is never sent twice in parallel; a call that arrives during a
 * run gets ONE follow-up run (shared by every such caller), so a report
 * queued or retried meanwhile is not left waiting. A report is removed
 * ONLY after the server accepted it (and that is recorded); a permanently
 * refused one is marked 'failed' (kept, not auto-retried). The server
 * stores each client report id once, so a retry after an interrupted
 * send is harmless. Returns how many this call's run(s) sent.
 */
export function flushFeedbackQueue(currentAccountId: string | null): Promise<number> {
  if (!running) {
    running = runFlush(currentAccountId).finally(() => {
      running = null;
    });
    return running;
  }
  if (!queued) {
    const previous = running;
    queued = previous
      .catch(() => 0)
      .then(() => {
        queued = null;
        return flushFeedbackQueue(currentAccountId);
      });
  }
  return queued;
}

/** Where a report stands now. 'sent' only with a recorded server confirmation. */
export async function feedbackStatus(clientReportId: string): Promise<SubmitResult> {
  const report = (await readFeedbackQueue()).find((item) => item.clientReportId === clientReportId);
  if (report) return report.status === 'failed' ? 'failed' : 'queued';
  // Gone from the queue is NOT proof: only a recorded server confirmation is.
  return (await readDelivered()).includes(clientReportId) ? 'sent' : 'unknown';
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
): Promise<{ result: SubmitResult; clientReportId: string | null; attachment: AttachmentState }> {
  let enqueued: Awaited<ReturnType<typeof enqueueWithAttachment>>;
  try {
    enqueued = await enqueueWithAttachment(input);
  } catch (error) {
    // Not stored at all: say so - never 'sent' or 'queued'. The queue is unchanged.
    if (error instanceof FeedbackQueueError) return { result: error.reason === 'queue_full' ? 'queue_full' : 'not_saved', clientReportId: null, attachment: 'none' };
    throw error;
  }
  const { report, attachment } = enqueued;
  if (options.online) await flushFeedbackQueue(options.currentAccountId);
  const result = await feedbackStatus(report.clientReportId);
  return { result, clientReportId: report.clientReportId, attachment: result === 'sent' ? (sentImage.get(report.clientReportId) ?? attachment) : attachment };
}

/** Queue, then try to send right away. 'sent' only when the server has it. */
export async function submitFeedback(
  input: Parameters<typeof enqueueFeedback>[0],
  options: { online: boolean; currentAccountId: string | null },
): Promise<SubmitResult> {
  return (await sendFeedbackReport(input, options)).result;
}
