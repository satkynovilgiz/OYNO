/**
 * Feedback + Report Content 2.0: categories, content context, private
 * fields excluded, v2 submission with a safe fallback, duplicate / failed /
 * success states.
 */
import * as fs from 'fs';
import * as path from 'path';

import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { supabase } from '@/services/supabase/client';

import { buildDiagnostics, sanitizeDiagnostics } from './diagnostics';
import { FEEDBACK_CATEGORIES, isMissingFunction, readFeedbackQueue, sendFeedbackReport } from './feedbackQueue';
import { buildReportContent, isValidReportUrl, legacyCategory, legacyMessage, toServerContent } from './reportContent';

const mockCalls: { fn: string; args: Record<string, unknown> }[] = [];
let mockNext: ((fn: string) => { message: string; code?: string; status?: number } | null) | null = null;
jest.mock('@/services/supabase/client', () => ({
  supabase: {
    rpc: jest.fn(async (fn: string, args: Record<string, unknown>) => {
      mockCalls.push({ fn, args });
      const error = mockNext?.(fn) ?? null;
      return { data: error ? null : 'id', error };
    }),
    storage: { from: () => ({ upload: jest.fn(async () => ({ data: {}, error: null })) }) },
  },
}));

const ROOT = path.join(__dirname, '../../..');
const context = { contentType: 'culture_item' as const, contentId: 'clothing-shokulo' };
const diagnostics = buildDiagnostics({ language: 'ru', ageMode: 'adult', online: true, route: '/culture/item/clothing-shokulo' });
const lookup = (dict: unknown, key: string) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict);

beforeEach(async () => {
  await AsyncStorage.clear();
  mockCalls.length = 0;
  mockNext = null;
  (supabase.rpc as jest.Mock).mockClear();
});

describe('categories', () => {
  it('offers the six categories, each labelled with its own question in KG/RU/EN', () => {
    expect(FEEDBACK_CATEGORIES).toEqual(['bug', 'translation', 'culture_correction', 'image', 'suggestion', 'other']);
    for (const category of FEEDBACK_CATEGORIES) {
      for (const dict of [kg, ru, en]) {
        for (const key of [`feedback.categories.${category}`, `feedback.messageLabels.${category}`, `feedback.messagePlaceholders.${category}`]) expect(String(lookup(dict, key) ?? '').trim()).toBeTruthy();
      }
    }
  });

  it('the server accepts every category (and still the old ones already queued on phones)', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260929000001_feedback_v2.sql'), 'utf8');
    for (const category of [...FEEDBACK_CATEGORIES, 'ui', 'content', 'performance']) expect(sql).toMatch(new RegExp(`'${category}'`));
  });

  it('old servers get the nearest old category', () => {
    expect(legacyCategory('culture_correction')).toBe('content');
    expect(legacyCategory('image')).toBe('ui');
    expect(legacyCategory('suggestion')).toBe('other');
    expect(legacyCategory('bug')).toBe('bug');
  });
});

describe('content context', () => {
  it('a cultural correction carries the content id, language, correction and a valid source', () => {
    const content = buildReportContent('culture_correction', context, { language: 'ru', suggestedCorrection: '  Высота 25-30 см  ', sourceUrl: 'https://kg.wikipedia.org/wiki/Шөкүлө' });
    expect(content).toEqual({ contentType: 'culture_item', contentId: 'clothing-shokulo', language: 'ru', suggestedCorrection: 'Высота 25-30 см', sourceUrl: 'https://kg.wikipedia.org/wiki/Шөкүлө' });
  });

  it('translation / image reports keep only the content id and language', () => {
    expect(buildReportContent('translation', context, { language: 'en', suggestedCorrection: 'x', sourceUrl: 'https://a.org' })).toEqual({ contentType: 'culture_item', contentId: 'clothing-shokulo', language: 'en' });
  });

  it('no context for bugs/suggestions, for odd ids, or when opened outside content', () => {
    expect(buildReportContent('bug', context, { language: 'ru' })).toBeNull();
    expect(buildReportContent('suggestion', context, { language: 'ru' })).toBeNull();
    expect(buildReportContent('culture_correction', { ...context, contentId: '../admin' }, { language: 'ru' })).toBeNull();
    expect(buildReportContent('culture_correction', null, { language: 'ru' })).toBeNull();
  });

  it('source links: basic shape only, bad ones dropped (never opened or trusted)', () => {
    expect(isValidReportUrl('https://ich.unesco.org/en/RL/x')).toBe(true);
    for (const bad of ['javascript:alert(1)', 'unesco.org', 'ftp://a.org', 'https://no spaces.org', `https://a.org/${'x'.repeat(600)}`]) expect(isValidReportUrl(bad)).toBe(false);
    expect(buildReportContent('culture_correction', context, { language: 'kg', sourceUrl: 'not a link' })?.sourceUrl).toBeUndefined();
  });

  it('the server payload is allow-listed snake_case (no title, no extra fields)', () => {
    const content = { ...buildReportContent('culture_correction', context, { language: 'kg', suggestedCorrection: 'x' })!, title: 'Шөкүлө', email: 'a@b.c' } as never;
    expect(Object.keys(toServerContent(content)).sort()).toEqual(['content_id', 'content_type', 'language', 'suggested_correction']);
  });
});

describe('privacy', () => {
  it('private fields never reach the report, even if something injects them', () => {
    const polluted = { ...diagnostics, email: 'a@b.c', accessToken: 'secret', journalText: 'dear diary', searchQuery: 'my query', password: 'x', userId: 'u1', photoUri: 'file:///p.jpg' };
    const clean = sanitizeDiagnostics(polluted);
    for (const key of ['email', 'accessToken', 'journalText', 'searchQuery', 'password', 'userId', 'photoUri']) expect(clean).not.toHaveProperty(key);
    expect(clean).toMatchObject({ platform: expect.any(String), language: 'ru', route: '/culture/item/clothing-shokulo' });
  });

  it('the admin inbox never returns account identifiers', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260929000001_feedback_v2.sql'), 'utf8');
    const inbox = sql.slice(sql.indexOf('create function public.admin_get_beta_feedback'));
    expect(inbox).not.toMatch(/user_id/);
    expect(inbox).toMatch(/diagnostics - 'contactEmail'/);
    expect(inbox).toMatch(/require_admin_role/);
  });
});

describe('submission states', () => {
  const content = buildReportContent('culture_correction', context, { language: 'ru', suggestedCorrection: 'Оңдоо' });
  const input = { category: 'culture_correction' as const, message: 'Бийиктиги туура эмес', diagnostics, content, screenshotUri: null, accountId: null };

  it('success: sent through v2 with the content context, no XP or reward involved', async () => {
    const outcome = await sendFeedbackReport(input, { online: true, currentAccountId: null });
    expect(outcome.result).toBe('sent');
    expect(mockCalls).toHaveLength(1);
    expect(mockCalls[0]).toMatchObject({ fn: 'submit_beta_feedback_v2', args: { p_category: 'culture_correction', p_content: { content_type: 'culture_item', content_id: 'clothing-shokulo', language: 'ru', suggested_correction: 'Оңдоо' } } });
    const source = fs.readFileSync(path.join(__dirname, 'feedbackQueue.ts'), 'utf8');
    expect(source).not.toMatch(/apply_reward|addXp|useProgressStore/);
  });

  it('server without v2 yet: falls back to the original function without losing the context', async () => {
    mockNext = (fn) => (fn === 'submit_beta_feedback_v2' ? { message: 'Could not find the function public.submit_beta_feedback_v2', code: 'PGRST202' } : null);
    const outcome = await sendFeedbackReport(input, { online: true, currentAccountId: null });
    expect(outcome.result).toBe('sent');
    const legacy = mockCalls.find((call) => call.fn === 'submit_beta_feedback')!;
    expect(legacy.args.p_category).toBe('content');
    expect(String(legacy.args.p_message)).toContain('[culture_item:clothing-shokulo · ru]');
    expect(legacy.args).not.toHaveProperty('p_content');
    expect(isMissingFunction({ code: 'PGRST202' })).toBe(true);
  });

  it('failed: a refused report is "failed" (never "sent") and stays for Retry', async () => {
    mockNext = () => ({ message: 'INVALID_SOURCE_URL', code: 'P0001', status: 400 });
    const outcome = await sendFeedbackReport(input, { online: true, currentAccountId: null });
    expect(outcome.result).toBe('failed');
    expect((await readFeedbackQueue())[0]).toMatchObject({ status: 'failed', content: { contentId: 'clothing-shokulo' } });
  });

  it('offline: saved, not claimed as sent', async () => {
    const outcome = await sendFeedbackReport(input, { online: false, currentAccountId: null });
    expect(outcome.result).toBe('queued');
    expect(mockCalls).toHaveLength(0);
  });

  it('duplicate protection: the sheet ignores a second tap while sending; the server stores a report id once', () => {
    const sheet = fs.readFileSync(path.join(ROOT, 'src/features/feedback/FeedbackSheet.tsx'), 'utf8');
    expect(sheet).toMatch(/if \(!message\.trim\(\) \|\| sending\) return;/);
    const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260929000001_feedback_v2.sql'), 'utf8');
    expect(sql).toMatch(/A retry of a report the server already has/);
    expect(legacyMessage('m', null)).toBe('m');
  });
});
