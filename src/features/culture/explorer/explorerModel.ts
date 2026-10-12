/**
 * Object Explorer - a reusable "tap a labelled point on an illustration"
 * model. Points have STABLE ids and NORMALISED coordinates (0..1 of the
 * image's width/height), so they stay on their spot at any size or zoom.
 * Every label/description comes from reviewed content with a source
 * (article id + section key); none is guessed.
 *
 * Status (2026-10): OYNO has NO boz uy illustration that is both reusable
 * and accurate enough to place points on (the bundled yurt artworks are
 * AI-generated, docs/CONTENT_AUDIT.md). So `EXPLORER_ILLUSTRATIONS` is
 * EMPTY and the only illustration is an INTERNAL labelled fixture: a
 * schematic drawn in code from the same constants as its points (so the
 * points can't drift from the drawing). See docs/OBJECT_EXPLORER.md for
 * the asset that's needed.
 */
export type ExplorerSource = { articleId: string; sectionKey: string };
export type ExplorerPoint = { id: string; x: number; y: number; nameKey: string; descriptionKey: string; source: ExplorerSource };
export type ExplorerIllustration = {
  id: string;
  fixture: boolean;
  /** Width / height of the artwork. */
  aspect: number;
  titleKey: string;
  /** What is drawn: an approved image asset, or the in-code schematic (fixture). */
  artwork: { kind: 'schematic-boz-uy' } | { kind: 'image'; asset: number };
  /** Who made the artwork and under what licence (required for a real image). */
  credit: string | null;
  license: string | null;
  points: ExplorerPoint[];
};

/** Real, reviewed illustrations. None yet. */
export const EXPLORER_ILLUSTRATIONS: ExplorerIllustration[] = [];

/* ---------- the internal schematic fixture ---------- */

/** Schematic geometry in a 100 x 75 box - the drawing AND the points are derived from these. */
export const SCHEMATIC = {
  width: 100,
  height: 75,
  tunduk: { cx: 50, cy: 12, r: 6 },
  kerege: { x: 12, y: 40, w: 76, h: 26 },
  door: { x: 42, y: 46, w: 16, h: 20 },
} as const;
const nx = (x: number) => Math.round((x / SCHEMATIC.width) * 1000) / 1000;
const ny = (y: number) => Math.round((y / SCHEMATIC.height) * 1000) / 1000;
const { tunduk, kerege, door } = SCHEMATIC;
/** The schematic's roof poles: from the tunduk's rim to the kerege's top edge. The uuk point sits on the first. */
export const SCHEMATIC_POLES = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ x1: tunduk.cx - tunduk.r + (i * 2 * tunduk.r) / 6, y1: tunduk.cy + 3, x2: kerege.x + 4 + (i * (kerege.w - 8)) / 6, y2: kerege.y }));
const SCHEMATIC_POLE = SCHEMATIC_POLES[0];

const overview = (step: string): Pick<ExplorerPoint, 'nameKey' | 'descriptionKey' | 'source'> => ({
  nameKey: `culture.bozUy.steps.${step}.name`,
  descriptionKey: `culture.bozUy.steps.${step}.description`,
  // The reviewed boz-uy-overview article lists these parts in its "objects used" section.
  source: { articleId: 'boz-uy-overview', sectionKey: 'objects_used' },
});

export const FIXTURE_ILLUSTRATION: ExplorerIllustration = {
  id: 'fixture-boz-uy-schematic',
  fixture: true,
  aspect: SCHEMATIC.width / SCHEMATIC.height,
  titleKey: 'objectExplorer.fixtureTitle',
  artwork: { kind: 'schematic-boz-uy' },
  credit: null,
  license: null,
  points: [
    { id: 'tunduk', x: nx(tunduk.cx), y: ny(tunduk.cy), ...overview('tunduk') },
    { id: 'uuk', x: nx((SCHEMATIC_POLE.x1 + SCHEMATIC_POLE.x2) / 2), y: ny((SCHEMATIC_POLE.y1 + SCHEMATIC_POLE.y2) / 2), ...overview('uuk') },
    { id: 'kerege', x: nx(kerege.x + 12), y: ny(kerege.y + kerege.h / 2), ...overview('kerege') },
    { id: 'bosogo', x: nx(door.x + door.w / 2), y: ny(door.y + door.h / 2), ...overview('bosogo') },
  ],
};

/** Problems that keep an illustration from being shown publicly. */
export function validateIllustration(illustration: ExplorerIllustration, articleExists?: (id: string) => boolean): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  if (!(illustration.aspect > 0)) errors.push('aspect must be positive');
  if (!illustration.fixture && (!illustration.credit || !illustration.license)) errors.push('a real illustration needs a credit and a licence');
  for (const point of illustration.points) {
    if (!/^[a-z0-9-]+$/.test(point.id)) errors.push(`point id "${point.id}" is not stable (lowercase, digits, dashes)`);
    if (ids.has(point.id)) errors.push(`duplicate point id "${point.id}"`);
    ids.add(point.id);
    if (!(point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1)) errors.push(`point "${point.id}" is outside the image`);
    if (!point.source.articleId || !point.source.sectionKey) errors.push(`point "${point.id}" has no source`);
    if (articleExists && !articleExists(point.source.articleId)) errors.push(`point "${point.id}": source article "${point.source.articleId}" is unavailable`);
  }
  if (illustration.fixture) errors.push('fixture - internal only');
  return errors;
}

/** A normalised point at the image's rendered size and zoom (the image's own top-left is 0,0). */
export function toScreen(point: Pick<ExplorerPoint, 'x' | 'y'>, width: number, zoom: number, aspect: number): { left: number; top: number } {
  const w = width * zoom;
  return { left: point.x * w, top: point.y * (w / aspect) };
}

export const ZOOMS = [1, 1.5, 2] as const;
export type Zoom = (typeof ZOOMS)[number];
export const nextZoom = (zoom: Zoom): Zoom => ZOOMS[Math.min(ZOOMS.indexOf(zoom) + 1, ZOOMS.length - 1)];

/** The article route for a point's source, at its section. */
export const sourceRoute = (source: ExplorerSource) => `/culture/item/${encodeURIComponent(source.articleId)}?section=${encodeURIComponent(source.sectionKey)}`;

/* ---------- selection survives opening the source (memory) ---------- */
const selected = new Map<string, string>();
export const keepSelection = (illustrationId: string, pointId: string | null) => {
  if (pointId) selected.set(illustrationId, pointId);
  else selected.delete(illustrationId);
};
export function selectionFor(illustration: ExplorerIllustration): string | null {
  const id = selected.get(illustration.id) ?? null;
  return id && illustration.points.some((point) => point.id === id) ? id : null;
}
