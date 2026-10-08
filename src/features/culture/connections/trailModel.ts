import { CULTURE_CONNECTIONS, type ConnectionContentType, type CultureConnection } from './connectionsData';
import type { CollectionsData } from '@/features/myCollections/myCollectionsModel';

import { linksFrom, type ArticleConnection } from './connectionsModel';

/**
 * "Follow the Connection" - a trail through the SOURCED connections only
 * (connectionsData: every link quotes OYNO's own authored text). Pure and
 * local: the trail lives in the screen for this visit and is never stored.
 *
 *  - From the current object: up to MAX_TRAIL_OPTIONS links, in curated
 *    order, read the same way as on articles (linksFrom).
 *  - No loops: an object already on the trail (up to the current step) is
 *    never offered again, so following can never circle back.
 *  - Missing content: a link whose destination doesn't exist is listed as
 *    unavailable (not followable) - the trail itself never breaks.
 *  - Going back to an earlier step keeps every later step on screen;
 *    following a NEW link from there replaces the steps after it (like
 *    browser history).
 */
export const MAX_TRAIL_OPTIONS = 3;

export type TrailNode = { type: ConnectionContentType; id: string };
export type TrailStep = { node: TrailNode; via: ArticleConnection | null };
export type TrailState = { steps: TrailStep[]; current: number };

export const sameNode = (a: TrailNode, b: TrailNode) => a.type === b.type && a.id === b.id;
export const nodeKey = (node: TrailNode) => `${node.type}:${node.id}`;

export function startTrail(node: TrailNode): TrailState {
  return { steps: [{ node, via: null }], current: 0 };
}

export const currentNode = (state: TrailState) => state.steps[state.current].node;

export type TrailOptions = {
  /** Followable links (at most MAX_TRAIL_OPTIONS). */
  next: ArticleConnection[];
  /** Links whose destination isn't available - shown, not followable. */
  unavailable: ArticleConnection[];
  /** How many links lead back to objects already on the trail (left out). */
  visited: number;
};

export function trailOptions(state: TrailState, exists: (type: ConnectionContentType, id: string) => boolean, connections: readonly CultureConnection[] = CULTURE_CONNECTIONS): TrailOptions {
  const node = currentNode(state);
  const onTrail = new Set(state.steps.slice(0, state.current + 1).map((step) => nodeKey(step.node)));
  const links = linksFrom(node.type, node.id, connections);
  const fresh = links.filter((entry) => !onTrail.has(nodeKey({ type: entry.otherType, id: entry.otherId })));
  return {
    next: fresh.filter((entry) => exists(entry.otherType, entry.otherId)).slice(0, MAX_TRAIL_OPTIONS),
    unavailable: fresh.filter((entry) => !exists(entry.otherType, entry.otherId)),
    visited: links.length - fresh.length,
  };
}

/** Follow one of the current options; anything else changes nothing. */
export function follow(state: TrailState, entry: ArticleConnection, exists: (type: ConnectionContentType, id: string) => boolean, connections: readonly CultureConnection[] = CULTURE_CONNECTIONS): TrailState {
  const allowed = trailOptions(state, exists, connections).next.some((option) => option.connection.id === entry.connection.id && option.otherId === entry.otherId && option.otherType === entry.otherType);
  if (!allowed) return state;
  const steps = [...state.steps.slice(0, state.current + 1), { node: { type: entry.otherType, id: entry.otherId }, via: entry }];
  return { steps, current: steps.length - 1 };
}

/** Return to any step of this visit (later steps stay listed). */
export function goTo(state: TrailState, index: number): TrailState {
  if (!Number.isInteger(index) || index < 0 || index >= state.steps.length || index === state.current) return state;
  return { ...state, current: index };
}

export const backOne = (state: TrailState) => goTo(state, state.current - 1);
export const forwardOne = (state: TrailState) => goTo(state, state.current + 1);

/** Objects that have at least one sourced link (where a trail can start). */
export function trailStarts(connections: readonly CultureConnection[] = CULTURE_CONNECTIONS): TrailNode[] {
  const seen = new Map<string, TrailNode>();
  for (const connection of connections) {
    for (const node of [{ type: connection.fromType, id: connection.fromId }, ...(connection.reverse ? [{ type: connection.toType, id: connection.toId }] : [])]) seen.set(nodeKey(node), node);
  }
  return [...seen.values()];
}

/** The person's OWN collections that contain this object - shown apart from sourced links. */
export function groupingsFor(data: CollectionsData, node: TrailNode): { id: string; name: string }[] {
  const ids = new Set(data.items.filter((item) => item.contentType === node.type && item.contentId === node.id).map((item) => item.collectionId));
  return data.collections.filter((collection) => ids.has(collection.id)).map((collection) => ({ id: collection.id, name: collection.name }));
}
