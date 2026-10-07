/**
 * Adversarial diagnostics: injected fields, wrong types, private text in
 * nested events and routes, oversized payloads, and malformed reports
 * restored from local storage. Every secret here is SYNTHETIC.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { __clearDiagnosticTrail, diagnosticTrail, recordDiagnostic, sanitizeDiagnosticEvent, sanitizeRoute } from './diagnosticTrail';
import { buildDiagnostics, errorFingerprint, isSensitiveRoute, MAX_DIAGNOSTICS_CHARS, sanitizeDiagnostics } from './diagnostics';
import { FEEDBACK_QUEUE_KEY, flushFeedbackQueue, isFeedbackImageUri, parseQueuedReport, readFeedbackQueue, sendFeedbackReport } from './feedbackQueue';

const mockSent: Record<string, unknown>[] = [];
const mockUploads: string[] = [];
jest.mock('@/services/supabase/client', () => ({
  supabase: {
    rpc: jest.fn(async (_fn: string, args: Record<string, unknown>) => {
      mockSent.push(args);
      return { data: 'ok', error: null };
    }),
    storage: { from: () => ({ upload: jest.fn(async (path: string) => (mockUploads.push(path), { data: { path }, error: null })) }) },
  },
}));

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.SYNTHETICtokenPAYLOAD.sig';
const PASSWORD = 'hunter2-synthetic-pw';
const JOURNAL_TEXT = 'Synthetic private journal line about grandmother 6t2w';
const EMAIL = 'tester.synthetic@example.org';
const SECRETS = [TOKEN, PASSWORD, JOURNAL_TEXT, 'SYNTHETICtoken', 'grandmother', 'access_token', 'refresh'];
const expectNoSecrets = (value: unknown) => {
  const text = JSON.stringify(value);
  for (const secret of SECRETS) expect(text).not.toContain(secret);
};

const ID = '6f1c2a4e-8b3d-4c5e-9f70-1a2b3c4d5e6f';
const AT = '2026-10-06T08:00:00.000Z';
const validStored = (overrides: Record<string, unknown> = {}) => ({
  clientReportId: ID,
  createdAt: AT,
  category: 'bug',
  message: 'Map froze',
  diagnostics: buildDiagnostics({ language: 'en', ageMode: 'adult', online: true, route: '/explore/map', errorFingerprint: 'TypeError-0a1b2c3d' }),
  content: null,
  screenshotUri: null,
  screenshotPath: null,
  accountId: null,
  attempts: 0,
  ...overrides,
});

beforeEach(async () => {
  await AsyncStorage.clear();
  mockSent.length = 0;
  mockUploads.length = 0;
  __clearDiagnosticTrail();
  (globalThis as { fetch?: unknown }).fetch = jest.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) }));
});

describe('routes keep their shape, never private values', () => {
  it.each([
    ['query string', `/culture/item/boz-uy?token=${TOKEN}`, '/culture/item/boz-uy'],
    ['fragment', `/auth-callback#access_token=${TOKEN}&refresh_token=x`, '/auth-callback'],
    ['credentials and host', `https://user:${PASSWORD}@oyno.app/settings/account`, '/settings/account'],
    ['journal entry id', `/journal/${ID}`, '/journal/:id'],
    ['email in a segment', `/profile/${EMAIL}`, '/profile/:id'],
    ['encoded email', `/profile/${encodeURIComponent(EMAIL)}`, '/profile/:id'],
    ['token-like segment', `/open/${TOKEN}`, '/open/:id'],
    ['my collection id', '/profile/my-collections/uc_lx9k2_3_a8f2', '/profile/my-collections/:id'],
    ['long number', '/admin/996555123456', '/admin/:id'],
    ['random-looking id', '/reports/a8f3k2j9x7q1w4e5r6', '/reports/:id'],
    ['mixed-case private text', '/search/MySecretQuery', '/search/:id'],
    ['path traversal / matrix params (everything after ; is dropped)', '/culture/..;jsessionid=abc/item', '/culture/:id'],
  ])('%s', (_label, input, expected) => {
    expect(sanitizeRoute(input)).toBe(expected);
  });

  it('public content routes are kept for debugging', () => {
    for (const route of ['/culture/item/boz-uy-tunduk', '/explore/son-kol', '/games/kok-boru', '/profile/game-records', '/learn/boz-uy']) expect(sanitizeRoute(route)).toBe(route);
  });
});

describe('nested trail events are validated one by one', () => {
  it('drops malformed events and unknown nested fields', () => {
    const trail = [
      { at: AT, type: 'route', detail: '/explore/son-kol', secret: PASSWORD, nested: { note: JOURNAL_TEXT } },
      { at: AT, type: 'keystroke', detail: 'h' }, // unknown type
      { at: 'yesterday', type: 'offline' }, // bad time
      { type: 'online' }, // no time
      null,
      42,
      'route',
      [AT, 'route'],
      { at: AT, type: 'native_unavailable', detail: `TypeError: cannot read ${JOURNAL_TEXT}` }, // raw error text
      { at: AT, type: 'screen_error', detail: 'TypeError-0a1b2c3d' },
      { at: AT, type: 'online', detail: TOKEN }, // online carries nothing
      { at: AT, type: 'route', detail: { toString: () => TOKEN } },
    ];
    const clean = sanitizeDiagnostics({ trail }).trail;
    expect(clean).toEqual([
      { at: AT, type: 'route', detail: '/explore/son-kol' },
      { at: AT, type: 'native_unavailable', detail: 'redacted' },
      { at: AT, type: 'screen_error', detail: 'TypeError-0a1b2c3d' },
      { at: AT, type: 'online' },
      { at: AT, type: 'route', detail: 'redacted' },
    ]);
    expectNoSecrets(clean);
  });

  it('recorded events follow the same per-type rules', () => {
    recordDiagnostic('route', `/journal/${ID}?note=${encodeURIComponent(JOURNAL_TEXT)}`);
    recordDiagnostic('sync_failed', `reading ${PASSWORD}`);
    recordDiagnostic('playback_error', 'speech');
    recordDiagnostic('online', TOKEN);
    expect(diagnosticTrail().map(({ type, detail }) => ({ type, detail }))).toEqual([
      { type: 'route', detail: '/journal/:id' },
      { type: 'sync_failed', detail: 'redacted' },
      { type: 'playback_error', detail: 'speech' },
      { type: 'online', detail: undefined },
    ]);
    expect(sanitizeDiagnosticEvent({ at: AT, type: '__proto__' })).toBeNull();
  });

  it('bounds the number of events and the whole payload', () => {
    const many = Array.from({ length: 500 }, (_, index) => ({ at: AT, type: 'route', detail: `/culture/item/item-${index % 50}-${'x'.repeat(40)}` }));
    const clean = sanitizeDiagnostics({ trail: many, osVersion: 'x'.repeat(10_000), appVersion: '1'.repeat(10_000) });
    expect(clean.trail.length).toBeLessThanOrEqual(20);
    expect(JSON.stringify(clean).length).toBeLessThanOrEqual(MAX_DIAGNOSTICS_CHARS);
    expect(clean.osVersion).toBe('');
    expect(clean.appVersion).toBeNull();
  });
});

describe('types and allowed values, not just key names', () => {
  it('unknown and injected fields cannot survive', () => {
    const polluted = JSON.parse(
      JSON.stringify({ platform: 'ios', accessToken: TOKEN, password: PASSWORD, session: { refresh_token: TOKEN }, journal: JOURNAL_TEXT, deviceName: "Synthetic's iPhone" }).replace('{', '{"__proto__":{"polluted":true},'),
    );
    const clean = sanitizeDiagnostics(polluted) as unknown as Record<string, unknown>;
    expect(clean.polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    for (const key of ['accessToken', 'password', 'session', 'journal', 'deviceName']) expect(clean).not.toHaveProperty(key);
    expectNoSecrets(clean);
  });

  it('wrong types / values are replaced, never passed through', () => {
    const clean = sanitizeDiagnostics({
      platform: 'ios; DROP TABLE',
      online: 'yes',
      embeddedBuild: 1,
      language: { en: true },
      ageMode: 'superuser',
      deviceClass: JOURNAL_TEXT,
      deviceModel: `<script>${TOKEN}</script>`,
      channel: ['production'],
      updateId: 'not-a-uuid',
      errorFingerprint: `TypeError: ${JOURNAL_TEXT}`,
      route: 12,
      trail: 'route',
    });
    expect(clean).toMatchObject({ platform: 'unknown', online: null, embeddedBuild: null, language: 'unknown', ageMode: null, deviceClass: null, deviceModel: null, channel: null, updateId: null, route: null, trail: [] });
    expect(clean).not.toHaveProperty('errorFingerprint');
    expectNoSecrets(clean);
  });

  it('not an object at all -> safe defaults, no crash', () => {
    for (const value of [null, undefined, 'x', 7, [], [1, 2], true]) expect(sanitizeDiagnostics(value)).toMatchObject({ platform: 'unknown', trail: [] });
  });

  it('contactEmail only with explicit consent, and only a real address', () => {
    expect(sanitizeDiagnostics({ contactEmail: EMAIL })).not.toHaveProperty('contactEmail');
    expect(sanitizeDiagnostics({ contactEmail: EMAIL }, { allowContactEmail: true }).contactEmail).toBe(EMAIL);
    for (const bad of [`${EMAIL}\nBcc: x@y.z`, 'not an email', `<${EMAIL}>`, 42, `${'a'.repeat(300)}@x.org`]) expect(sanitizeDiagnostics({ contactEmail: bad }, { allowContactEmail: true })).not.toHaveProperty('contactEmail');
    expect(buildDiagnostics({ language: 'en', ageMode: null, online: true })).not.toHaveProperty('contactEmail');
  });

  it('a valid report keeps every supported debugging field (and crash grouping)', () => {
    const fingerprint = errorFingerprint({ name: 'TypeError', message: `x of ${JOURNAL_TEXT}` });
    recordDiagnostic('route', '/explore/son-kol');
    recordDiagnostic('offline');
    const built = buildDiagnostics({ language: 'kg', ageMode: 'teen', online: false, route: '/culture/item/boz-uy-tunduk', errorFingerprint: fingerprint });
    const again = sanitizeDiagnostics(JSON.parse(JSON.stringify(built)));
    expect(again).toEqual(built);
    expect(again).toMatchObject({ language: 'kg', ageMode: 'teen', online: false, route: '/culture/item/boz-uy-tunduk', errorFingerprint: fingerprint });
    expect(again.trail.map((event) => event.type)).toEqual(['route', 'offline']);
    expect(errorFingerprint({ name: 'TypeError', message: `x of ${JOURNAL_TEXT}` })).toBe(fingerprint); // same crash, same group
    expectNoSecrets(again);
  });
});

describe('reports restored from local storage', () => {
  it('malformed stored queues never crash and keep only real reports', async () => {
    const second = '7a2b3c4d-1e2f-4a5b-8c9d-0e1f2a3b4c5d';
    await AsyncStorage.setItem(
      FEEDBACK_QUEUE_KEY,
      JSON.stringify([
        null,
        7,
        'report',
        [],
        { clientReportId: 'not-a-uuid', category: 'bug', message: 'x' },
        { clientReportId: second, category: 'hack', message: 'x' },
        { clientReportId: second, category: 'bug', message: '   ' },
        validStored({ diagnostics: 'corrupted', extraField: TOKEN }),
        validStored(), // duplicate id
        validStored({ clientReportId: second, diagnostics: [1, 2, 3], attempts: -4, status: 'sent', failureCode: `${TOKEN} x` }),
      ]),
    );
    const queue = await readFeedbackQueue();
    expect(queue.map((report) => report.clientReportId)).toEqual([ID, second]);
    expect(queue[0]).not.toHaveProperty('extraField');
    expect(queue[0].diagnostics).toMatchObject({ platform: 'unknown', trail: [] });
    expect(queue[1]).toMatchObject({ attempts: 0 });
    expect(queue[1]).not.toHaveProperty('status');
    expect(queue[1]).not.toHaveProperty('failureCode');
    expectNoSecrets(queue);

    await expect(flushFeedbackQueue(null)).resolves.toBe(2);
    expect(mockSent).toHaveLength(2);
    expectNoSecrets(mockSent);
  });

  it('not JSON / not an array -> empty queue, no crash', async () => {
    for (const raw of ['{oops', '{"a":1}', '"x"', 'null']) {
      await AsyncStorage.setItem(FEEDBACK_QUEUE_KEY, raw);
      await expect(readFeedbackQueue()).resolves.toEqual([]);
      await expect(flushFeedbackQueue(null)).resolves.toBe(0);
    }
  });

  it('old stored diagnostics are revalidated at the final submission boundary', async () => {
    await AsyncStorage.setItem(
      FEEDBACK_QUEUE_KEY,
      JSON.stringify([
        validStored({
          diagnostics: {
            platform: 'android',
            route: `/journal/${ID}?q=${encodeURIComponent(JOURNAL_TEXT)}`,
            authToken: TOKEN,
            trail: [{ at: AT, type: 'route', detail: `/reset-password#token=${TOKEN}`, password: PASSWORD }],
          },
        }),
      ]),
    );
    await flushFeedbackQueue(null);
    const diagnostics = mockSent[0].p_diagnostics as Record<string, unknown>;
    expect(diagnostics).toMatchObject({ platform: 'android', route: '/journal/:id', trail: [{ at: AT, type: 'route', detail: '/reset-password' }] });
    expect(diagnostics).not.toHaveProperty('authToken');
    expectNoSecrets(mockSent);
  });

  it('email consent travels with the report', async () => {
    const withEmail = buildDiagnostics({ language: 'en', ageMode: null, online: true, contactEmail: EMAIL });
    // Opted in -> sent.
    await sendFeedbackReport({ category: 'bug', message: 'a', diagnostics: withEmail, screenshotUri: null, accountId: null, contactConsent: true }, { online: true, currentAccountId: null });
    expect((mockSent[0].p_diagnostics as Record<string, unknown>).contactEmail).toBe(EMAIL);
    // Not opted in -> never stored, never sent, even if diagnostics carry it.
    await sendFeedbackReport({ category: 'bug', message: 'b', diagnostics: withEmail, screenshotUri: null, accountId: null }, { online: true, currentAccountId: null });
    expect(mockSent[1].p_diagnostics).not.toHaveProperty('contactEmail');
    expect(await AsyncStorage.getItem(FEEDBACK_QUEUE_KEY)).not.toContain(EMAIL);
    // Stored with consent=false (tampered email added later) -> dropped.
    await AsyncStorage.setItem(FEEDBACK_QUEUE_KEY, JSON.stringify([validStored({ contactConsent: false, diagnostics: { ...withEmail } })]));
    await flushFeedbackQueue(null);
    expect(mockSent[2].p_diagnostics).not.toHaveProperty('contactEmail');
    // Queued by an older version (no consent field): an email there was only ever stored after the opt-in.
    await AsyncStorage.setItem(FEEDBACK_QUEUE_KEY, JSON.stringify([validStored({ diagnostics: { ...withEmail } })]));
    await flushFeedbackQueue(null);
    expect((mockSent[3].p_diagnostics as Record<string, unknown>).contactEmail).toBe(EMAIL);
  });
});

describe('screenshot restrictions stay effective', () => {
  it('a stored report can only upload an image OYNO made for feedback', async () => {
    const journalPhoto = 'file:///var/mobile/Containers/Data/Documents/journal/user-a/entry-v1.jpg';
    expect(isFeedbackImageUri(journalPhoto)).toBe(false);
    expect(isFeedbackImageUri('https://evil.example/x.jpg')).toBe(false);
    expect(isFeedbackImageUri('file:///Documents/feedback/../journal/x.jpg')).toBe(false);
    expect(isFeedbackImageUri(`file:///Documents/feedback/${ID}.jpg`)).toBe(true);
    expect(isFeedbackImageUri('file:///Library/Caches/ImageManipulator/capture.jpg')).toBe(true);

    await AsyncStorage.setItem(FEEDBACK_QUEUE_KEY, JSON.stringify([validStored({ screenshotUri: journalPhoto, screenshotPath: 'screenshots/someone-else.jpg' })]));
    const [report] = await readFeedbackQueue();
    expect(report).toMatchObject({ screenshotUri: null, screenshotPath: null });
    await flushFeedbackQueue(null);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(mockUploads).toEqual([]);
    expect(mockSent[0].p_screenshot_path).toBeNull();
  });

  it('screen capture stays off on private screens', () => {
    for (const route of ['/journal', `/journal/${ID}`, '/sign-in', '/settings/account', '/admin/feedback', null]) expect(isSensitiveRoute(route)).toBe(true);
    expect(isSensitiveRoute('/culture/item/boz-uy-tunduk')).toBe(false);
  });

  it('parseQueuedReport is total: any JSON value in, a report or null out', () => {
    for (const value of [null, 1, 'x', [], {}, { clientReportId: ID }, validStored({ message: 5 }), validStored({ category: null })]) expect(parseQueuedReport(value)).toBeNull();
    expect(parseQueuedReport(validStored())).not.toBeNull();
  });
});
