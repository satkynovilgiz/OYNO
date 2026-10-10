/**
 * Culture Connections 1.0 - curated, authored relationships between
 * existing OYNO articles. Editorial knowledge, not recommendations:
 * nothing here is inferred from categories, titles or keywords
 * (RelatedItemsRail keeps doing same-category browsing).
 *
 * Every connection is justified by OYNO's own authored text: `source`
 * points at the article field that states the relationship, and
 * `evidence` is an EXACT excerpt of that field (checked by the validator
 * against the seeded content). The excerpt is what the detail screen shows
 * as the explanation - quoted, attributed, never generated prose.
 *
 * Left out on purpose (no authored text names another OYNO article):
 * komuz (no music-tradition article exists yet), clothing items, foods.
 */

export type ConnectionContentType = 'culture_item' | 'culture_material';

export const RELATION_KEYS = ['part_of', 'related_tradition', 'uses', 'made_with', 'symbolic_connection', 'learn_next'] as const;
export type RelationKey = (typeof RELATION_KEYS)[number];

/**
 * How a relation reads when shown on the DESTINATION article (B -> A).
 * Not assumed symmetric: `part_of` reads "Includes" from the other side,
 * `uses` reads "Used in"; `learn_next` has no reverse at all.
 */
export const REVERSE_LABEL: Record<RelationKey, string | null> = {
  part_of: 'includes',
  related_tradition: 'related_tradition',
  uses: 'used_in',
  made_with: 'material_for',
  symbolic_connection: 'symbolic_connection',
  learn_next: null,
};

export type CultureConnection = {
  id: string;
  fromType: ConnectionContentType;
  fromId: string;
  toType: ConnectionContentType;
  toId: string;
  relationKey: RelationKey;
  /** Show on the destination article too, with REVERSE_LABEL. */
  reverse: boolean;
  /** Where OYNO's authored content states this relationship. */
  source: { contentType: 'culture_item'; contentId: string; field: string };
  /** Exact excerpt of that field (Kyrgyz, as authored). */
  evidence: string;
};

export const CULTURE_CONNECTIONS: readonly CultureConnection[] = [
  // Boz üy: Tündük -> frame -> the boz üy -> its interior.
  {
    id: 'tunduk-part-of-karkas',
    fromType: 'culture_item', fromId: 'boz-uy-tunduk', toType: 'culture_item', toId: 'boz-uy-karkas',
    relationKey: 'part_of', reverse: true,
    source: { contentType: 'culture_item', contentId: 'boz-uy-karkas', field: 'objects_used' },
    evidence: 'Кереге (дубал каркасы), уук (чатыр таякчалары), түндүк',
  },
  {
    id: 'karkas-part-of-boz-uy',
    fromType: 'culture_item', fromId: 'boz-uy-karkas', toType: 'culture_item', toId: 'boz-uy-overview',
    relationKey: 'part_of', reverse: true,
    source: { contentType: 'culture_item', contentId: 'boz-uy-karkas', field: 'cultural_meaning' },
    evidence: 'Боз үйдүн жыгач каркасы үч негизги бөлүктөн турат',
  },
  {
    id: 'karkas-then-kiyiz-jabuu',
    fromType: 'culture_item', fromId: 'boz-uy-karkas', toType: 'culture_item', toId: 'boz-uy-kiyiz-jabuu',
    relationKey: 'learn_next', reverse: false,
    source: { contentType: 'culture_item', contentId: 'boz-uy-kiyiz-jabuu', field: 'cultural_meaning' },
    evidence: 'Жыгач каркас даяр болгон соң, ага кийиз жабуулар жабылат',
  },
  {
    id: 'ichki-jasalga-part-of-boz-uy',
    fromType: 'culture_item', fromId: 'boz-uy-ichki-jasalga', toType: 'culture_item', toId: 'boz-uy-overview',
    relationKey: 'part_of', reverse: true,
    source: { contentType: 'culture_item', contentId: 'boz-uy-ichki-jasalga', field: 'cultural_meaning' },
    evidence: 'Боз үйдүн ичи так эрежелер боюнча бөлүнөт',
  },
  {
    id: 'ak-orgoo-related-boz-uy',
    fromType: 'culture_item', fromId: 'boz-uy-ak-orgoo', toType: 'culture_item', toId: 'boz-uy-overview',
    relationKey: 'related_tradition', reverse: true,
    source: { contentType: 'culture_item', contentId: 'boz-uy-ak-orgoo', field: 'cultural_meaning' },
    evidence: 'Ак өргөө - жасалгалуу, көлөмдүү боз үй',
  },
  // Interior -> felt and ornament.
  {
    id: 'ichki-jasalga-uses-shyrdak',
    fromType: 'culture_item', fromId: 'boz-uy-ichki-jasalga', toType: 'culture_item', toId: 'shyrdak-craft',
    relationKey: 'uses', reverse: true,
    source: { contentType: 'culture_item', contentId: 'boz-uy-ichki-jasalga', field: 'objects_used' },
    evidence: 'шырдак жана ала кийиз (полго төшөлүүчү)',
  },
  {
    id: 'ichki-jasalga-uses-ala-kiyiz',
    fromType: 'culture_item', fromId: 'boz-uy-ichki-jasalga', toType: 'culture_item', toId: 'shyrdak-ala-kiyiz',
    relationKey: 'uses', reverse: true,
    source: { contentType: 'culture_item', contentId: 'boz-uy-ichki-jasalga', field: 'objects_used' },
    evidence: 'шырдак жана ала кийиз (полго төшөлүүчү)',
  },
  {
    id: 'ichki-jasalga-uses-kochkor-muyuz',
    fromType: 'culture_item', fromId: 'boz-uy-ichki-jasalga', toType: 'culture_item', toId: 'oymo-kochkor-muyuz',
    relationKey: 'uses', reverse: true,
    source: { contentType: 'culture_item', contentId: 'boz-uy-ichki-jasalga', field: 'objects_used' },
    evidence: 'килемдер (кочкор мүйүз оюмдуу)',
  },
  // Shyrdak -> Oymo -> felt.
  {
    id: 'ala-kiyiz-related-shyrdak',
    fromType: 'culture_item', fromId: 'shyrdak-ala-kiyiz', toType: 'culture_item', toId: 'shyrdak-craft',
    relationKey: 'related_tradition', reverse: true,
    source: { contentType: 'culture_item', contentId: 'shyrdak-ala-kiyiz', field: 'origin' },
    evidence: 'Шырдак менен бир тектеш, бирок башка ыкма менен жасалган кийиз түрү.',
  },
  {
    id: 'shyrdak-uses-oymo',
    fromType: 'culture_item', fromId: 'shyrdak-craft', toType: 'culture_item', toId: 'oymo-overview',
    relationKey: 'uses', reverse: true,
    source: { contentType: 'culture_item', contentId: 'oymo-overview', field: 'objects_used' },
    evidence: 'Кийиз (алакийиз, шырдак, түш кийиз)',
  },
  {
    id: 'shyrdak-then-at-bashy',
    fromType: 'culture_item', fromId: 'shyrdak-craft', toType: 'culture_item', toId: 'shyrdak-at-bashy',
    relationKey: 'learn_next', reverse: false,
    source: { contentType: 'culture_item', contentId: 'shyrdak-at-bashy', field: 'origin' },
    evidence: 'Ат-Башы району шырдак өнөрүнүн мекени катары таанылат',
  },
  // Horse culture.
  {
    id: 'kok-boru-symbol-horse-culture',
    fromType: 'culture_item', fromId: 'horse-kok-boru', toType: 'culture_item', toId: 'horse-overview',
    relationKey: 'symbolic_connection', reverse: true,
    source: { contentType: 'culture_item', contentId: 'horse-kok-boru', field: 'cultural_meaning' },
    evidence: 'Ат менен адамдын биримдиги эң ачык көрүнгөн оюн.',
  },
  {
    id: 'kok-boru-uses-eer',
    fromType: 'culture_item', fromId: 'horse-kok-boru', toType: 'culture_item', toId: 'horse-eer',
    relationKey: 'uses', reverse: true,
    source: { contentType: 'culture_item', contentId: 'horse-kok-boru', field: 'objects_used' },
    evidence: 'ат, ээр-токум, тай казан',
  },
  {
    id: 'kyz-kuumai-related-horse-culture',
    fromType: 'culture_item', fromId: 'horse-kyz-kuumai', toType: 'culture_item', toId: 'horse-overview',
    relationKey: 'related_tradition', reverse: true,
    source: { contentType: 'culture_item', contentId: 'horse-kyz-kuumai', field: 'origin' },
    evidence: 'Жаштардын таанышуу жана сынашуу салтынан келип чыккан ат оюну.',
  },
  {
    id: 'eer-uses-oymo',
    fromType: 'culture_item', fromId: 'horse-eer', toType: 'culture_item', toId: 'oymo-overview',
    relationKey: 'uses', reverse: true,
    source: { contentType: 'culture_item', contentId: 'horse-eer', field: 'traditional_method' },
    evidence: 'оюм-чийим түшүрүлүп, күмүш же жез менен кооздолот',
  },
];

/** Field -> existing article section label. */
export const SOURCE_FIELD_LABEL: Record<string, string> = {
  origin: 'culture.item.originLabel',
  history: 'culture.item.historyLabel',
  cultural_meaning: 'culture.item.culturalMeaningLabel',
  traditional_method: 'culture.item.traditionalMethodLabel',
  objects_used: 'culture.item.objectsUsedLabel',
};

export const MAX_CONNECTIONS_SHOWN = 5;
export const MIN_CONNECTIONS_SHOWN = 2;

export function connectionRoute(id: string): string {
  return `/culture/connections/${id}`;
}

export function contentRoute(type: ConnectionContentType, id: string): string {
  return type === 'culture_item' ? `/culture/item/${id}` : `/culture/material/${id}`;
}
