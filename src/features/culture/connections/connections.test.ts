import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { seededCultureItems } from '../glossary/seededCultureItems';
import { connectionRoute, contentRoute, CULTURE_CONNECTIONS, MAX_CONNECTIONS_SHOWN, RELATION_KEYS, REVERSE_LABEL, type CultureConnection } from './connectionsData';
import { connectionById, connectionsFor, validateConnections, type ConnectionCatalog } from './connectionsModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const ROOT = path.join(__dirname, '../../../..');
const SEEDED = seededCultureItems(ROOT);
const CATALOG: ConnectionCatalog = {
  content: new Map([...SEEDED.entries()].map(([id, row]) => [`culture_item:${id}`, row])),
  locales: [kg, ru, en] as unknown as Record<string, unknown>[],
};
const exists = (type: string, id: string) => CATALOG.content.has(`${type}:${id}`);
const base = CULTURE_CONNECTIONS[0];
const withOne = (patch: Partial<CultureConnection>) => validateConnections([{ ...base, ...patch }], CATALOG);
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Culture Connections - data integrity', () => {
  it('the curated set passes the validator against the seeded content (exists, no self-link, known relation, no duplicate, sourced, localized)', () => {
    expect(validateConnections(CULTURE_CONNECTIONS, CATALOG)).toEqual([]);
    expect(CULTURE_CONNECTIONS.length).toBeGreaterThanOrEqual(10);
  });

  it('valid relation: only the small reviewed set', () => {
    expect(RELATION_KEYS).toEqual(['part_of', 'related_tradition', 'uses', 'made_with', 'symbolic_connection', 'learn_next']);
    expect(withOne({ relationKey: 'similar_to' as never })).toEqual(expect.arrayContaining([expect.stringMatching(/unknown relation/)]));
  });

  it('missing content', () => {
    expect(withOne({ toId: 'does-not-exist' })).toEqual(expect.arrayContaining([expect.stringMatching(/to does-not-exist missing/)]));
    expect(withOne({ fromId: 'nope' })).toEqual(expect.arrayContaining([expect.stringMatching(/from nope missing/)]));
  });

  it('duplicate (same pair either direction, or same id)', () => {
    const reversed = { ...base, id: 'other', fromId: base.toId, toId: base.fromId };
    expect(validateConnections([base, reversed], CATALOG)).toEqual(expect.arrayContaining([expect.stringMatching(/duplicate connection/)]));
    expect(validateConnections([base, { ...CULTURE_CONNECTIONS[1], id: base.id }], CATALOG)).toEqual(expect.arrayContaining([expect.stringMatching(/duplicate id/)]));
  });

  it('self-link', () => {
    expect(withOne({ toId: base.fromId })).toEqual(expect.arrayContaining([expect.stringMatching(/self-link/)]));
  });

  it('source mapping: the evidence is an exact excerpt of the cited authored field', () => {
    for (const connection of CULTURE_CONNECTIONS) {
      const text = String(SEEDED.get(connection.source.contentId)?.[connection.source.field] ?? '');
      expect(text).toContain(connection.evidence);
    }
    expect(withOne({ evidence: 'Генерацияланган түшүндүрмө, булакта жок.' })).toEqual(expect.arrayContaining([expect.stringMatching(/evidence not found/)]));
    expect(withOne({ source: { ...base.source, field: 'history' } })).toEqual(expect.arrayContaining([expect.stringMatching(/evidence not found/)]));
  });

  it('localization: every relation label (and reverse reading) in KG/RU/EN', () => {
    for (const locale of [kg, ru, en]) {
      const relation = (locale.culture as unknown as { connections: { relation: Record<string, string> } }).connections.relation;
      for (const key of [...RELATION_KEYS, ...Object.values(REVERSE_LABEL).filter(Boolean)] as string[]) expect(relation[key]?.trim()).toBeTruthy();
    }
    const stripped = JSON.parse(JSON.stringify(en)) as { culture: { connections: { relation: Record<string, string> } } };
    delete stripped.culture.connections.relation.part_of;
    expect(validateConnections([base], { ...CATALOG, locales: [stripped as unknown as Record<string, unknown>] })).toEqual(expect.arrayContaining([expect.stringMatching(/label part_of missing/)]));
  });

  it('no auto-inference: no connection exists merely because two items share a category', () => {
    // Every connection carries its own authored evidence (checked above); and
    // there is no code path building connections from categories/titles.
    const model = read('src/features/culture/connections/connectionsModel.ts');
    expect(model).not.toMatch(/category_id|title\.includes|keyword/);
  });
});

describe('Culture Connections - per article', () => {
  it('forward connections in curated order, then explicitly reversible incoming ones with the REVERSE label', () => {
    const entries = connectionsFor('culture_item', 'boz-uy-karkas', exists);
    expect(entries.map((entry) => `${entry.direction}:${entry.labelKey}:${entry.otherId}`)).toEqual([
      'forward:part_of:boz-uy-overview',
      'forward:learn_next:boz-uy-kiyiz-jabuu',
      'reverse:includes:boz-uy-tunduk',
    ]);
  });

  it('reverse rule: A part_of B reads "includes" from B; learn_next never reverses', () => {
    const overview = connectionsFor('culture_item', 'boz-uy-overview', exists);
    expect(overview.every((entry) => entry.direction === 'reverse')).toBe(true);
    expect(overview.find((entry) => entry.otherId === 'boz-uy-karkas')?.labelKey).toBe('includes');
    expect(overview.find((entry) => entry.otherId === 'boz-uy-ak-orgoo')?.labelKey).toBe('related_tradition');
    expect(connectionsFor('culture_item', 'boz-uy-kiyiz-jabuu', exists).some((entry) => entry.connection.relationKey === 'learn_next')).toBe(false);
    expect(REVERSE_LABEL.learn_next).toBeNull();
    expect(validateConnections([{ ...CULTURE_CONNECTIONS.find((c) => c.relationKey === 'learn_next')!, reverse: true }], CATALOG)).toEqual(expect.arrayContaining([expect.stringMatching(/no reverse reading/)]));
  });

  it('2-5 shown; fewer than two hides the section; missing destinations dropped', () => {
    for (const id of SEEDED.keys()) {
      const count = connectionsFor('culture_item', id, exists).length;
      expect(count === 0 || (count >= 2 && count <= MAX_CONNECTIONS_SHOWN)).toBe(true);
    }
    expect(connectionsFor('culture_item', 'horse-kyz-kuumai', exists)).toEqual([]);
    const without = (type: string, id: string) => exists(type, id) && id !== 'horse-eer';
    expect(connectionsFor('culture_item', 'horse-kok-boru', without)).toEqual([]);
    expect(connectionsFor('culture_item', 'horse-kok-boru', exists).map((entry) => entry.otherId)).toEqual(['horse-overview', 'horse-eer']);
  });

  it('example chains exist: Shyrdak -> Oymo, Boz Üy -> Tündük, Kok Boru -> horse culture', () => {
    expect(connectionsFor('culture_item', 'shyrdak-craft', exists).map((entry) => entry.otherId)).toContain('oymo-overview');
    expect(connectionsFor('culture_item', 'boz-uy-karkas', exists).map((entry) => entry.otherId)).toContain('boz-uy-tunduk');
    expect(connectionsFor('culture_item', 'horse-kok-boru', exists).map((entry) => entry.otherId)).toContain('horse-overview');
  });
});

describe('Culture Connections - routes, offline, UI', () => {
  it('route: /culture/connections/[id] exists; cards open existing content routes', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/app/culture/connections/[id].tsx'))).toBe(true);
    expect(connectionRoute('karkas-part-of-boz-uy')).toBe('/culture/connections/karkas-part-of-boz-uy');
    expect(contentRoute('culture_item', 'x')).toBe('/culture/item/x');
    expect(contentRoute('culture_material', 'y')).toBe('/culture/material/y');
    expect(connectionById('karkas-part-of-boz-uy')?.toId).toBe('boz-uy-overview');
    expect(connectionById('nope')).toBeNull();
  });

  it('offline: connection metadata is bundled (no fetch); destinations use the normal content queries', () => {
    const data = read('src/features/culture/connections/connectionsData.ts');
    expect(data).not.toMatch(/supabase|fetch\(|import /);
    const hook = read('src/features/culture/connections/useConnectionContent.ts');
    expect(hook).toContain('useAllCultureItems()');
    expect(hook).toContain('isWaitingForNetwork(items)');
  });

  it('detail shows only the authored excerpt as explanation (never generated prose)', () => {
    const screen = read('src/features/culture/connections/ConnectionDetailScreen.tsx');
    expect(screen).toContain('{connection.evidence}');
    expect(screen).toContain("t('culture.connections.fromArticle'");
  });

  it('article integration, age variants, analytics properties', () => {
    const article = read('src/features/culture/CultureItemDetailScreen.tsx');
    expect(article).toContain('<ConnectionsSection type="culture_item" id={item.id} experience={experience} />');
    expect(article).toContain('<RelatedItemsRail item={item} />');
    const section = read('src/features/culture/connections/ConnectionsSection.tsx');
    for (const variant of ["experience === 'child'", "experience === 'preteen'"]) expect(section).toContain(variant);
    expect(section).toMatch(/track\('culture_connection_opened', \{ connection_id: entry\.connection\.id, from_id: fromId, to_id: entry\.otherId \}\)/);
  });
});
