/**
 * Queue capacity and delivery truth: no stored report is ever cut off,
 * capacity is enforced (visibly) when ADDING, and "sent" needs a recorded
 * server confirmation. Concurrency is driven by a gated fake server.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildDiagnostics } from './diagnostics';
import { FEEDBACK_DELIVERED_KEY, FEEDBACK_QUEUE_KEY, feedbackStatus, flushFeedbackQueue, MAX_QUEUED_REPORTS, readFeedbackQueue, retryFeedback, sendFeedbackReport } from './feedbackQueue';

type Gate = { release: () => void; promise: Promise<void> };
const gate = (): Gate => {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => (release = resolve));
  return { release, promise };
};

const mockServer = {
  /** client report id -> the call that created its (single) row. */
  stored: new Map<string, number>(),
  calls: [] as string[],
  /** Each call waits for this gate when set. */
  hold: null as Gate | null,
  /** Answer the next N calls with these errors. */
  errors: [] as { message: string; status?: number; code?: string }[],
};
jest.mock('@/services/supabase/client', () => ({
  supabase: {
    rpc: jest.fn(async (_fn: string, args: { p_client_report_id: string }) => {
      mockServer.calls.push(args.p_client_report_id);
      if (mockServer.hold) await mockServer.hold.promise;
      const error = mockServer.errors.shift();
      if (error) return { data: null, error };
      // Like the real function: one row per client report id, however often it is sent.
      if (!mockServer.stored.has(args.p_client_report_id)) mockServer.stored.set(args.p_client_report_id, mockServer.calls.length);
      return { data: 'ok', error: null };
    }),
    storage: { from: () => ({ upload: jest.fn(async (path: string) => ({ data: { path }, error: null })) }) },
  },
}));

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const storedReport = (n: number, extra: Record<string, unknown> = {}) => ({ clientReportId: uuid(n), createdAt: new Date(Date.UTC(2026, 9, 1, 0, n)).toISOString(), category: 'bug', message: `synthetic report ${n}`, diagnostics: {}, screenshotUri: null, screenshotPath: null, accountId: null, attempts: 0, ...extra });
const input = (message = 'new synthetic report') => ({ category: 'bug' as const, message, diagnostics: buildDiagnostics({ language: 'en', ageMode: null, online: true }), screenshotUri: null, accountId: null });
const offline = { online: false, currentAccountId: null };
const online = { online: true, currentAccountId: null };
const seedQueue = (count: number) => AsyncStorage.setItem(FEEDBACK_QUEUE_KEY, JSON.stringify(Array.from({ length: count }, (_, index) => storedReport(index + 1))));
const offlineNetwork = { message: 'Network request failed' };

beforeEach(async () => {
  await AsyncStorage.clear();
  mockServer.stored.clear();
  mockServer.calls = [];
  mockServer.hold = null;
  mockServer.errors = [];
});

describe('nothing stored is silently lost', () => {
  it('51 valid reports from an older version: all 51 are read, kept and eventually sent', async () => {
    await seedQueue(51);
    expect(await readFeedbackQueue()).toHaveLength(51);
    // Online for 10 sends, then the connection drops: the other 41 stay - including the oldest.
    const rpc = jest.requireMock('@/services/supabase/client').supabase.rpc as jest.Mock;
    const original = rpc.getMockImplementation()!;
    let sends = 0;
    rpc.mockImplementation(async (fn: string, args: { p_client_report_id: string }) => {
      sends += 1;
      return sends > 10 ? { data: null, error: offlineNetwork } : original(fn, args);
    });
    try {
      await flushFeedbackQueue(null);
    } finally {
      rpc.mockImplementation(original);
    }
    expect(mockServer.stored.size).toBe(10);
    const remaining = await readFeedbackQueue();
    expect(remaining).toHaveLength(41);
    expect(remaining.map((report) => report.clientReportId)).toEqual(Array.from({ length: 41 }, (_, index) => uuid(index + 11)));
    // Back online: the rest go out, each exactly once.
    await flushFeedbackQueue(null);
    expect(mockServer.stored.size).toBe(51);
    expect(await readFeedbackQueue()).toEqual([]);
  });

  it('adding to an over-full queue (older version) is refused; the queue is byte-for-byte unchanged', async () => {
    await seedQueue(51);
    const before = await AsyncStorage.getItem(FEEDBACK_QUEUE_KEY);
    const outcome = await sendFeedbackReport(input(), offline);
    expect(outcome).toMatchObject({ result: 'queue_full', clientReportId: null });
    expect(await AsyncStorage.getItem(FEEDBACK_QUEUE_KEY)).toBe(before);
  });
});

describe('capacity is enforced when adding', () => {
  it('the 50th report is accepted, the 51st is refused (never "sent" or "queued")', async () => {
    await seedQueue(MAX_QUEUED_REPORTS - 1);
    expect((await sendFeedbackReport(input('fits'), offline)).result).toBe('queued');
    const full = await sendFeedbackReport(input('does not fit'), offline);
    expect(full.result).toBe('queue_full');
    const queue = await readFeedbackQueue();
    expect(queue).toHaveLength(MAX_QUEUED_REPORTS);
    expect(queue.some((report) => report.message === 'does not fit')).toBe(false);
  });

  it('two reports at once with one slot left: exactly one gets in', async () => {
    await seedQueue(MAX_QUEUED_REPORTS - 1);
    const results = await Promise.all([sendFeedbackReport(input('a'), offline), sendFeedbackReport(input('b'), offline)]);
    expect(results.map((outcome) => outcome.result).sort()).toEqual(['queue_full', 'queued']);
    expect(await readFeedbackQueue()).toHaveLength(MAX_QUEUED_REPORTS);
  });

  it('a storage write failure is "not saved", and nothing else changes', async () => {
    await seedQueue(3);
    const before = await AsyncStorage.getItem(FEEDBACK_QUEUE_KEY);
    (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('quota')));
    expect((await sendFeedbackReport(input(), offline)).result).toBe('not_saved');
    expect(await AsyncStorage.getItem(FEEDBACK_QUEUE_KEY)).toBe(before);
  });

  it('once reports go out there is room again', async () => {
    await seedQueue(MAX_QUEUED_REPORTS);
    expect((await sendFeedbackReport(input(), offline)).result).toBe('queue_full');
    await flushFeedbackQueue(null);
    expect((await sendFeedbackReport(input(), online)).result).toBe('sent');
  });
});

describe('"sent" only with confirmed server acceptance', () => {
  it('confirmed by the server -> sent', async () => {
    const outcome = await sendFeedbackReport(input(), online);
    expect(outcome.result).toBe('sent');
    expect(await feedbackStatus(outcome.clientReportId!)).toBe('sent');
  });

  it('missing from the queue without a confirmation (cleared, removed, never existed) -> unknown, not sent', async () => {
    const outcome = await sendFeedbackReport(input(), offline);
    expect(await feedbackStatus(outcome.clientReportId!)).toBe('queued');
    await AsyncStorage.setItem(FEEDBACK_QUEUE_KEY, '[]'); // e.g. storage cleared by the OS
    expect(await feedbackStatus(outcome.clientReportId!)).toBe('unknown');
    expect(await feedbackStatus(uuid(999))).toBe('unknown');
    // An invalid stored record is not proof either.
    await AsyncStorage.setItem(FEEDBACK_QUEUE_KEY, JSON.stringify([{ ...storedReport(5), category: 'nope' }]));
    expect(await feedbackStatus(uuid(5))).toBe('unknown');
  });

  it('the confirmation record holds report ids only', async () => {
    await sendFeedbackReport(input('synthetic private text 3j8k'), online);
    const ledger = await AsyncStorage.getItem(FEEDBACK_DELIVERED_KEY);
    expect(JSON.parse(ledger!)).toHaveLength(1);
    expect(ledger).not.toContain('synthetic');
  });

  it('a refused report is failed; Retry sends it (server keeps one copy)', async () => {
    mockServer.errors = [{ message: 'INVALID_CATEGORY', status: 400 }];
    const outcome = await sendFeedbackReport(input(), online);
    expect(outcome.result).toBe('failed');
    expect(await retryFeedback(outcome.clientReportId!, online)).toBe('sent');
    expect(mockServer.calls.filter((id) => id === outcome.clientReportId)).toHaveLength(2);
    expect(mockServer.stored.has(outcome.clientReportId!)).toBe(true);
  });

  it('interrupted after the server accepted it: re-sending is harmless and then confirmed', async () => {
    await seedQueue(1);
    // The server stored it, but the app "died" before recording that.
    mockServer.stored.set(uuid(1), 1);
    await flushFeedbackQueue(null);
    expect(mockServer.calls).toEqual([uuid(1)]);
    expect(mockServer.stored.size).toBe(1); // still one row
    expect(await feedbackStatus(uuid(1))).toBe('sent');
  });
});

describe('concurrent enqueue, flush, retry and status', () => {
  it('a report added while a flush runs is kept and sent by the follow-up run', async () => {
    await seedQueue(2);
    mockServer.hold = gate();
    const first = flushFeedbackQueue(null);
    const added = await sendFeedbackReport(input('added during flush'), offline);
    expect(await feedbackStatus(added.clientReportId!)).toBe('queued');
    const second = flushFeedbackQueue(null); // arrives during the run
    mockServer.hold.release();
    mockServer.hold = null;
    await Promise.all([first, second]);
    expect(await readFeedbackQueue()).toEqual([]);
    expect(mockServer.stored.size).toBe(3);
    // Never sent twice in parallel.
    expect(new Set(mockServer.calls).size).toBe(mockServer.calls.length);
  });

  it('Retry during a running flush is not left waiting', async () => {
    mockServer.errors = [{ message: 'INVALID_X', status: 422 }];
    const failed = await sendFeedbackReport(input('to retry'), online);
    expect(failed.result).toBe('failed');
    // The failed one alongside a pending one; the flush is slow.
    await AsyncStorage.setItem(FEEDBACK_QUEUE_KEY, JSON.stringify([storedReport(1), { ...storedReport(2), clientReportId: failed.clientReportId, status: 'failed' }]));
    mockServer.hold = gate();
    const running = flushFeedbackQueue(null);
    const retried = retryFeedback(failed.clientReportId!, online);
    mockServer.hold.release();
    mockServer.hold = null;
    await running;
    expect(await retried).toBe('sent');
    expect(await readFeedbackQueue()).toEqual([]);
  });

  it('unrelated pending reports survive a failure being recorded at the same time', async () => {
    await seedQueue(1);
    mockServer.hold = gate();
    mockServer.errors = [{ message: 'INVALID_X', status: 400 }];
    const running = flushFeedbackQueue(null);
    const added = await sendFeedbackReport(input('unrelated'), offline);
    mockServer.hold.release();
    mockServer.hold = null;
    await running;
    const queue = await readFeedbackQueue();
    expect(queue.find((report) => report.clientReportId === uuid(1))?.status).toBe('failed');
    expect(queue.find((report) => report.clientReportId === added.clientReportId)?.status).toBeUndefined();
  });
});
