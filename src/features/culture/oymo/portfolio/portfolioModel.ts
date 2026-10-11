import type { MotifLayer } from '@/services/culture/oymoEditor';
import type { SymmetryMode } from '@/services/culture/symmetry';

/**
 * Oymo Design Portfolio - a presentation of the owner's SAVED Oymo
 * designs. One consistent behaviour: LIVE references. A portfolio stores
 * only creation ids (+ the owner's captions); designs are always drawn
 * from the saved creation as it is now. A design that was deleted or is
 * unavailable stays in place as a labelled placeholder (remove it, or
 * keep it until it is available again) - never silently dropped.
 *
 * Captions are the owner's own words. Designs are the user's creations:
 * no traditional meaning is given to them.
 */
export const MAX_ENTRIES = 6;
export const TITLE_MAX = 60;
export const INTRO_MAX = 280;
export const CAPTION_MAX = 140;
export const MAX_PORTFOLIOS = 20;

export type PortfolioEntry = { creationId: string; caption: string };
export type Portfolio = { id: string; title: string; intro: string; entries: PortfolioEntry[]; createdAt: string; updatedAt: string };

/** The saved creation fields the portfolio reads (a subset of OymoCreationRow). */
export type DesignRow = { id: string; name: string; layers: MotifLayer[]; background_color: string; symmetry_mode: SymmetryMode };

const ID = /^[A-Za-z0-9_-]{1,80}$/;
const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/[<>{}]/g, '').slice(0, max) : '');
const touch = (portfolio: Portfolio, patch: Partial<Portfolio>): Portfolio => ({ ...portfolio, ...patch, updatedAt: new Date().toISOString() });

export function newPortfolio(title: string, now = new Date()): Portfolio {
  return { id: `pf${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 7)}`, title: clean(title, TITLE_MAX).trim(), intro: '', entries: [], createdAt: now.toISOString(), updatedAt: now.toISOString() };
}
export const rename = (portfolio: Portfolio, title: string) => touch(portfolio, { title: clean(title, TITLE_MAX) });
export const setIntro = (portfolio: Portfolio, intro: string) => touch(portfolio, { intro: clean(intro, INTRO_MAX) });

/** Adds a saved design (by id) at the end, or removes it (with its caption). */
export function toggleEntry(portfolio: Portfolio, creationId: string): Portfolio {
  if (!ID.test(creationId)) return portfolio;
  if (portfolio.entries.some((entry) => entry.creationId === creationId)) return touch(portfolio, { entries: portfolio.entries.filter((entry) => entry.creationId !== creationId) });
  if (portfolio.entries.length >= MAX_ENTRIES) return portfolio;
  return touch(portfolio, { entries: [...portfolio.entries, { creationId, caption: '' }] });
}
/** Reorders the portfolio's references only - the saved designs are never touched. */
export function moveEntry(portfolio: Portfolio, index: number, delta: -1 | 1): Portfolio {
  const target = index + delta;
  if (index < 0 || target < 0 || target >= portfolio.entries.length) return portfolio;
  const entries = [...portfolio.entries];
  [entries[index], entries[target]] = [entries[target], entries[index]];
  return touch(portfolio, { entries });
}
export function setCaption(portfolio: Portfolio, creationId: string, caption: string): Portfolio {
  if (!portfolio.entries.some((entry) => entry.creationId === creationId)) return portfolio;
  return touch(portfolio, { entries: portfolio.entries.map((entry) => (entry.creationId === creationId ? { ...entry, caption: clean(caption, CAPTION_MAX) } : entry)) });
}

export type ResolvedEntry = { creationId: string; caption: string; position: number } & ({ status: 'ok'; design: DesignRow } | { status: 'missing' } | { status: 'loading' });
/** Each entry against the CURRENT saved designs (null = not loaded yet). Missing ones stay, labelled. */
export function resolveEntries(portfolio: Portfolio, designs: readonly DesignRow[] | null): ResolvedEntry[] {
  return portfolio.entries.map((entry, position) => {
    if (!designs) return { ...entry, position, status: 'loading' as const };
    const design = designs.find((row) => row.id === entry.creationId);
    return design ? { ...entry, position, status: 'ok' as const, design } : { ...entry, position, status: 'missing' as const };
  });
}

/**
 * The ONLY fields an exported portfolio card carries - what the preview
 * shows: the portfolio title, the design's own name and drawing, and the
 * caption when the owner includes it. Never the recipe, the account, the
 * creation id, other designs or the introduction.
 */
export type PortfolioCard = { portfolioTitle: string; designName: string; caption: string | null; artwork: { layers: MotifLayer[]; backgroundColor: string; symmetry: SymmetryMode } };
export function portfolioCardContent(portfolio: Portfolio, entry: Extract<ResolvedEntry, { status: 'ok' }>, includeCaption: boolean): PortfolioCard {
  return {
    portfolioTitle: portfolio.title.trim(),
    designName: entry.design.name.trim(),
    caption: includeCaption && entry.caption.trim() ? entry.caption.trim() : null,
    artwork: { layers: entry.design.layers.map((layer) => ({ ...layer, point: { ...layer.point } })), backgroundColor: entry.design.background_color, symmetry: entry.design.symmetry_mode },
  };
}

export function normalizePortfolio(raw: unknown): Portfolio | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Partial<Portfolio>;
  if (typeof value.id !== 'string' || !ID.test(value.id)) return null;
  const seen = new Set<string>();
  const entries = (Array.isArray(value.entries) ? value.entries : []).flatMap((entry): PortfolioEntry[] => {
    if (!entry || typeof entry.creationId !== 'string' || !ID.test(entry.creationId) || seen.has(entry.creationId)) return [];
    seen.add(entry.creationId);
    return [{ creationId: entry.creationId, caption: clean(entry.caption, CAPTION_MAX) }];
  });
  return { id: value.id, title: clean(value.title, TITLE_MAX), intro: clean(value.intro, INTRO_MAX), entries: entries.slice(0, MAX_ENTRIES), createdAt: typeof value.createdAt === 'string' ? value.createdAt : '', updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '' };
}
