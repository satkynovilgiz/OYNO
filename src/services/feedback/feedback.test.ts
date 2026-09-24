import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/services/supabase/client';

import { __clearDiagnosticTrail, diagnosticTrail, recordDiagnostic, sanitizeRoute } from './diagnosticTrail';
import { buildDiagnostics, DIAGNOSTIC_KEYS, errorFingerprint, isSensitiveRoute, sanitizeDiagnostics } from './diagnostics';
import { flushFeedbackQueue, readFeedbackQueue, submitFeedback } from './feedbackQueue';

// A fake server that, like submit_beta_feedback, stores each
// client_report_id at most once.
const mockServer = {
  reports: new Map<string, Record<string, unknown>>(),
  uploads: [] as string[],
  failNextWith: null as null | { message: string },
  rpcCalls: 0,
};

jest.mock('@/services/supabase/client', () => ({
  supabase: {
    rpc: jest.fn(async (_fn: string, args: Record<string, unknown>) => {
      mockServer.rpcCalls += 1;
      if (mockServer.failNextWith) {
        const error = mockServer.failNextWith;
        mockServer.failNextWith = null;
        return { data: null, error };
      }
      const id = args.p_client_report_id as string;
      if (!mockServer.reports.has(id)) mockServer.reports.set(id, args);
      return { data: 'server-id', error: null };
    }),
    storage: {
      from: () => ({
        upload: jest.fn(async (path: string) => {
          mockServer.uploads.push(path);
          return { data: { path }, error: null };
        }),
      }),
    },
  },
}));

const mockRpc = supabase.rpc as jest.Mock;

const baseInput = {
  category: 'bug' as const,
  message: '  The map froze after zooming  ',
  diagnostics: buildDiagnostics({ language: 'en', ageMode: 'adult', online: true, route: '/explore/map' }),
  screenshotUri: null,
};

beforeEach(async () => {
  await AsyncStorage.clear();
  mockServer.reports.clear();
  mockServer.uploads = [];
  mockServer.failNextWith = null;
  mockServer.rpcCalls = 0;
  mockRpc.mockClear();
  __clearDiagnosticTrail();
  (globalThis as { fetch?: unknown }).fetch = jest.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) }));
});

describe('submitting beta feedback', () => {
  it('sends a signed-in report linked to that account', async () => {
    const result = await submitFeedback({ ...baseInput, accountId: 'user-a' }, { online: true, currentAccountId: 'user-a' });

    expect(result).toBe('sent');
    expect(await readFeedbackQueue()).toEqual([]);
    const [args] = [...mockServer.reports.values()];
    expect(args).toMatchObject({ p_category: 'bug', p_message: 'The map froze after zooming', p_link_account: true, p_screenshot_path: null });
  });

  it('accepts a guest report (not linked to any account)', async () => {
    const result = await submitFeedback({ ...baseInput, accountId: null }, { online: true, currentAccountId: null });
    expect(result).toBe('sent');
    expect([...mockServer.reports.values()][0]).toMatchObject({ p_link_account: false });
  });

  it("never attributes a queued report to a different person who signed in later", async () => {
    await submitFeedback({ ...baseInput, accountId: 'user-a' }, { online: false, currentAccountId: 'user-a' });
    await flushFeedbackQueue('user-b');
    expect([...mockServer.reports.values()][0]).toMatchObject({ p_link_account: false });
  });
});

describe('offline queue', () => {
  it('queues a report while offline and sends nothing', async () => {
    const result = await submitFeedback({ ...baseInput, accountId: null }, { online: false, currentAccountId: null });
    expect(result).toBe('queued');
    expect(mockRpc).not.toHaveBeenCalled();
    expect(await readFeedbackQueue()).toHaveLength(1);
  });

  it('sends queued reports when the connection returns', async () => {
    await submitFeedback({ ...baseInput, accountId: null }, { online: false, currentAccountId: null });
    await submitFeedback({ ...baseInput, message: 'Second', accountId: null }, { online: false, currentAccountId: null });

    const sent = await flushFeedbackQueue(null);

    expect(sent).toBe(2);
    expect(mockServer.reports.size).toBe(2);
    expect(await readFeedbackQueue()).toEqual([]);
  });

  it('keeps a report queued when the network drops mid-send, then sends it', async () => {
    mockServer.failNextWith = { message: 'Network request failed' };
    const result = await submitFeedback({ ...baseInput, accountId: null }, { online: true, currentAccountId: null });
    expect(result).toBe('queued');
    expect(await readFeedbackQueue()).toHaveLength(1);

    await flushFeedbackQueue(null);
    expect(mockServer.reports.size).toBe(1);
    expect(await readFeedbackQueue()).toEqual([]);
  });
});

describe('duplicate prevention', () => {
  it('overlapping sends (reconnect + submit at once) deliver each report once', async () => {
    await submitFeedback({ ...baseInput, accountId: null }, { online: false, currentAccountId: null });
    await Promise.all([flushFeedbackQueue(null), flushFeedbackQueue(null), flushFeedbackQueue(null)]);
    expect(mockServer.rpcCalls).toBe(1);
    expect(mockServer.reports.size).toBe(1);
  });

  it('a retried report keeps its client id, so the server stores it once', async () => {
    mockServer.failNextWith = { message: 'fetch failed' };
    await submitFeedback({ ...baseInput, accountId: null }, { online: true, currentAccountId: null });
    const [queued] = await readFeedbackQueue();
    await flushFeedbackQueue(null);
    expect([...mockServer.reports.keys()]).toEqual([queued.clientReportId]);
  });
});

describe('screenshots', () => {
  it('is optional: no image means no upload and no path', async () => {
    await submitFeedback({ ...baseInput, accountId: null }, { online: true, currentAccountId: null });
    expect(mockServer.uploads).toEqual([]);
    expect([...mockServer.reports.values()][0]).toMatchObject({ p_screenshot_path: null });
  });

  it('uploads a chosen image to the private bucket under the report id', async () => {
    await submitFeedback({ ...baseInput, screenshotUri: 'file:///tmp/capture.jpg', accountId: null }, { online: true, currentAccountId: null });
    const [report] = [...mockServer.reports.values()];
    expect(mockServer.uploads).toEqual([`screenshots/${report.p_client_report_id as string}.jpg`]);
    expect(report.p_screenshot_path).toBe(`screenshots/${report.p_client_report_id as string}.jpg`);
  });

  it('capture is switched off on screens that can show private data', () => {
    for (const route of ['/sign-in', '/settings/account', '/settings/security', '/journal', '/journal/abc', '/admin/push', '/reset-password']) {
      expect(isSensitiveRoute(route)).toBe(true);
    }
    for (const route of ['/explore/map', '/culture', '/challenges/daily']) expect(isSensitiveRoute(route)).toBe(false);
    expect(isSensitiveRoute(null)).toBe(true);
  });
});

describe('sensitive metadata exclusion', () => {
  it('only allow-listed technical fields are attached', () => {
    const diagnostics = buildDiagnostics({ language: 'ky', ageMode: 'teen', online: false, route: '/daily' });
    for (const key of Object.keys(diagnostics)) expect(DIAGNOSTIC_KEYS).toContain(key);
    expect(diagnostics).not.toHaveProperty('contactEmail');
    expect(JSON.stringify(diagnostics)).not.toMatch(/token|password|deviceName/i);
  });

  it('includes an email only when the tester opted in', () => {
    expect(buildDiagnostics({ language: 'en', ageMode: null, online: true, contactEmail: null })).not.toHaveProperty('contactEmail');
    expect(buildDiagnostics({ language: 'en', ageMode: null, online: true, contactEmail: 'tester@example.com' }).contactEmail).toBe('tester@example.com');
  });

  it('strips anything else that sneaks into stored diagnostics', () => {
    const dirty = { platform: 'ios', accessToken: 'secret', email: 'a@b.c', deviceName: "Aibek's iPhone", location: { lat: 1 } };
    expect(Object.keys(sanitizeDiagnostics(dirty))).toEqual(['platform']);
  });

  it('crash fingerprints never contain the error message', () => {
    const fingerprint = errorFingerprint({ name: 'TypeError', message: 'Cannot read name of user aibek@example.com' });
    expect(fingerprint).toMatch(/^TypeError-[0-9a-f]{8}$/);
    expect(errorFingerprint({ name: 'TypeError', message: 'Cannot read name of user aibek@example.com' })).toBe(fingerprint);
  });

  it('the diagnostic trail keeps only safe technical tokens', () => {
    recordDiagnostic('route', '/journal/3f2b8c1e-1234-4abc-9def-0123456789ab?note=secret');
    recordDiagnostic('native_unavailable', 'speech');
    recordDiagnostic('native_unavailable', 'My private note text!');
    const trail = diagnosticTrail();
    expect(trail[0].detail).toBe('/journal/:id');
    expect(trail[1].detail).toBe('speech');
    expect(trail[2].detail).toBe('redacted');
    expect(sanitizeRoute('/culture/item/boz-uy-tunduk')).toBe('/culture/item/boz-uy-tunduk');
  });
});
