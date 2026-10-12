import { linksFrom, type ArticleConnection } from './connectionsModel';
import { CULTURE_CONNECTIONS, REVERSE_LABEL, type ConnectionContentType, type CultureConnection } from './connectionsData';

/**
 * Connection Map - a bounded view over the EXISTING sourced connections.
 * Traversal uses `linksFrom` (the article rule): a node's outgoing links,
 * plus incoming ones only where the dataset allows a reverse reading.
 * Every edge IS one dataset entry (by id), drawn in its dataset direction
 * (from -> to); the reverse reading is shown only when permitted.
 *
 * Bounded: the start, its neighbours and their neighbours (two hops) are
 * shown at first, at most MAX_NODES; more only by explicit Expand. Nodes
 * are de-duplicated by key, so cycles never expand twice.
 */
export const MAX_NODES = 12;
export type MapNodeRef = { type: ConnectionContentType; id: string };
export const keyOf = (n: MapNodeRef) => `${n.type}:${n.id}`;
export type MapNode = MapNodeRef & { key: string; depth: number; available: boolean; expandable: boolean; expanded: boolean };
export type MapEdge = { connectionId: string; from: string; to: string; relationKey: CultureConnection['relationKey']; reverseLabel: string | null; connection: CultureConnection };
export type ConnectionMap = { nodes: MapNode[]; edges: MapEdge[]; hidden: number };

/**
 * The graph for `start` with these nodes expanded (start always is).
 * Unavailable nodes are shown and labelled, never expanded (no substitute).
 */
export function buildMap(start: MapNodeRef, expanded: ReadonlySet<string>, exists: (type: ConnectionContentType, id: string) => boolean, connections: readonly CultureConnection[] = CULTURE_CONNECTIONS, maxNodes = MAX_NODES): ConnectionMap {
  const nodes = new Map<string, MapNode>();
  const edges = new Map<string, MapEdge>();
  let hidden = 0;
  const addNode = (ref: MapNodeRef, depth: number): MapNode | null => {
    const key = keyOf(ref);
    const existing = nodes.get(key);
    if (existing) return existing;
    if (nodes.size >= maxNodes) return null;
    const available = exists(ref.type, ref.id);
    const node: MapNode = { ...ref, key, depth, available, expandable: false, expanded: false };
    nodes.set(key, node);
    return node;
  };
  const startNode = addNode(start, 0)!;
  const queue: MapNode[] = [startNode];
  const visited = new Set<string>();
  const want = new Set([startNode.key, ...expanded]);
  const hiddenKeys = new Set<string>();
  while (queue.length) {
    const node = queue.shift()!;
    if (visited.has(node.key)) continue;
    visited.add(node.key);
    const links: ArticleConnection[] = node.available ? linksFrom(node.type, node.id, connections) : [];
    // Two hops at first: the start and its direct neighbours always open; deeper nodes only when expanded.
    const open = node.available && (want.has(node.key) || node.depth <= 1);
    if (!open) continue;
    node.expanded = true;
    for (const link of links) {
      const other = addNode({ type: link.otherType, id: link.otherId }, node.depth + 1);
      if (!other) {
        hiddenKeys.add(`${link.otherType}:${link.otherId}`);
        continue;
      }
      const c = link.connection;
      if (!edges.has(c.id)) edges.set(c.id, { connectionId: c.id, from: keyOf({ type: c.fromType, id: c.fromId }), to: keyOf({ type: c.toType, id: c.toId }), relationKey: c.relationKey, reverseLabel: c.reverse ? REVERSE_LABEL[c.relationKey] : null, connection: c });
      if (!visited.has(other.key)) queue.push(other);
    }
  }
  // Expandable = not yet opened, and opening it would add at least one new edge.
  for (const node of nodes.values()) {
    if (node.expanded) node.expandable = false;
    else node.expandable = node.available && linksFrom(node.type, node.id, connections).some((link) => !edges.has(link.connection.id));
  }
  hidden = [...hiddenKeys].filter((key) => !nodes.has(key)).length;
  return { nodes: [...nodes.values()], edges: [...edges.values()], hidden };
}

/** Deterministic rings: depth 0 in the centre, each depth on its own circle, evenly spaced in node order. */
export function layout(map: ConnectionMap, size: number): Record<string, { x: number; y: number }> {
  const centre = size / 2;
  const byDepth = new Map<number, MapNode[]>();
  for (const node of map.nodes) byDepth.set(node.depth, [...(byDepth.get(node.depth) ?? []), node]);
  const maxDepth = Math.max(1, ...byDepth.keys());
  const out: Record<string, { x: number; y: number }> = {};
  for (const [depth, list] of byDepth) {
    const radius = depth === 0 ? 0 : (depth / maxDepth) * (size / 2 - 44);
    list.forEach((node, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / list.length + (depth % 2 ? 0 : Math.PI / list.length);
      out[node.key] = { x: Math.round(centre + radius * Math.cos(angle)), y: Math.round(centre + radius * Math.sin(angle)) };
    });
  }
  return out;
}

/* ---------- the map's state survives opening a source (memory, per start) ---------- */
export type MapViewState = { expanded: string[]; selectedEdge: string | null; zoom: 1 | 1.5; scroll: { x: number; y: number } };
const views = new Map<string, MapViewState>();
export const EMPTY_VIEW: MapViewState = { expanded: [], selectedEdge: null, zoom: 1, scroll: { x: 0, y: 0 } };
export const viewFor = (startKey: string) => views.get(startKey) ?? EMPTY_VIEW;
export const keepView = (startKey: string, view: MapViewState) => views.set(startKey, view);
export const mapRoute = (start: MapNodeRef) => `/culture/connections/map?start=${encodeURIComponent(start.id)}${start.type === 'culture_material' ? '&type=culture_material' : ''}`;
