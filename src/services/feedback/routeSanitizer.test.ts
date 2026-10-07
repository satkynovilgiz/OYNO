/**
 * sanitizeRoute against the app's REAL route files (src/app) with
 * synthetic identifiers, plus idempotence over a generated corpus.
 */
import * as fs from 'fs';
import * as path from 'path';

import { CONTENT_LINK_TYPES } from '@/services/links/contentLinks';

import { KNOWN_TOP_LEVEL_ROUTES, ROUTE_PLACEHOLDER, sanitizeRoute } from './diagnosticTrail';
import { sanitizeDiagnostics } from './diagnostics';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const APP = path.join(__dirname, '../../app');

/** Every route file as a path pattern: "/journal/[entryId]". */
function routePatterns(dir = APP, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_') || entry.name.startsWith('+')) continue;
    const name = entry.name.replace(/\.tsx$/, '');
    if (entry.isDirectory()) out.push(...routePatterns(path.join(dir, entry.name), `${prefix}/${name}`));
    else if (entry.name.endsWith('.tsx')) out.push(name === 'index' ? prefix || '/' : `${prefix}/${name}`);
  }
  return out;
}

/** Route params that hold a PERSON's private record, by structure. */
const PRIVATE_PARAMS: Record<string, string> = {
  '/journal/[entryId]': 'entryId',
  '/profile/my-collections/[id]': 'id',
};

// Synthetic ids, deliberately SHORT and lowercase - they look like public slugs.
const SHORT_PRIVATE = ['e1', 'felt', 'trip-notes', 'abc'];

describe('the route table matches the repository', () => {
  it('every top-level route file is known (and nothing extra)', () => {
    const top = new Set(routePatterns().map((pattern) => pattern.split('/')[1]).filter((segment) => segment && !segment.startsWith('[')));
    expect([...top].sort()).toEqual([...KNOWN_TOP_LEVEL_ROUTES].sort());
  });

  it('every dynamic route is classified (public content or private record)', () => {
    const dynamic = routePatterns().filter((pattern) => pattern.includes('['));
    const known = new Set([
      ...Object.keys(PRIVATE_PARAMS),
      '/admin/[section]', '/admin/regions/[regionId]', '/appearance/wallpapers/[wallpaperId]', '/challenges/[challengeId]', '/collections/[collectionId]',
      '/culture/[categoryId]', '/culture/calendar/[id]', '/culture/compare/[id]', '/culture/connections/[id]', '/culture/glossary/[id]', '/culture/item/[itemId]',
      '/culture/material/[materialId]', '/explore/[id]', '/explore/region/[id]', '/games/stats/[gameId]', '/learn/[id]', '/open/[type]', '/open/[type]/[id]',
      '/quests/[questId]', '/trails/[trailId]',
    ]);
    const unclassified = dynamic.filter((pattern) => ![...known].some((entry) => pattern === entry || pattern.startsWith(`${entry}/`)));
    // A new dynamic route must be added here AND, if it holds a person's data, to the sanitizer.
    expect(unclassified).toEqual([]);
  });

  it('the deep-link types match contentLinks', () => {
    for (const type of CONTENT_LINK_TYPES) expect(sanitizeRoute(`/open/${type}/boz-uy`)).toBe(`/open/${type}/boz-uy`);
  });
});

describe('private values are redacted by structure, whatever their shape', () => {
  it.each(Object.entries(PRIVATE_PARAMS))('%s', (pattern, param) => {
    for (const value of [...SHORT_PRIVATE, '0b3f0c5e-1d8a-4f2e-9c1b-2a7d5e6f8a90', 'uc_lx9k2_3_a8f2']) {
      const route = pattern.replace(`[${param}]`, value);
      expect(sanitizeRoute(route)).toBe(pattern.replace(`[${param}]`, ROUTE_PLACEHOLDER));
    }
  });

  it('journal static screens stay readable', () => {
    for (const screen of ['book', 'calendar', 'collage', 'new']) expect(sanitizeRoute(`/journal/${screen}`)).toBe(`/journal/${screen}`);
    expect(sanitizeRoute('/journal')).toBe('/journal');
    expect(sanitizeRoute('/journal/book/extra-words')).toBe('/journal/book/:id');
  });

  it('deep links: unknown types and anything beyond the id are replaced', () => {
    expect(sanitizeRoute('/open/note/my-private-words')).toBe('/open/:id/:id');
    expect(sanitizeRoute('/open/game/kok-boru/extra')).toBe('/open/game/kok-boru/:id');
    expect(sanitizeRoute('oyno://open/game/kok-boru')).toBe('/open/game/kok-boru');
  });

  it('auth screens never keep extra segments; unknown top-level paths are replaced whole', () => {
    expect(sanitizeRoute('/reset-password/abc')).toBe('/reset-password/:id');
    expect(sanitizeRoute('/verify-email/token-like')).toBe('/verify-email/:id');
    expect(sanitizeRoute('/my-private-diary-words')).toBe('/:id');
    expect(sanitizeRoute('/my-private-diary-words/more')).toBe('/:id/:id');
  });
});

describe('public routes stay useful', () => {
  it.each([
    '/culture/item/boz-uy-tunduk', '/culture/material/komuz-discovery', '/culture/glossary/tunduk', '/explore/son-kol', '/explore/region/issyk-kul',
    '/games/stats/kok-boru', '/learn/boz-uy', '/trails/horse-culture', '/quests/horse-games', '/collections/felt-and-wool', '/admin/feedback',
    '/settings/data-privacy/import', '/profile/my-collections', '/profile/game-records', '/', '/home',
  ])('%s', (route) => {
    expect(sanitizeRoute(route)).toBe(route);
  });
});

describe('hostile and odd inputs', () => {
  it.each([
    ['absolute https URL with credentials', 'https://user:pw@oyno.app/culture/item/boz-uy?x=1#y', '/culture/item/boz-uy'],
    ['app scheme with credentials', 'oyno://user:pw@open/game/kok-boru', '/open/game/kok-boru'],
    ['encoded public slug', '/culture/item/boz%2Duy', '/culture/item/boz-uy'],
    ['encoded slash is not a separator', '/culture/item/a%2Fb', '/culture/item/:id'],
    ['malformed encoding', '/culture/item/a%E0%A4%A', '/culture/item/:id'],
    ['double-encoded value', '/culture/item/boz%252Duy', '/culture/item/:id'],
    ['query, fragment, semicolon params', '/explore/son-kol;jsessionid=1?token=x#access_token=y', '/explore/son-kol'],
    ['backslashes', '\\journal\\e1', '/journal/:id'],
    ['dot segments', '/./culture/../item', '/culture/:id/item'],
    ['empty and repeated slashes', '//culture///item//boz-uy', '/culture/item/boz-uy'],
    ['empty input', '', '/'],
    ['placeholders preserved', '/journal/:id', '/journal/:id'],
  ])('%s', (_label, input, expected) => {
    expect(sanitizeRoute(input)).toBe(expected);
  });

  it('is cut at whole segments, never mid-value', () => {
    const long = `/culture/item/${'abcdefgh-'.repeat(4)}x/${'qwertyui-'.repeat(4)}yz/aaaa`;
    const out = sanitizeRoute(long);
    expect(out.length).toBeLessThanOrEqual(80);
    expect(long.startsWith(out)).toBe(true);
    expect(out.split('/').every((segment) => long.split('/').includes(segment))).toBe(true);
  });
});

describe('idempotent across creation, enqueue, storage reads and submission', () => {
  /** A deterministic corpus of route-shaped strings. */
  function corpus(): string[] {
    const parts = ['culture', 'item', 'journal', 'e1', ':id', 'boz-uy', '..', '.', '', '%2D', '%E0', 'A', 'x'.repeat(30), 'open', 'game', 'note', 'profile', 'my-collections', 'uc_a1', '12345', ';a=1', '?q=1', '#f', '\\', 'oyno://', 'https://u:p@h'];
    let seed = 7;
    const next = () => (seed = (seed * 48271) % 2147483647);
    const out: string[] = [];
    for (let index = 0; index < 3000; index += 1) {
      const length = (next() % 9) + 1;
      out.push(Array.from({ length }, () => parts[next() % parts.length]).join(next() % 4 === 0 ? '' : '/'));
    }
    return out;
  }

  it('sanitizeRoute(sanitizeRoute(x)) === sanitizeRoute(x) for 3000 generated routes', () => {
    const unstable = corpus().filter((route) => sanitizeRoute(sanitizeRoute(route)) !== sanitizeRoute(route));
    expect(unstable).toEqual([]);
  });

  it('four passes (build, enqueue, read, submit) give the same diagnostics as one', () => {
    for (const route of corpus().slice(0, 500)) {
      const once = sanitizeDiagnostics({ platform: 'ios', route, trail: [{ at: '2026-10-06T08:00:00.000Z', type: 'route', detail: route }] });
      let value: unknown = once;
      for (let pass = 0; pass < 3; pass += 1) value = sanitizeDiagnostics(JSON.parse(JSON.stringify(value)));
      expect(value).toEqual(once);
    }
  });
});
