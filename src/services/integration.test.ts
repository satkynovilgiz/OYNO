/**
 * Post-feature integration checks: the seams BETWEEN recent features
 * (audio x auth, admin inbox x migrations, quests x routes, companion x
 * stored ids, translation x verification).
 */
import * as fs from 'fs';
import * as path from 'path';

import { DEFAULT_COMPANION, resolveCompanion } from '@/components/companion/companionModel';
import { feedbackInboxError } from '@/features/admin/adminModel';
import { GUIDED_QUESTS, questStepRoute } from '@/features/quests/questsData';
import { buildTranslationIndex, localizeCultureItem, localizeMaterial, type TranslationRow } from '@/services/content/localizedContent';
import type { CultureItemRow, CultureMaterialRow } from '@/services/content/types';
import { buildReportContent, legacyCategory, legacyMessage } from '@/services/feedback/reportContent';
import { useAuthStore } from '@/store/useAuthStore';

jest.mock('expo', () => ({ requireOptionalNativeModule: () => ({}) }));
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn(), getAvailableVoicesAsync: async () => [] }));
jest.mock('@/services/feedback/diagnosticTrail', () => ({ recordDiagnostic: jest.fn(), currentRoute: () => null, diagnosticTrail: () => [] }));
jest.mock('@/services/supabase/client', () => ({ supabase: { auth: { onAuthStateChange: jest.fn(), signOut: jest.fn(async () => ({ error: null })) }, rpc: jest.fn(), from: jest.fn() } }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useAudioGuideStore } = require('@/services/audioGuide/useAudioGuideStore') as typeof import('@/services/audioGuide/useAudioGuideStore');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { bindAudioToAccount } = require('@/services/audioGuide/accountBinding') as typeof import('@/services/audioGuide/accountBinding');

const ROOT = path.join(__dirname, '../..');
const ttsPlan = { kind: 'tts' as const, bcp47: 'ky-KG', voiceId: 'ky', chunks: ['Боз үй.'] };
const setUser = (id: string | null) => useAuthStore.setState({ user: id ? ({ id } as never) : null, status: id ? 'authenticated' : 'guest' } as never);

/** src/app file for a route, honouring [param] segments. */
function routeFile(route: string): string | null {
  const segments = route.replace(/^\//, '').split('/');
  let dir = path.join(ROOT, 'src/app');
  for (let index = 0; index < segments.length; index++) {
    const last = index === segments.length - 1;
    const segment = segments[index];
    if (last) {
      for (const candidate of [`${segment}.tsx`, path.join(segment, 'index.tsx')]) if (fs.existsSync(path.join(dir, candidate))) return path.join(dir, candidate);
      const dynamic = fs.readdirSync(dir).find((name) => /^\[[^\]]+\]\.tsx$/.test(name));
      return dynamic ? path.join(dir, dynamic) : null;
    }
    const next = fs.existsSync(path.join(dir, segment)) ? segment : fs.readdirSync(dir).find((name) => /^\[[^\]]+\]$/.test(name));
    if (!next) return null;
    dir = path.join(dir, next);
  }
  return null;
}

describe('audio x account', () => {
  afterEach(() => useAudioGuideStore.getState().stop());

  it('sign-out / switching account stops the previous narration (mini player has nothing left to show)', () => {
    setUser('account-a');
    const unbind = bindAudioToAccount();
    useAudioGuideStore.getState().start('culture_item:boz-uy:kg', ttsPlan, { title: 'Боз үй', route: '/culture/item/boz-uy' });
    expect(useAudioGuideStore.getState().meta?.title).toBe('Боз үй');
    setUser(null);
    expect(useAudioGuideStore.getState()).toMatchObject({ sessionKey: null, meta: null, status: 'idle' });

    useAudioGuideStore.getState().start('culture_item:boz-uy:kg', ttsPlan, { title: 'Боз үй', route: null });
    setUser('account-b');
    expect(useAudioGuideStore.getState().sessionKey).toBeNull();
    unbind();
  });

  it('a token refresh for the same account does not interrupt listening', () => {
    setUser('account-a');
    const unbind = bindAudioToAccount();
    useAudioGuideStore.getState().start('region:son-kol:kg', ttsPlan, { title: 'Соң-Көл', route: null });
    setUser('account-a');
    expect(useAudioGuideStore.getState().sessionKey).toBe('region:son-kol:kg');
    unbind();
  });

  it('host counting never leaks or goes negative (mini player cannot stay hidden forever)', () => {
    const store = useAudioGuideStore.getState();
    const first = store.registerHost('k');
    const second = store.registerHost('k');
    expect(useAudioGuideStore.getState().hosts.k).toBe(2);
    first();
    expect(useAudioGuideStore.getState().hosts.k).toBe(1);
    second();
    second();
    expect(useAudioGuideStore.getState().hosts.k).toBeUndefined();
  });
});

describe('feedback fallback + admin inbox', () => {
  it('the legacy path keeps every piece of reporter input', () => {
    const content = buildReportContent('culture_correction', { contentType: 'culture_item', contentId: 'clothing-shokulo' }, { language: 'ru', suggestedCorrection: 'Высота 25-30 см', sourceUrl: 'https://kg.wikipedia.org/wiki/x' });
    const message = legacyMessage('Бийиктиги туура эмес', content);
    for (const piece of ['Бийиктиги туура эмес', 'culture_item:clothing-shokulo', 'ru', 'Высота 25-30 см', 'https://kg.wikipedia.org/wiki/x']) expect(message).toContain(piece);
    expect(legacyCategory('culture_correction')).toBe('content');
  });

  it('inbox explains a missing migration clearly (admin-only screen), never dumps a stack', () => {
    expect(feedbackInboxError({ code: 'PGRST202', message: 'Could not find the function public.admin_get_beta_feedback without parameters' })).toMatch(/20260929000001_feedback_v2\.sql/);
    expect(feedbackInboxError({ message: 'NOT_AUTHORIZED' })).toMatch(/no feedback-reading role/);
    expect(feedbackInboxError({ message: 'boom\n    at fn (file.js:1:1)' })).toBe('boom');
    expect(feedbackInboxError(null)).toBeNull();
  });

  it('every admin route (feedback included) and unknown sections run behind AdminGate first', () => {
    for (const file of ['index.tsx', 'push.tsx', 'feedback.tsx', '[section].tsx']) expect(fs.readFileSync(path.join(ROOT, 'src/app/admin', file), 'utf8')).toMatch(/<AdminGate>/);
    const section = fs.readFileSync(path.join(ROOT, 'src/app/admin/[section].tsx'), 'utf8');
    expect(section.indexOf('<AdminGate>')).toBeLessThan(section.indexOf('Unknown admin section'));
  });
});

describe('quests x routes', () => {
  it('every seeded quest step opens a real screen file', () => {
    for (const quest of GUIDED_QUESTS) {
      for (const step of quest.steps) {
        const route = questStepRoute(step);
        expect(route).toBeTruthy();
        expect(routeFile(route!.split('?')[0])).toBeTruthy();
        if (step.type === 'complete_challenge') expect(route).toMatch(/^\/challenges\/(journey|collection-[a-z-]+)$/);
      }
    }
  });

  it('an unknown quest id or challenge id renders Not Found, not a crash', () => {
    expect(fs.readFileSync(path.join(ROOT, 'src/features/quests/QuestDetailScreen.tsx'), 'utf8')).toMatch(/if \(!quest \|\| !progress\) return <NotFoundState/);
    expect(fs.readFileSync(path.join(ROOT, 'src/app/challenges/[challengeId].tsx'), 'utf8')).toMatch(/if \(!isKnownChallenge\(challengeId\)\) return <NotFoundState/);
  });
});

describe('companion x stored ids', () => {
  it('a stale stored character (unreleased or unknown) falls back to the default guide', () => {
    for (const stale of ['boru', 'tulpar', 'elchi', 'bek-old', '']) expect(resolveCompanion(stale)).toBe(DEFAULT_COMPANION);
    for (const valid of ['bek', 'aidana', 'aiana']) expect(resolveCompanion(valid)).toBe(valid);
  });
});

describe('translation x verification', () => {
  const item = { id: 'boz-uy', title: 'Боз үй', history: 'Тарых', cultural_meaning: 'Маани', accuracy_level: 'unverified', sources: [] } as unknown as CultureItemRow;
  const row = (field: string, value: string): TranslationRow => ({ content_type: 'culture_item', content_id: 'boz-uy', language: 'ru', field, value }) as TranslationRow;

  it('missing RU body falls back to Kyrgyz and is labelled as such, never as Russian', () => {
    const partial = localizeCultureItem(item, 'ru', buildTranslationIndex([row('title', 'Юрта'), row('history', 'История')]));
    expect(partial.translation).toMatchObject({ language: 'ru', status: 'fallback_to_kg' });
    expect(partial.history).toBe('Тарых');
    const material = localizeMaterial({ id: 'm', title: 'Калпак', description: 'Сүрөттөмө', body: 'Текст' } as unknown as CultureMaterialRow, 'en', buildTranslationIndex([]));
    expect(material.translation?.status).toBe('fallback_to_kg');
    expect(material.body).toBe('Текст');
  });

  it('a fully translated item keeps its own verification level (translation is not verification)', () => {
    const full = localizeCultureItem(item, 'ru', buildTranslationIndex([row('title', 'Юрта'), row('history', 'История'), row('cultural_meaning', 'Значение')]));
    expect(full.translation?.status).toBe('available');
    expect(full.accuracy_level).toBe('unverified');
  });
});
