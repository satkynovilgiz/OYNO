import { buildMap, keepView, keyOf, layout, MAX_NODES, viewFor } from './connectionMapModel';
import { CULTURE_CONNECTIONS, REVERSE_LABEL, type CultureConnection } from './connectionsData';
import { linksFrom } from './connectionsModel';

const all = () => true;
const c = (id: string, from: string, to: string, change: Partial<CultureConnection> = {}): CultureConnection => ({ id, fromType: 'culture_item', fromId: from, toType: 'culture_item', toId: to, relationKey: 'part_of', reverse: true, source: { contentType: 'culture_item', contentId: from, field: 'history' }, evidence: `${from}->${to}`, ...change });
const A = { type: 'culture_item' as const, id: 'a' };

describe('graph extraction', () => {
  it('every edge is a real dataset entry, drawn in its dataset direction', () => {
    const start = { type: CULTURE_CONNECTIONS[0].fromType, id: CULTURE_CONNECTIONS[0].fromId };
    const map = buildMap(start, new Set(), all);
    expect(map.edges.length).toBeGreaterThan(0);
    for (const edge of map.edges) {
      const entry = CULTURE_CONNECTIONS.find((x) => x.id === edge.connectionId)!;
      expect(entry).toBeDefined();
      expect(edge.from).toBe(keyOf({ type: entry.fromType, id: entry.fromId }));
      expect(edge.to).toBe(keyOf({ type: entry.toType, id: entry.toId }));
      expect(edge.reverseLabel).toBe(entry.reverse ? REVERSE_LABEL[entry.relationKey] : null);
    }
  });
  it('starts with two hops; deeper only by explicit expansion', () => {
    const data = [c('ab', 'a', 'b'), c('bc', 'b', 'c'), c('cd', 'c', 'd')];
    const first = buildMap(A, new Set(), all, data);
    expect(first.nodes.map((n) => [n.id, n.depth])).toEqual([['a', 0], ['b', 1], ['c', 2]]);
    expect(first.nodes.find((n) => n.id === 'c')?.expandable).toBe(true);
    const more = buildMap(A, new Set(['culture_item:c']), all, data);
    expect(more.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(more.edges.map((e) => e.connectionId)).toEqual(['ab', 'bc', 'cd']);
  });
});

describe('direction', () => {
  it('a one-way relation is not followed backwards (same rule as the article view)', () => {
    const data = [c('xa', 'x', 'a', { relationKey: 'learn_next', reverse: false }), c('ab', 'a', 'b')];
    const map = buildMap(A, new Set(), all, data);
    expect(map.nodes.map((n) => n.id)).toEqual(['a', 'b']); // x -> a (learn next) is not readable from a
    expect(linksFrom('culture_item', 'a', data).map((l) => l.connection.id)).toEqual(['ab']);
  });
  it('a permitted reverse reading is followed and labelled, the arrow keeps the dataset direction', () => {
    const data = [c('xa', 'x', 'a', { relationKey: 'uses', reverse: true })];
    const [edge] = buildMap(A, new Set(), all, data).edges;
    expect(edge).toMatchObject({ from: 'culture_item:x', to: 'culture_item:a', reverseLabel: 'used_in' });
  });
});

describe('cycles and limits', () => {
  it('a cycle never repeats a node or an edge, even when every node is expanded', () => {
    const data = [c('ab', 'a', 'b'), c('bc', 'b', 'c'), c('ca', 'c', 'a')];
    const map = buildMap(A, new Set(['culture_item:a', 'culture_item:b', 'culture_item:c']), all, data);
    expect(map.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c']);
    expect(map.edges).toHaveLength(3);
  });
  it(`at most ${MAX_NODES} nodes; the rest are counted, not drawn`, () => {
    const data = Array.from({ length: 20 }, (_, i) => c(`a${i}`, 'a', `n${i}`));
    const map = buildMap(A, new Set(), all, data);
    expect(map.nodes).toHaveLength(MAX_NODES);
    expect(map.hidden).toBe(20 - (MAX_NODES - 1));
    expect(map.edges.every((e) => map.nodes.some((n) => n.key === e.to))).toBe(true);
  });
});

describe('missing content', () => {
  it('an unavailable object is shown as unavailable, never expanded or substituted', () => {
    const data = [c('ab', 'a', 'gone'), c('gc', 'gone', 'c')];
    const map = buildMap(A, new Set(['culture_item:gone']), (_t, id) => id !== 'gone', data);
    expect(map.nodes.map((n) => [n.id, n.available, n.expandable])).toEqual([['a', true, false], ['gone', false, false]]);
    expect(map.edges.map((e) => e.connectionId)).toEqual(['ab']);
  });
});

describe('layout and view memory', () => {
  it('positions are deterministic and inside the map', () => {
    const data = [c('ab', 'a', 'b'), c('ac', 'a', 'c')];
    const map = buildMap(A, new Set(), all, data);
    const p = layout(map, 320);
    expect(layout(map, 320)).toEqual(p);
    expect(p['culture_item:a']).toEqual({ x: 160, y: 160 });
    for (const pos of Object.values(p)) expect(pos.x >= 0 && pos.x <= 320 && pos.y >= 0 && pos.y <= 320).toBe(true);
  });
  it('selection, expansion and viewport survive leaving for a source', () => {
    keepView('culture_item:a', { expanded: ['culture_item:c'], selectedEdge: 'bc', zoom: 1.5, scroll: { x: 40, y: 0 } });
    expect(viewFor('culture_item:a')).toEqual({ expanded: ['culture_item:c'], selectedEdge: 'bc', zoom: 1.5, scroll: { x: 40, y: 0 } });
    expect(viewFor('culture_item:other').selectedEdge).toBeNull();
  });
});
