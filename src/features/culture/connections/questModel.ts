import { CULTURE_CONNECTIONS, type ConnectionContentType, type CultureConnection } from './connectionsData';
import { linksFrom, type ArticleConnection } from './connectionsModel';
import { currentNode, nodeKey, sameNode, trailStarts, type TrailNode, type TrailState } from './trailModel';

/**
 * Connection Quest - get from a starting object to a destination by
 * following SOURCED connections only (the trail's own rules: linksFrom
 * reads directed links plus the reverse readings the data allows; objects
 * already on the trail are not offered again). Pure; attempts are
 * ephemeral and earn nothing.
 *
 * A quest is offered ONLY when a route exists through available content,
 * at most MAX_QUEST_STEPS long; shorter quests come first. Hints and the
 * dead-end recovery use an actual remaining route, computed live.
 */
export const MIN_QUEST_STEPS = 2;
export const MAX_QUEST_STEPS = 4;
export const MAX_QUESTS = 6;

type Exists = (type: ConnectionContentType, id: string) => boolean;
export type Quest = { id: string; start: TrailNode; destination: TrailNode; steps: number };

/** Links from a node to AVAILABLE content (the edges a player can actually follow). */
const edges = (node: TrailNode, exists: Exists, connections: readonly CultureConnection[]) => linksFrom(node.type, node.id, connections).filter((entry) => exists(entry.otherType, entry.otherId));
const target = (entry: ArticleConnection): TrailNode => ({ type: entry.otherType, id: entry.otherId });

/**
 * Shortest route (as the links to follow) from `from` to `to`, never
 * passing through `blocked` objects, at most `maxSteps` long. null = none.
 */
export function shortestRoute(from: TrailNode, to: TrailNode, exists: Exists, blocked: ReadonlySet<string> = new Set(), maxSteps = MAX_QUEST_STEPS, connections: readonly CultureConnection[] = CULTURE_CONNECTIONS): ArticleConnection[] | null {
  if (sameNode(from, to)) return [];
  if (!exists(from.type, from.id) || !exists(to.type, to.id)) return null;
  const seen = new Set([nodeKey(from), ...blocked]);
  let frontier: { node: TrailNode; route: ArticleConnection[] }[] = [{ node: from, route: [] }];
  for (let depth = 0; depth < maxSteps && frontier.length > 0; depth += 1) {
    const next: typeof frontier = [];
    for (const { node, route } of frontier) {
      for (const entry of edges(node, exists, connections)) {
        const reached = target(entry);
        const key = nodeKey(reached);
        if (seen.has(key)) continue;
        const path = [...route, entry];
        if (sameNode(reached, to)) return path;
        seen.add(key);
        next.push({ node: reached, route: path });
      }
    }
    frontier = next;
  }
  return null;
}

/** Quests that are solvable now: every ordered pair of available objects 2-4 links apart; shortest first, varied starts. */
export function generateQuests(exists: Exists, connections: readonly CultureConnection[] = CULTURE_CONNECTIONS): Quest[] {
  const nodes = trailStarts(connections).filter((node) => exists(node.type, node.id));
  const all: Quest[] = [];
  for (const start of nodes) {
    for (const destination of nodes) {
      if (sameNode(start, destination)) continue;
      const route = shortestRoute(start, destination, exists, new Set(), MAX_QUEST_STEPS, connections);
      if (route && route.length >= MIN_QUEST_STEPS) all.push({ id: `${start.id}--${destination.id}`, start, destination, steps: route.length });
    }
  }
  all.sort((a, b) => a.steps - b.steps || a.id.localeCompare(b.id));
  // Shortest first, but varied: up to two quests of each length (2, 3, 4 links), each from a different start; then fill up.
  const picked: Quest[] = [];
  const starts = new Set<string>();
  for (let steps = MIN_QUEST_STEPS; steps <= MAX_QUEST_STEPS; steps += 1) {
    let taken = 0;
    for (const quest of all) {
      if (quest.steps !== steps || taken >= 2 || picked.length >= MAX_QUESTS || starts.has(nodeKey(quest.start))) continue;
      picked.push(quest);
      starts.add(nodeKey(quest.start));
      taken += 1;
    }
  }
  for (const quest of all) if (picked.length < MAX_QUESTS && !picked.includes(quest)) picked.push(quest);
  return picked.sort((a, b) => a.steps - b.steps || a.id.localeCompare(b.id));
}

/** Objects on the trail up to (not including) the current one - the trail never offers them again. */
const behind = (state: TrailState) => new Set(state.steps.slice(0, state.current).map((step) => nodeKey(step.node)));

export type QuestStatus = 'arrived' | 'going' | 'deadEnd';
export function questStatus(state: TrailState, quest: Quest, exists: Exists, connections: readonly CultureConnection[] = CULTURE_CONNECTIONS): QuestStatus {
  const node = currentNode(state);
  if (sameNode(node, quest.destination)) return 'arrived';
  // A route must remain without going back through the trail (which the trail won't offer). No step bound here: the player may wander.
  return shortestRoute(node, quest.destination, exists, behind(state), Number.MAX_SAFE_INTEGER, connections) ? 'going' : 'deadEnd';
}

/** A hint: the next link of an actual remaining route from where the player is. */
export function hintFor(state: TrailState, quest: Quest, exists: Exists, connections: readonly CultureConnection[] = CULTURE_CONNECTIONS): ArticleConnection | null {
  const route = shortestRoute(currentNode(state), quest.destination, exists, behind(state), Number.MAX_SAFE_INTEGER, connections);
  return route && route.length > 0 ? route[0] : null;
}

/** Dead end: the latest earlier step from which a route still exists (go back there), or null (restart). */
export function recoveryStep(state: TrailState, quest: Quest, exists: Exists, connections: readonly CultureConnection[] = CULTURE_CONNECTIONS): number | null {
  for (let index = state.current - 1; index >= 0; index -= 1) {
    const before = new Set(state.steps.slice(0, index).map((step) => nodeKey(step.node)));
    if (shortestRoute(state.steps[index].node, quest.destination, exists, before, Number.MAX_SAFE_INTEGER, connections)) return index;
  }
  return null;
}

/** The finished route: each link followed, with its sourced evidence. */
export const routeOf = (state: TrailState) => state.steps.slice(1, state.current + 1).map((step) => step.via!).filter(Boolean);

/** The quest in progress survives the screen being re-created (memory only). */
let active: { quest: Quest; state: TrailState } | null = null;
export const keepQuest = (value: { quest: Quest; state: TrailState } | null) => {
  active = value;
};
export const resumeQuest = () => active;
