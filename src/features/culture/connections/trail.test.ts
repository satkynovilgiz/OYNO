import { CULTURE_CONNECTIONS, type ConnectionContentType } from './connectionsData';
import { linksFrom } from './connectionsModel';
import { backOne, currentNode, follow, forwardOne, goTo, groupingsFor, MAX_TRAIL_OPTIONS, nodeKey, startTrail, trailOptions, trailStarts, type TrailState } from './trailModel';

const all = () => true;
const item = (id: string) => ({ type: 'culture_item' as ConnectionContentType, id });
const optionIds = (state: TrailState, exists = all) => trailOptions(state, exists).next.map((entry) => entry.otherId);
const followTo = (state: TrailState, id: string, exists = all) => {
  const entry = trailOptions(state, exists).next.find((option) => option.otherId === id);
  if (!entry) throw new Error(`${id} is not offered from ${currentNode(state).id}`);
  return follow(state, entry, exists);
};

describe('relationship selection', () => {
  it('at most three links, in curated order, each a sourced connection with its explanation and source', () => {
    for (const start of trailStarts()) {
      const options = trailOptions(startTrail(start), all).next;
      expect(options.length).toBeLessThanOrEqual(MAX_TRAIL_OPTIONS);
      expect(options.length).toBeGreaterThan(0);
      const curated = linksFrom(start.type, start.id).slice(0, MAX_TRAIL_OPTIONS).map((entry) => entry.otherId);
      expect(options.map((entry) => entry.otherId)).toEqual(curated);
      for (const option of options) {
        expect(CULTURE_CONNECTIONS).toContain(option.connection);
        expect(option.connection.evidence.length).toBeGreaterThanOrEqual(10);
        expect(option.connection.source.contentId).toBeTruthy();
      }
    }
  });

  it('reverse links read with their reverse label; learn_next has no way back', () => {
    const fromKarkas = trailOptions(startTrail(item('boz-uy-karkas')), all).next;
    expect(fromKarkas.find((entry) => entry.otherId === 'boz-uy-tunduk')?.labelKey).toBe('includes');
    const fromKiyiz = trailOptions(startTrail(item('boz-uy-kiyiz-jabuu')), all).next;
    expect(fromKiyiz.some((entry) => entry.otherId === 'boz-uy-karkas')).toBe(false);
  });
});

describe('no loops', () => {
  it('an object already on the trail is never offered again', () => {
    let state = startTrail(item('boz-uy-tunduk'));
    state = followTo(state, 'boz-uy-karkas');
    expect(optionIds(state)).not.toContain('boz-uy-tunduk');
    expect(trailOptions(state, all).visited).toBe(1);
    state = followTo(state, 'boz-uy-overview');
    expect(optionIds(state)).not.toContain('boz-uy-karkas');
  });

  it('every possible walk ends - no node twice, from every start', () => {
    let walks = 0;
    const explore = (state: TrailState, depth: number) => {
      const keys = state.steps.slice(0, state.current + 1).map((step) => nodeKey(step.node));
      expect(new Set(keys).size).toBe(keys.length);
      expect(depth).toBeLessThan(50);
      const next = trailOptions(state, all).next;
      if (next.length === 0) walks += 1;
      for (const entry of next) explore(follow(state, entry, all), depth + 1);
    };
    for (const start of trailStarts()) explore(startTrail(start), 0);
    expect(walks).toBeGreaterThan(0);
  });

  it('a dead end says so (no options), and stepping back offers the way on again', () => {
    let state = startTrail(item('boz-uy-tunduk'));
    state = followTo(state, 'boz-uy-karkas');
    state = followTo(state, 'boz-uy-kiyiz-jabuu');
    expect(optionIds(state)).toEqual([]);
    state = backOne(state);
    expect(optionIds(state)).toContain('boz-uy-overview');
  });
});

describe('missing content', () => {
  it('a missing destination is listed as unavailable and cannot be followed; the rest still work', () => {
    const exists = (_type: ConnectionContentType, id: string) => id !== 'shyrdak-craft';
    const state = startTrail(item('boz-uy-ichki-jasalga'));
    const options = trailOptions(state, exists);
    expect(options.unavailable.map((entry) => entry.otherId)).toEqual(['shyrdak-craft']);
    expect(options.next.map((entry) => entry.otherId)).not.toContain('shyrdak-craft');
    expect(options.next.length).toBeGreaterThan(0);
    const missing = linksFrom('culture_item', 'boz-uy-ichki-jasalga').find((entry) => entry.otherId === 'shyrdak-craft')!;
    expect(follow(state, missing, exists)).toBe(state);
  });

  it('a link not offered from here (or made up) changes nothing', () => {
    const state = startTrail(item('boz-uy-tunduk'));
    const elsewhere = linksFrom('culture_item', 'horse-kok-boru')[0];
    expect(follow(state, elsewhere, all)).toBe(state);
  });
});

describe('retracing', () => {
  it('going back keeps the later steps; forward returns; following a new link replaces what came after', () => {
    let state = startTrail(item('boz-uy-tunduk'));
    state = followTo(state, 'boz-uy-karkas');
    state = followTo(state, 'boz-uy-overview');
    expect(state.steps.map((step) => step.node.id)).toEqual(['boz-uy-tunduk', 'boz-uy-karkas', 'boz-uy-overview']);
    state = goTo(state, 0);
    expect(currentNode(state).id).toBe('boz-uy-tunduk');
    expect(state.steps).toHaveLength(3);
    state = forwardOne(forwardOne(state));
    expect(currentNode(state).id).toBe('boz-uy-overview');
    state = goTo(state, 1);
    state = followTo(state, 'boz-uy-kiyiz-jabuu');
    expect(state.steps.map((step) => step.node.id)).toEqual(['boz-uy-tunduk', 'boz-uy-karkas', 'boz-uy-kiyiz-jabuu']);
    expect(state.steps[2].via?.connection.id).toBe('karkas-then-kiyiz-jabuu');
    // Out of range or no-op jumps change nothing.
    expect(goTo(state, 9)).toBe(state);
    expect(goTo(state, state.current)).toBe(state);
    expect(backOne(startTrail(item('boz-uy-tunduk'))).current).toBe(0);
  });
});

describe('your collections stay separate', () => {
  it('groupings come only from the person own collection items for this object', () => {
    const data = {
      collections: [
        { id: 'c1', name: 'Yurt things', description: null, createdAt: '', updatedAt: '' },
        { id: 'c2', name: 'Horses', description: null, createdAt: '', updatedAt: '' },
      ],
      items: [
        { collectionId: 'c1', contentType: 'culture_item', contentId: 'boz-uy-tunduk', sortOrder: 0, addedAt: '' },
        { collectionId: 'c2', contentType: 'culture_item', contentId: 'horse-eer', sortOrder: 0, addedAt: '' },
      ],
    } as never;
    expect(groupingsFor(data, item('boz-uy-tunduk'))).toEqual([{ id: 'c1', name: 'Yurt things' }]);
    expect(groupingsFor(data, item('boz-uy-karkas'))).toEqual([]);
    // ...and never become trail links.
    expect(optionIds(startTrail(item('boz-uy-tunduk')))).toEqual(['boz-uy-karkas']);
  });
});
