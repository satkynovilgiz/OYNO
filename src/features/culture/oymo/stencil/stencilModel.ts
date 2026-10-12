import { getLayerRenderPoints, type MotifLayer, type SymmetryMode } from '@/services/culture/oymoEditor';

import { isEnclosed, MOTIF_GEOMETRY, MOTIF_VIEWBOX } from '../motifGeometry';

/**
 * Stencil Studio - an OUTLINE page of an Oymo design for colouring in or
 * tracing. Pure rules: one page description (`buildStencilPage`) feeds both
 * the on-screen preview and the PDF, so they share the same geometry.
 *
 * - Lines are the motifs' own primitives (motifGeometry.ts) at the Creator's
 *   own placement: position, rotation, scale and every symmetry copy
 *   (getLayerRenderPoints). Nothing is substituted; an unknown motif is
 *   left out and reported.
 * - This is NOT a cut-ready stencil: no cutting bridges are generated, so
 *   enclosed pieces would fall out if cut.
 * - The design is read, never changed; colours and background are not used.
 */

/** Same placement constants as the live canvas (OymoCanvas): 300 pt canvas, 36 pt shape box. */
export const CANVAS = 300;
const SHAPE_BOX = 36;
const SHAPE_SCALE = SHAPE_BOX / MOTIF_VIEWBOX;

/** A4 in PostScript points (72 per inch) - expo-print's page unit. */
export const A4 = { width: 595, height: 842 } as const;
/** Safe margin on every side (0.5 in = 12.7 mm): inside what common printers can print. */
export const SAFE_MARGIN = 36;
const LABEL_BAND = 64;
export const MM_PER_PT = 25.4 / 72;

export type Orientation = 'portrait' | 'landscape';
export type Thickness = 'thin' | 'medium' | 'thick';
export const THICKNESS_MM: Record<Thickness, number> = { thin: 0.5, medium: 1, thick: 1.6 };
export type LabelField = 'name' | 'motifs' | 'note';
export const LABEL_FIELDS: LabelField[] = ['name', 'motifs', 'note'];

export type StencilSettings = { orientation: Orientation; thickness: Thickness; guides: boolean; labels: LabelField[] };
export const DEFAULT_SETTINGS: StencilSettings = { orientation: 'portrait', thickness: 'medium', guides: false, labels: [] };

export type StencilDesign = { layers: readonly MotifLayer[]; symmetry: SymmetryMode; name: string | null };

export type Placement = { layerId: string; motifId: string; x: number; y: number; rotation: number; scale: number };

/** Every drawn copy, exactly as the Creator draws it (hidden layers are not drawn there either). */
export function placements(design: StencilDesign): Placement[] {
  return design.layers.filter((layer) => layer.visible).flatMap((layer) => getLayerRenderPoints(layer, design.symmetry, CANVAS).map((point) => ({ layerId: layer.id, motifId: layer.motifId, x: point.x, y: point.y, rotation: layer.rotation, scale: layer.scale })));
}

/** A motif-local point (0..24) on the canvas: centred on the copy, rotated, then scaled - like the canvas's transform. */
export function toCanvas(placement: Placement, x: number, y: number): { x: number; y: number } {
  const dx = (x - MOTIF_VIEWBOX / 2) * SHAPE_SCALE * placement.scale;
  const dy = (y - MOTIF_VIEWBOX / 2) * SHAPE_SCALE * placement.scale;
  const angle = (placement.rotation * Math.PI) / 180;
  return { x: placement.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: placement.y + dx * Math.sin(angle) + dy * Math.cos(angle) };
}

export type PageBox = { x: number; y: number; size: number };
export function pageSize(orientation: Orientation) {
  return orientation === 'portrait' ? { width: A4.width, height: A4.height } : { width: A4.height, height: A4.width };
}
/** The square design area: as large as fits inside the safe margins, above a band kept for labels. */
export function designBox(orientation: Orientation): PageBox {
  const page = pageSize(orientation);
  const size = Math.min(page.width - 2 * SAFE_MARGIN, page.height - 2 * SAFE_MARGIN - LABEL_BAND);
  return { x: (page.width - size) / 2, y: SAFE_MARGIN, size };
}
/** Printed size of the design area in mm at 100 % ("Actual size"). */
export const printedDesignMm = (orientation: Orientation) => Math.round(designBox(orientation).size * MM_PER_PT);

export type StencilElement =
  | { kind: 'path'; d: string; transform: string; strokeWidth: number; cap: 'round' | 'butt'; join: 'round' | 'miter' }
  | { kind: 'circle'; cx: number; cy: number; r: number; transform: string; strokeWidth: number; filled: boolean };
export type Guide = { x1: number; y1: number; x2: number; y2: number };
export type Limitation = { kind: 'unknownMotif' | 'openLines' | 'smallDetail'; motifIds: string[] };
export type StencilPage = {
  width: number;
  height: number;
  box: PageBox;
  /** Canvas -> page transform for the design group. */
  designTransform: string;
  elements: StencilElement[];
  guides: Guide[];
  labels: { field: LabelField; text: string }[];
  limitations: Limitation[];
  lineWidthPt: number;
};

export type LabelTexts = { motifName: (motifId: string) => string; note: string };

export function buildStencilPage(design: StencilDesign, settings: StencilSettings, texts: LabelTexts): StencilPage {
  const page = pageSize(settings.orientation);
  const box = designBox(settings.orientation);
  const k = box.size / CANVAS;
  const lineWidthPt = THICKNESS_MM[settings.thickness] / MM_PER_PT;
  const elements: StencilElement[] = [];
  const unknown = new Set<string>();
  const open = new Set<string>();
  const small = new Set<string>();

  for (const placement of placements(design)) {
    const geometry = MOTIF_GEOMETRY[placement.motifId];
    if (!geometry) {
      unknown.add(placement.motifId);
      continue;
    }
    const local = SHAPE_SCALE * placement.scale; // motif unit -> canvas unit
    const transform = `translate(${round(placement.x)} ${round(placement.y)}) rotate(${placement.rotation}) scale(${round(local)}) translate(${-MOTIF_VIEWBOX / 2} ${-MOTIF_VIEWBOX / 2})`;
    const strokeWidth = round(lineWidthPt / (k * local)); // the same printed thickness on every motif
    for (const primitive of geometry) {
      if (primitive.kind === 'path') {
        if (!isEnclosed(primitive)) open.add(placement.motifId);
        elements.push({ kind: 'path', d: primitive.d, transform, strokeWidth, cap: primitive.cap ?? 'butt', join: primitive.join ?? 'miter' });
      } else {
        // A filled dot is outlined as a ring - unless the ring would close up at this thickness: then it stays a solid dot.
        const tooSmall = !!primitive.filled && primitive.r <= strokeWidth;
        if (tooSmall) small.add(placement.motifId);
        elements.push({ kind: 'circle', cx: primitive.cx, cy: primitive.cy, r: primitive.r, transform, strokeWidth, filled: tooSmall });
      }
    }
  }

  const guides: Guide[] = [];
  if (settings.guides) {
    const c = CANVAS / 2;
    guides.push({ x1: c, y1: 0, x2: c, y2: CANVAS }); // centre line (the mirror axis)
    guides.push({ x1: 0, y1: c, x2: CANVAS, y2: c }); // second axis / centre mark
    guides.push({ x1: 0, y1: 0, x2: CANVAS, y2: 0 }, { x1: CANVAS, y1: 0, x2: CANVAS, y2: CANVAS }, { x1: CANVAS, y1: CANVAS, x2: 0, y2: CANVAS }, { x1: 0, y1: CANVAS, x2: 0, y2: 0 }); // design frame
  }

  // Only explicitly selected labels, in a fixed order.
  const labels: StencilPage['labels'] = [];
  for (const field of LABEL_FIELDS) {
    if (!settings.labels.includes(field)) continue;
    if (field === 'name' && design.name?.trim()) labels.push({ field, text: design.name.trim().slice(0, 60) });
    if (field === 'motifs') {
      const names = [...new Set(placements(design).map((p) => p.motifId))].filter((id) => MOTIF_GEOMETRY[id]).map(texts.motifName);
      if (names.length) labels.push({ field, text: names.join(', ') });
    }
    if (field === 'note') labels.push({ field, text: texts.note });
  }

  const limitations: Limitation[] = [];
  if (unknown.size) limitations.push({ kind: 'unknownMotif', motifIds: [...unknown] });
  if (small.size) limitations.push({ kind: 'smallDetail', motifIds: [...small] });
  if (open.size) limitations.push({ kind: 'openLines', motifIds: [...open] });

  return { ...page, box, designTransform: `translate(${round(box.x)} ${round(box.y)}) scale(${round(k)})`, elements, guides, labels, limitations, lineWidthPt: round(lineWidthPt) };
}

const round = (value: number) => Math.round(value * 10000) / 10000;

export const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Label baselines below the design area (same in preview and PDF). */
export function labelLines(page: StencilPage): { text: string; x: number; y: number; size: number }[] {
  return page.labels.map((label, index) => ({ text: label.text, x: page.width / 2, y: page.box.y + page.box.size + 22 + index * 16, size: label.field === 'name' ? 13 : 10 }));
}

/** The page as one SVG document - what the PDF prints. */
export function stencilSvg(page: StencilPage): string {
  const shapes = page.elements
    .map((element) =>
      element.kind === 'path'
        ? `<path d="${element.d}" transform="${element.transform}" fill="none" stroke="#000" stroke-width="${element.strokeWidth}" stroke-linecap="${element.cap}" stroke-linejoin="${element.join}"/>`
        : `<circle cx="${element.cx}" cy="${element.cy}" r="${element.r}" transform="${element.transform}" fill="${element.filled ? '#000' : 'none'}" stroke="#000" stroke-width="${element.strokeWidth}"/>`,
    )
    .join('');
  const guideWidth = round(0.6 / (page.box.size / CANVAS));
  const guides = page.guides.map((g) => `<line x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}" stroke="#888" stroke-width="${guideWidth}" stroke-dasharray="${guideWidth * 6} ${guideWidth * 6}"/>`).join('');
  const labels = labelLines(page)
    .map((line) => `<text x="${line.x}" y="${line.y}" font-family="Helvetica, Arial, sans-serif" font-size="${line.size}" text-anchor="middle" fill="#000">${escapeXml(line.text)}</text>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}pt" height="${page.height}pt" viewBox="0 0 ${page.width} ${page.height}"><rect width="${page.width}" height="${page.height}" fill="#fff"/><defs><clipPath id="design"><rect x="0" y="0" width="${CANVAS}" height="${CANVAS}"/></clipPath></defs><g transform="${page.designTransform}"><g clip-path="url(#design)">${guides}${shapes}</g></g>${labels}</svg>`;
}

/** One A4 page, no browser margins (the safe margin is inside the SVG). */
export function stencilHtml(page: StencilPage, orientation: Orientation): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>@page { size: A4 ${orientation}; margin: 0; } html, body { margin: 0; padding: 0; } svg { display: block; }</style></head><body>${stencilSvg(page)}</body></html>`;
}

export function stencilFileName(today: string): string {
  return `OYNO-Stencil-${today.slice(0, 10)}.pdf`;
}

/* ---------- the design handed over from the Creator (memory, per owner) ---------- */
let source: { owner: string; design: StencilDesign } | null = null;
/** A copy is taken: the Creator's design is never touched from here. */
export function setStencilSource(owner: string, design: StencilDesign): void {
  source = { owner, design: { layers: design.layers.map((layer) => ({ ...layer, point: { ...layer.point } })), symmetry: design.symmetry, name: design.name } };
}
export function stencilSource(owner: string): StencilDesign | null {
  return source && source.owner === owner ? source.design : null;
}
