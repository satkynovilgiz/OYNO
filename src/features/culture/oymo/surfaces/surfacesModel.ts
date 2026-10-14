import { copyDesign, type RemixDesign } from '../remix/remixModel';

/**
 * Presentation previews - VISUAL MOCKUPS of a design on a surface. They are
 * not manufacturing simulations: nothing here says how a print, a felt
 * piece or a carving would really come out. The surface is drawn OVER an
 * unchanged rendering of the design (same geometry, same colours), and the
 * design itself is a copy that this feature never writes back.
 */
export type SurfaceId = 'plain' | 'paper' | 'fabric';
export const SURFACES: SurfaceId[] = ['plain', 'paper', 'fabric'];

/**
 * Provenance of every texture. All of them are ORIGINAL vector patterns
 * drawn in code by OYNO (SurfaceTexture.tsx) - no photographs, scans or
 * third-party files, so there is nothing to license. Recorded here and in
 * docs/PRESENTATION_PREVIEWS.md; a test keeps the two in step.
 */
export type TextureProvenance = { id: Exclude<SurfaceId, 'plain'>; source: 'original-code'; author: string; license: string; file: string; created: string; description: string };
export const TEXTURE_PROVENANCE: TextureProvenance[] = [
  {
    id: 'paper',
    source: 'original-code',
    author: 'OYNO project',
    license: 'Original work, part of the OYNO source code',
    file: 'src/features/culture/oymo/surfaces/SurfaceTexture.tsx',
    created: '2026-10-14',
    description: 'Deterministic speckle tile (fixed seed) and a soft edge shade, drawn as SVG.',
  },
  {
    id: 'fabric',
    source: 'original-code',
    author: 'OYNO project',
    license: 'Original work, part of the OYNO source code',
    file: 'src/features/culture/oymo/surfaces/SurfaceTexture.tsx',
    created: '2026-10-14',
    description: 'Plain-weave thread tile (alternating warp and weft lines) and a soft light gradient, drawn as SVG.',
  },
];

/** Does this surface change how colours look (so the screen explains it)? */
export const affectsPerceivedColor = (surface: SurfaceId) => surface !== 'plain';

/** Which surface goes into the exported image: the chosen one, or plain when the person opts out. */
export const exportSurface = (surface: SurfaceId, includeSurface: boolean): SurfaceId => (includeSurface ? surface : 'plain');

/** Deterministic speckles for the paper tile (a fixed-seed generator: the same picture every time, and in every export). */
export function paperSpeckles(tile: number, count: number, seed = 20261014): { x: number; y: number; r: number; dark: boolean }[] {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  return Array.from({ length: count }, () => ({ x: Math.round(next() * tile * 10) / 10, y: Math.round(next() * tile * 10) / 10, r: Math.round((0.4 + next() * 0.9) * 10) / 10, dark: next() > 0.45 }));
}

/* ---------- the design handed over from the Creator (memory, per owner) ---------- */
let source: { owner: string; design: RemixDesign } | null = null;
export function setPreviewSource(owner: string, design: RemixDesign): void {
  source = { owner, design: copyDesign(design) };
}
/** A COPY each time - switching surfaces can never change the design it came from. */
export function previewSource(owner: string): RemixDesign | null {
  return source && source.owner === owner ? copyDesign(source.design) : null;
}
