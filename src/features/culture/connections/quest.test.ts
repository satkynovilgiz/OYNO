import { CULTURE_CONNECTIONS, type ConnectionContentType } from './connectionsData';
import { linksFrom } from './connectionsModel';
import { generateQuests, hintFor, MAX_QUEST_STEPS, MIN_QUEST_STEPS, questStatus, recoveryStep, routeOf, shortestRoute, type Quest } from './questModel';
import { currentNode, follow, goTo, nodeKey, startTrail, trailOptions, trailStarts, type TrailState } from './trailModel';

const all = () => true;
const item = (id: string) => ({ type: 'culture_item' as ConnectionContentType, id });
const without = (...ids: string[]) => (_type: ConnectionContentType, id: string) => !ids.includes(id);
/** Play a quest by always following the hint. Returns the final state. */
function solveByHints(quest: Quest, exists: (type: ConnectionContentType, id: string) => boolean = all): TrailState {
  let state = startTrail(quest.start);
  for (let guard = 0; guard < 20 && questStatus(state, quest, exists) === 'going'; guard += 1) {
    const hint = hintFor(state, quest, exists)!;
    expect(trailOptions(state, exists).next.some((option) => option.connection.id === hint.connection.id && option.otherId === hint.otherId)).toBe(true); // a hint is always a link on screen
    state = follow(state, hint, exists);
  }
  return state;
}

describe('reachability and directed links', () => {
  it('routes follow linksFrom: directed links plus only the reverse readings the data allows', () => {
    // learn_next has no reverse: from the felt covers there is no link back to the frame.
    expect(linksFrom('culture_item', 'boz-uy-kiyiz-jabuu').some((entry) => entry.otherId === 'boz-uy-karkas')).toBe(false);
    expect(shortestRoute(item('boz-uy-kiyiz-jabuu'), item('boz-uy-karkas'), all)).toBeNull();
    expect(shortestRoute(item('boz-uy-karkas'), item('boz-uy-kiyiz-jabuu'), all)?.map((entry) => entry.connection.id)).toEqual(['karkas-then-kiyiz-jabuu']);
    // Every link on a route is a real dataset connection.
    const route = shortestRoute(item('boz-uy-tunduk'), item('oymo-kochkor-muyuz'), all)!;
    expect(route.length).toBeGreaterThanOrEqual(2);
    for (const entry of route) expect(CULTURE_CONNECTIONS).toContain(entry.connection);
  });

  it('shortest route length is minimal and bounded', () => {
    expect(shortestRoute(item('boz-uy-tunduk'), item('boz-uy-overview'), all)).toHaveLength(2);
    expect(shortestRoute(item('boz-uy-tunduk'), item('horse-kyz-kuumai'), all, new Set(), 2)).toBeNull();
  });
});

describe('offered quests', () => {
  it('only solvable quests, 2-4 links, shortest first; each one solvable by following real links', () => {
    for (const exists of [all, without('boz-uy-kiyiz-jabuu', 'boz-uy-ichki-jasalga'), without('oymo-overview'), without('horse-overview', 'boz-uy-overview')]) {
      const quests = generateQuests(exists);
      const lengths = quests.map((quest) => quest.steps);
      expect([...lengths].sort((a, b) => a - b)).toEqual(lengths);
      for (const quest of quests) {
        expect(quest.steps).toBeGreaterThanOrEqual(MIN_QUEST_STEPS);
        expect(quest.steps).toBeLessThanOrEqual(MAX_QUEST_STEPS);
        expect(exists(quest.start.type, quest.start.id) && exists(quest.destination.type, quest.destination.id)).toBe(true);
        const end = solveByHints(quest, exists);
        expect(questStatus(end, quest, exists)).toBe('arrived');
        expect(routeOf(end)).toHaveLength(quest.steps); // hints follow a shortest route
      }
    }
  });

  it('nothing is offered when no route exists through available content', () => {
    const hub = trailStarts().map((node) => node.id);
    expect(generateQuests(without(...hub))).toEqual([]);
  });
});

describe('hints, cycles and removed nodes', () => {
  const quest: Quest = { id: 'q', start: item('boz-uy-tunduk'), destination: item('oymo-kochkor-muyuz'), steps: 3 };

  it('hints come from an actual remaining route from where the player is', () => {
    let state = startTrail(quest.start);
    expect(hintFor(state, quest, all)?.otherId).toBe('boz-uy-karkas');
    state = follow(state, hintFor(state, quest, all)!, all);
    const next = hintFor(state, quest, all)!;
    expect(shortestRoute(currentNode(state), quest.destination, all)?.[0].otherId).toBe(next.otherId);
  });

  it('cycles: routes never revisit an object, so following never loops', () => {
    for (const start of trailStarts()) {
      for (const destination of trailStarts()) {
        const route = shortestRoute(start, destination, all, new Set(), 10);
        if (!route) continue;
        const keys = [nodeKey(start), ...route.map((entry) => `${entry.otherType}:${entry.otherId}`)];
        expect(new Set(keys).size).toBe(keys.length);
      }
    }
  });

  it('a removed object is routed around - or the quest is not offered at all', () => {
    const missing = without('boz-uy-ichki-jasalga');
    const routeAround = shortestRoute(item('boz-uy-tunduk'), item('oymo-kochkor-muyuz'), missing);
    for (const entry of routeAround ?? []) expect(entry.otherId).not.toBe('boz-uy-ichki-jasalga');
    if (!routeAround) expect(generateQuests(missing).some((entry) => entry.id === 'boz-uy-tunduk--oymo-kochkor-muyuz')).toBe(false);
  });

  it('a dead end says so, and recovery goes back to the latest step that still has a route (or restarts)', () => {
    const toFelt: Quest = { id: 'q2', start: item('boz-uy-karkas'), destination: item('boz-uy-kiyiz-jabuu'), steps: 1 };
    // Wander to the tündük: from there (without going back) the felt covers can't be reached.
    let state = startTrail(toFelt.start);
    state = follow(state, trailOptions(state, all).next.find((entry) => entry.otherId === 'boz-uy-tunduk')!, all);
    expect(questStatus(state, toFelt, all)).toBe('deadEnd');
    expect(hintFor(state, toFelt, all)).toBeNull();
    const back = recoveryStep(state, toFelt, all);
    expect(back).toBe(0);
    state = goTo(state, back!);
    expect(questStatus(state, toFelt, all)).toBe('going');
  });
});
