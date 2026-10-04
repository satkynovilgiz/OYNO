import { CULTURE_CONNECTIONS, MAX_CONNECTIONS_SHOWN, MIN_CONNECTIONS_SHOWN, RELATION_KEYS, REVERSE_LABEL, type ConnectionContentType, type CultureConnection, type RelationKey } from './connectionsData';

/** One connection as seen from the article being read. */
export type ArticleConnection = {
  connection: CultureConnection;
  direction: 'forward' | 'reverse';
  /** i18n key under culture.connections.relation.* */
  labelKey: string;
  otherType: ConnectionContentType;
  otherId: string;
};

const forwardLabel = (relation: RelationKey) => relation;

/**
 * Connections shown on an article: its own outgoing connections (curated
 * order), then incoming ones that explicitly allow reverse navigation -
 * read with the reverse label, never as the same relation. Destinations
 * that don't exist (deleted content) are dropped. Below the minimum the
 * section isn't shown at all.
 */
export function connectionsFor(
  type: ConnectionContentType,
  id: string,
  exists: (type: ConnectionContentType, id: string) => boolean,
  connections: readonly CultureConnection[] = CULTURE_CONNECTIONS,
): ArticleConnection[] {
  const result: ArticleConnection[] = [];
  const seen = new Set<string>();
  const add = (entry: ArticleConnection) => {
    const key = `${entry.otherType}:${entry.otherId}`;
    if (seen.has(key) || !exists(entry.otherType, entry.otherId)) return;
    seen.add(key);
    result.push(entry);
  };
  for (const connection of connections)
    if (connection.fromType === type && connection.fromId === id) add({ connection, direction: 'forward', labelKey: forwardLabel(connection.relationKey), otherType: connection.toType, otherId: connection.toId });
  for (const connection of connections) {
    const reverseLabel = REVERSE_LABEL[connection.relationKey];
    if (connection.toType === type && connection.toId === id && connection.reverse && reverseLabel)
      add({ connection, direction: 'reverse', labelKey: reverseLabel, otherType: connection.fromType, otherId: connection.fromId });
  }
  const shown = result.slice(0, MAX_CONNECTIONS_SHOWN);
  return shown.length >= MIN_CONNECTIONS_SHOWN ? shown : [];
}

export function connectionById(id: string, connections: readonly CultureConnection[] = CULTURE_CONNECTIONS): CultureConnection | null {
  return connections.find((connection) => connection.id === id) ?? null;
}

export type ConnectionCatalog = {
  /** Authored fields per content key `${type}:${id}`. */
  content: ReadonlyMap<string, Partial<Record<string, unknown>>>;
  /** Locale objects that must all carry each relation label. */
  locales: readonly Record<string, unknown>[];
};

const labelExists = (locale: Record<string, unknown>, key: string) => {
  const relation = ((locale.culture as Record<string, unknown> | undefined)?.connections as Record<string, unknown> | undefined)?.relation as Record<string, unknown> | undefined;
  return typeof relation?.[key] === 'string' && !!(relation[key] as string).trim();
};

/** Integrity rules (tests / maintenance). Empty array = valid. */
export function validateConnections(connections: readonly CultureConnection[], catalog: ConnectionCatalog): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const pairs = new Set<string>();
  for (const connection of connections) {
    const tag = connection.id;
    if (ids.has(connection.id)) problems.push(`duplicate id ${tag}`);
    ids.add(connection.id);
    if (!/^[a-z0-9-]+$/.test(connection.id)) problems.push(`${tag}: invalid id`);
    if (!catalog.content.has(`${connection.fromType}:${connection.fromId}`)) problems.push(`${tag}: from ${connection.fromId} missing`);
    if (!catalog.content.has(`${connection.toType}:${connection.toId}`)) problems.push(`${tag}: to ${connection.toId} missing`);
    if (connection.fromType === connection.toType && connection.fromId === connection.toId) problems.push(`${tag}: self-link`);
    if (!(RELATION_KEYS as readonly string[]).includes(connection.relationKey)) problems.push(`${tag}: unknown relation ${connection.relationKey}`);
    const pair = `${connection.fromType}:${connection.fromId}>${connection.toType}:${connection.toId}`;
    const reversePair = `${connection.toType}:${connection.toId}>${connection.fromType}:${connection.fromId}`;
    if (pairs.has(pair) || pairs.has(reversePair)) problems.push(`${tag}: duplicate connection ${pair}`);
    pairs.add(pair);
    if (connection.reverse && !REVERSE_LABEL[connection.relationKey]) problems.push(`${tag}: ${connection.relationKey} has no reverse reading`);
    // Provenance: the evidence is an exact excerpt of the cited authored field.
    const source = catalog.content.get(`${connection.source.contentType}:${connection.source.contentId}`);
    const text = source?.[connection.source.field];
    if (!source) problems.push(`${tag}: source ${connection.source.contentId} missing`);
    else if (typeof text !== 'string' || !text.includes(connection.evidence)) problems.push(`${tag}: evidence not found in ${connection.source.contentId}.${connection.source.field}`);
    if (connection.evidence.trim().length < 10) problems.push(`${tag}: evidence too short`);
    // Localization: both readings of the relation exist in every locale.
    const keys = [connection.relationKey, ...(connection.reverse && REVERSE_LABEL[connection.relationKey] ? [REVERSE_LABEL[connection.relationKey]!] : [])];
    for (const key of keys) for (const [position, locale] of catalog.locales.entries()) if (!labelExists(locale, key)) problems.push(`${tag}: label ${key} missing in locale #${position}`);
  }
  return problems;
}
