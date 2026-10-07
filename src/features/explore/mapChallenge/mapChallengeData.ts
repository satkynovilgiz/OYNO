import { ILLUSTRATED_MAP_COORDINATES, REGION_MAP_ANCHORS, type IllustratedMapCoordinate } from '../map/illustratedMap';

/**
 * Map Challenge content - from existing VERIFIED data only:
 *  - positions: the illustrated map's own anchors (REGION_MAP_ANCHORS for
 *    regions - a marker stands for the whole region, no border is drawn or
 *    implied - and ILLUSTRATED_MAP_COORDINATES for places);
 *  - names: each explore_regions row's name_kg / name_ru / name_en;
 *  - explanations: the row's facts (KG source, supabase/migrations) and
 *    their reviewed RU/EN translations (content/translations/
 *    explore_facts_batch1.json), restricted to destinations whose facts
 *    hold no claim awaiting verification (docs/CONTENT_AUDIT.md section 5).
 * Talas, Ysyk-Kol and Batken are markers (possible answers) but are never
 * asked about: their facts aren't verified yet.
 */
export type MapLayer = 'regions' | 'places';
export type MapMarker = { id: string; layer: MapLayer; at: IllustratedMapCoordinate };

export const REGION_MARKERS: MapMarker[] = Object.entries(REGION_MAP_ANCHORS).map(([id, at]) => ({ id, layer: 'regions', at }));
const PLACE_IDS = ['son-kol', 'suusamyr', 'alay', 'sary-chelek', 'arslanbob', 'ala-too'];
export const PLACE_MARKERS: MapMarker[] = PLACE_IDS.map((id) => ({ id, layer: 'places', at: ILLUSTRATED_MAP_COORDINATES[id] }));

export const markersFor = (layer: MapLayer) => (layer === 'regions' ? REGION_MARKERS : PLACE_MARKERS);

export type MapQuestion = {
  id: string;
  layer: MapLayer;
  /** The explore_regions row asked about (its name, its page, its facts). */
  targetId: string;
  /** Which facts (explore_regions.facts index) the explanation restates. */
  factIndexes: number[];
};

export const MAP_QUESTIONS: MapQuestion[] = [
  { id: 'chuy', layer: 'regions', targetId: 'chuy', factIndexes: [0, 1] },
  { id: 'naryn', layer: 'regions', targetId: 'naryn', factIndexes: [0, 1] },
  { id: 'osh', layer: 'regions', targetId: 'osh', factIndexes: [0, 1] },
  { id: 'jalal-abad', layer: 'regions', targetId: 'jalal-abad', factIndexes: [0, 1] },
  { id: 'suusamyr', layer: 'places', targetId: 'suusamyr', factIndexes: [0, 1] },
  { id: 'arslanbob', layer: 'places', targetId: 'arslanbob', factIndexes: [0, 1] },
];

/** The region page (Region Hub) or the place page. */
export function targetRoute(question: MapQuestion): string {
  return question.layer === 'regions' ? `/explore/region/${question.targetId}` : `/explore/${question.targetId}`;
}

/**
 * Painted lettering that would give answers away ("Talas", "Bishkek",
 * "Jalal-Abad", "Naryn", "Osh", "Karakol", "Issyk-Kul"), as boxes on the
 * 1448x1086 source in percent. Covered while a question is open; shown
 * again with the answer. (Country names stay - they answer nothing.)
 */
const SOURCE_W = 1448;
const SOURCE_H = 1086;
const box = (x: number, y: number, w: number, h: number) => ({ left: (x / SOURCE_W) * 100, top: (y / SOURCE_H) * 100, width: (w / SOURCE_W) * 100, height: (h / SOURCE_H) * 100 });
export const LABEL_MASKS = [box(466, 306, 64, 32), box(696, 294, 106, 36), box(424, 492, 118, 34), box(851, 518, 76, 36), box(506, 618, 54, 32), box(1241, 346, 80, 32), box(1028, 364, 134, 36)];
