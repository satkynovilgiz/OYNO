import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { challengePath, parseChallenge } from '@/features/games/friendChallenge/friendChallenge';

import { buildOYNODeepLink, CONTENT_LINK_TYPES, contentRoute, LINKABLE_GAMES, linkShareText, OYNO_SCHEME, parseContentLink, parseOYNODeepLink, PRIVATE_TYPES, widgetSurface } from './contentLinks';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));
jest.mock('@/services/analytics/analytics', () => ({ track: jest.fn() }));

const root = path.join(__dirname, '../../..');
const SAMPLES = { culture_item: 'boz-uy-overview', culture_material: 'boz-uy-history', glossary: 'tunduk', game: 'kok-boru', learning_path: 'boz-uy', komuz_track: 'ak-maral-min', calendar_event: 'world-kalpak-day' } as const;

describe('Shareable Content Links', () => {
  it('uses the real app.json scheme', () => {
    const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')) as { expo: { scheme: string } };
    expect(app.expo.scheme).toBe(OYNO_SCHEME);
  });

  it('every supported type builds a link that parses back to itself', () => {
    for (const type of CONTENT_LINK_TYPES) {
      const url = buildOYNODeepLink({ type, id: SAMPLES[type] });
      expect(url).toBe(`oyno://open/${type}/${SAMPLES[type]}`);
      expect(parseOYNODeepLink(url!)).toEqual({ type, id: SAMPLES[type] });
    }
  });

  it('every link opens an existing route file (and the /open entry exists)', () => {
    expect(fs.existsSync(path.join(root, 'src/app/open/[type]/[id].tsx'))).toBe(true);
    const fileFor: Record<string, string> = {
      culture_item: 'src/app/culture/item/[itemId]/index.tsx',
      culture_material: 'src/app/culture/material/[materialId]/index.tsx',
      glossary: 'src/app/culture/glossary/[id]/index.tsx',
      learning_path: 'src/app/learn/[id].tsx',
      komuz_track: 'src/app/culture/komuz/listen.tsx',
      calendar_event: 'src/app/culture/calendar/[id].tsx',
    };
    for (const type of CONTENT_LINK_TYPES) {
      const route = contentRoute({ type, id: SAMPLES[type] });
      if (type === 'game') for (const slug of LINKABLE_GAMES) expect(fs.existsSync(path.join(root, `src/app/games/${slug}.tsx`))).toBe(true);
      else expect(fs.existsSync(path.join(root, fileFor[type]))).toBe(true);
      expect(route.startsWith('/')).toBe(true);
    }
  });

  it('invalid type, missing id and malformed ids are rejected (never throws)', () => {
    expect(parseContentLink('journal', 'x')).toBeNull();
    expect(parseContentLink('culture_item', '')).toBeNull();
    expect(parseContentLink('culture_item', undefined)).toBeNull();
    expect(parseContentLink(undefined, 'boz-uy')).toBeNull();
    expect(parseContentLink('culture_item', '../../admin')).toBeNull();
    expect(parseContentLink('culture_item', 'BOZ UY')).toBeNull();
    expect(parseContentLink('culture_item', 'a'.repeat(200))).toBeNull();
    expect(parseContentLink('game', '3d-lab')).toBeNull();
    expect(parseOYNODeepLink('https://evil.example/open/culture_item/x')).toBeNull();
    expect(parseOYNODeepLink('oyno://open/culture_item')).toBeNull();
    expect(buildOYNODeepLink({ type: 'nope', id: 'x' })).toBeNull();
  });

  it('unknown / malicious query params are ignored; the route is built, never taken from the link', () => {
    expect(parseOYNODeepLink('oyno://open/learning_path/boz-uy?redirect=https://evil.example&userId=123&autoplay=1')).toEqual({ type: 'learning_path', id: 'boz-uy' });
    expect(contentRoute({ type: 'learning_path', id: 'boz-uy' })).toBe('/learn/boz-uy');
    const screen = fs.readFileSync(path.join(__dirname, 'ContentLinkScreen.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    expect(screen).toMatch(/router\.replace\(contentRoute\(link\)/);
    expect(screen).not.toMatch(/useGlobalSearchParams|redirect/);
  });

  it('deleted content opens the safe fallback', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveLink } = require('./resolveLink') as typeof import('./resolveLink');
    const data = { items: [{ id: 'boz-uy-overview' }], materials: [], itemsSettled: true, materialsSettled: true };
    expect(resolveLink({ type: 'culture_item', id: 'deleted-item' }, data)).toBe('invalid');
    expect(resolveLink({ type: 'culture_item', id: 'boz-uy-overview' }, data)).toBe('open');
    expect(resolveLink({ type: 'glossary', id: 'not-a-term' }, data)).toBe('invalid');
    expect(resolveLink({ type: 'learning_path', id: 'no-path' }, data)).toBe('invalid');
    expect(resolveLink({ type: 'komuz_track', id: 'no-track' }, data)).toBe('invalid');
    expect(resolveLink(null, data)).toBe('invalid');
    expect(resolveLink({ type: 'culture_item', id: 'x' }, { ...data, items: undefined, itemsSettled: false })).toBe('checking');
  });

  it('no private content can be linked', () => {
    for (const type of PRIVATE_TYPES) {
      expect(parseContentLink(type, 'x')).toBeNull();
      expect(buildOYNODeepLink({ type, id: 'x' })).toBeNull();
    }
  });

  it('links carry no account id, progress or tracking identifiers', () => {
    const url = buildOYNODeepLink({ type: 'learning_path', id: 'boz-uy' })!;
    expect(url).not.toMatch(/[?&]/);
    expect(linkShareText('Боз үй', url)).toBe('Боз үй - OYNO\noyno://open/learning_path/boz-uy');
    const source = ['contentLinks.ts', 'shareContentLink.ts'].map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')).join('\n');
    expect(source).not.toMatch(/useAuthStore|user\.id|userId|owner|utm_/);
  });

  it('Friend Challenge links keep their own format and parameters', () => {
    const challenge = challengePath({ gameId: 'jaa_atuu', metric: 'score', target: 24 });
    if (challenge) {
      expect(challenge.path.startsWith('games/')).toBe(true);
      expect(challenge.query).toEqual({ challengeMetric: 'score', target: '24' });
      expect(parseChallenge('jaa_atuu', { challengeMetric: 'score', target: '24' })).toEqual({ gameId: 'jaa_atuu', metric: 'score', target: 24 });
    }
    expect(parseOYNODeepLink(`oyno://${challenge?.path ?? 'games/jaa-atuu'}?challengeMetric=score&target=24`)).toBeNull();
  });

  it('Komuz track link selects the track and never autoplays', () => {
    expect(contentRoute({ type: 'komuz_track', id: 'ak-maral-min' })).toBe('/culture/komuz/listen?track=ak-maral-min');
    const room = fs.readFileSync(path.join(root, 'src/features/culture/komuz/listening/KomuzListeningRoomScreen.tsx'), 'utf8');
    const effects = room.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/g) ?? [];
    for (const effect of effects) expect(effect).not.toMatch(/params\.track|sharedTrack/);
    expect(room).toMatch(/sharedTrack/);
  });

  it('KG / RU / EN share copy', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { contentLinks: Record<string, string> }).contentLinks;
      for (const key of ['shareLink', 'sharePath', 'shareGame', 'shareTerm', 'shareTrackShort', 'invalidTitle', 'goHome']) expect(block[key]).toBeTruthy();
    }
  });
});

describe('widget surface param', () => {
  it('only the two widget sizes are recognised', () => {
    expect(widgetSurface('widget_small')).toBe('small');
    expect(widgetSurface('widget_medium')).toBe('medium');
    for (const value of [undefined, '', 'widget_large', 'https://x', ['widget_small']]) expect(widgetSurface(value)).toBeNull();
  });
});
