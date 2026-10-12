import { colors } from '@/theme';

import { applyRemix, copyDesign, designColors, NO_CHANGE, PALETTES, REMIX_BACKGROUNDS, type PaletteId, type RemixDesign } from '../remix/remixModel';

/**
 * Color Lab - pure, deterministic colour maths for an Oymo design (works
 * offline; nothing is sent anywhere).
 *
 * CONTRAST: WCAG 2.x relative luminance and contrast ratio
 * (https://www.w3.org/TR/WCAG22/#dfn-relative-luminance): sRGB channel
 * c/255 -> c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)^2.4;
 * L = 0.2126 R + 0.7152 G + 0.0722 B; ratio = (L1+0.05)/(L2+0.05).
 * A pair under 3:1 (WCAG 1.4.11 non-text contrast) is flagged as possibly
 * hard to tell apart. A ratio only measures lightness difference - it does
 * NOT certify that artwork is accessible.
 *
 * COLOUR-VISION SIMULATION: Machado, Oliveira & Fernandes (2009), "A
 * Physiologically-based Model for Simulation of Color Vision Deficiency",
 * severity 1.0 matrices, applied to LINEAR RGB. Approximations only.
 *
 * Changes are only ever the user's choice: an alternative is the ORIGINAL
 * design with chosen colour replacements and/or background (copies; the
 * original and its recipe are never touched).
 */
export type Rgb = [number, number, number];

export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export const toHex = ([r, g, b]: Rgb) => `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

const toLinear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (l: number) => {
  const v = Math.min(1, Math.max(0, l));
  return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
};

export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1..21, rounded to 2 decimals. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}
export const HARD_TO_TELL = 3;

/** Grayscale by relative luminance (the same quantity the contrast uses). */
export function grayscale(hex: string): string {
  const v = fromLinear(relativeLuminance(hex));
  return toHex([v, v, v]);
}

export type Vision = 'normal' | 'grayscale' | 'protanopia' | 'deuteranopia' | 'tritanopia';
export const VISIONS: Vision[] = ['normal', 'grayscale', 'protanopia', 'deuteranopia', 'tritanopia'];
/** Machado et al. 2009, severity 1.0 (linear RGB). */
export const MACHADO: Record<'protanopia' | 'deuteranopia' | 'tritanopia', number[][]> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

export function simulate(hex: string, vision: Vision): string {
  if (vision === 'normal') return parseHex(hex) ? toHex(parseHex(hex)!) : hex;
  if (vision === 'grayscale') return grayscale(hex);
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const lin = rgb.map(toLinear);
  const m = MACHADO[vision];
  return toHex(m.map((row) => fromLinear(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2])) as Rgb);
}

/** The design with every colour shown as `vision` would approximate it (same geometry). */
export function simulateDesign(design: RemixDesign, vision: Vision): RemixDesign {
  const copy = copyDesign(design);
  return { ...copy, backgroundColor: simulate(copy.backgroundColor, vision), layers: copy.layers.map((layer) => ({ ...layer, color: simulate(layer.color, vision) })) };
}

/* ---------- naming colours in text ---------- */

export type ColorName = { lightness: 'light' | 'medium' | 'dark'; hue: 'red' | 'orange' | 'brown' | 'yellow' | 'green' | 'teal' | 'blue' | 'purple' | 'pink' | 'gray' | 'black' | 'white'; hex: string };
/** A deterministic text name from HSL (no lookup table), always with the hex code. */
export function colorName(hex: string): ColorName {
  const rgb = parseHex(hex) ?? [0, 0, 0];
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  if (h < 0) h += 360;
  const lightness = l < 0.35 ? 'dark' : l > 0.7 ? 'light' : 'medium';
  const out = (hue: ColorName['hue']): ColorName => ({ lightness, hue, hex: toHex(rgb) });
  if (s < 0.12) return l < 0.12 ? { ...out('black'), lightness: 'dark' } : l > 0.92 ? { ...out('white'), lightness: 'light' } : out('gray');
  if (h < 15 || h >= 345) return out('red');
  if (h < 45) return l < 0.45 ? out('brown') : out('orange');
  if (h < 70) return l < 0.35 ? out('brown') : out('yellow');
  if (h < 170) return out('green');
  if (h < 200) return out('teal');
  if (h < 260) return out('blue');
  if (h < 300) return out('purple');
  return out('pink');
}

/* ---------- inspecting a design ---------- */

export type Pair = { a: string; b: string; ratio: number; withBackground: boolean };
/** Every motif-colour pair and every motif colour vs the background, weakest first. */
export function inspect(design: RemixDesign, vision: Vision = 'normal') {
  const shown = simulateDesign(design, vision);
  const original = designColors(design.layers);
  const simulated = designColors(design.layers).map((c) => simulate(c, vision));
  const pairs: Pair[] = [];
  original.forEach((color, i) => {
    pairs.push({ a: color, b: design.backgroundColor, ratio: contrastRatio(simulated[i], shown.backgroundColor), withBackground: true });
    for (let j = i + 1; j < original.length; j += 1) pairs.push({ a: color, b: original[j], ratio: contrastRatio(simulated[i], simulated[j]), withBackground: false });
  });
  pairs.sort((x, y) => x.ratio - y.ratio || x.a.localeCompare(y.a));
  return { colors: original, background: design.backgroundColor, pairs, hard: pairs.filter((pair) => pair.ratio < HARD_TO_TELL) };
}
export const minRatio = (design: RemixDesign, vision: Vision = 'normal') => inspect(design, vision).pairs[0]?.ratio ?? 21;

/* ---------- user-chosen alternatives ---------- */

/** Colours the user can pick from: the Creator's swatches and the remix palettes (existing colours only). */
export const CHOOSABLE: string[] = [...new Set([colors.primary, colors.tiles.food, colors.accentBrown, colors.accentGold, colors.textMuted, colors.accentBrownDark, ...PALETTES.flatMap((p) => p.colors), ...REMIX_BACKGROUNDS].map((c) => toHex(parseHex(c) ?? [0, 0, 0])))];

export type Alternative = { replacements: Record<string, string>; background: string | null };
export const NO_ALTERNATIVE: Alternative = { replacements: {}, background: null };

/** Original + the user's replacements/background - a fresh copy with the same geometry. */
export function applyAlternative(design: RemixDesign, alternative: Alternative): RemixDesign {
  const copy = applyRemix(design, { ...NO_CHANGE, background: alternative.background });
  const map = new Map(Object.entries(alternative.replacements).map(([from, to]) => [from.toLowerCase(), to]));
  return { ...copy, layers: copy.layers.map((layer) => ({ ...layer, color: map.get(layer.color.toLowerCase()) ?? layer.color })) };
}

export const isUnchanged = (alternative: Alternative) => alternative.background === null && Object.keys(alternative.replacements).length === 0;

/**
 * A SUGGESTION (shown, never applied by itself): among the remix palettes
 * x backgrounds, the mapping with the highest weakest-pair contrast,
 * if it beats the original. Ties -> listed order (deterministic).
 */
export function suggest(design: RemixDesign): { alternative: Alternative; palette: PaletteId; minRatio: number } | null {
  const original = designColors(design.layers);
  if (!original.length) return null;
  let best: { alternative: Alternative; palette: PaletteId; minRatio: number } | null = null;
  for (const palette of PALETTES) {
    for (const background of [null, ...REMIX_BACKGROUNDS]) {
      const replacements = Object.fromEntries(original.map((color, i) => [color, palette.colors[i % palette.colors.length]]));
      const alternative = { replacements, background };
      const ratio = minRatio(applyAlternative(design, alternative));
      if (!best || ratio > best.minRatio) best = { alternative, palette: palette.id, minRatio: ratio };
    }
  }
  return best && best.minRatio > minRatio(design) ? best : null;
}

/* ---------- the design handed over from the Creator (memory, per owner) ---------- */
let source: { owner: string; design: RemixDesign; name: string | null } | null = null;
export function setColorLabSource(owner: string, design: RemixDesign, name: string | null = null): void {
  source = { owner, design: copyDesign(design), name };
}
export function colorLabSource(owner: string): { design: RemixDesign; name: string | null } | null {
  if (!source || source.owner !== owner) return null;
  return { design: copyDesign(source.design), name: source.name };
}
