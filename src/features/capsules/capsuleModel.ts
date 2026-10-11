import type { ConnectionContentType } from '@/features/culture/connections/connectionsData';
import { shiftDate } from '@/features/journal/journalDisplay';
import { MAX_OYMO_LAYERS, type MotifLayer } from '@/services/culture/oymoEditor';
import type { SymmetryMode } from '@/services/culture/symmetry';

/**
 * Culture Time Capsule - a message to your future self, with up to three
 * culture article references and one Oymo design snapshot, "sealed" until
 * an opening date. Sealing is an APP EXPERIENCE: the message is hidden on
 * screen until the date, not encrypted - it is stored on this device like
 * other app data. Nothing is scheduled; the app checks the date when the
 * capsule is looked at.
 *
 * Opening rule (local calendar): a capsule opens when TODAY'S LOCAL DATE
 * (YYYY-MM-DD from the device clock and time zone, `localDateKey`) is the
 * same as or after its opening date. So it opens at local midnight at the
 * start of that day; a time-zone change or a manual clock change moves
 * that moment with the device. The opening date must be at least tomorrow
 * when sealing, and at most 50 years ahead.
 */
export const TITLE_MAX = 80;
export const MESSAGE_MAX = 2000;
export const REFLECTION_MAX = 2000;
export const MAX_ARTICLES = 3;
export const MAX_CAPSULES = 50;
export const MAX_YEARS = 50;

export type CapsuleStatus = 'draft' | 'sealed' | 'opened';
export type ArticleRef = { type: ConnectionContentType; id: string; titleSnapshot: string };
export type DesignSnapshot = { layers: MotifLayer[]; backgroundColor: string; symmetry: SymmetryMode; takenAt: string };
export type Capsule = {
  id: string;
  status: CapsuleStatus;
  title: string;
  message: string;
  articles: ArticleRef[];
  design: DesignSnapshot | null;
  /** YYYY-MM-DD (local calendar). */
  openOn: string | null;
  createdAt: string;
  sealedAt: string | null;
  openedAt: string | null;
  openedEarly: boolean;
  /** Written after opening; the original message is never changed. */
  reflection: string;
  reflectedAt: string | null;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;
const MODES: readonly string[] = ['none', 'mirror', 'fourWay'];
const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/[<>{}]/g, '').slice(0, max) : '');
const isDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

export function newCapsule(now = new Date()): Capsule {
  return { id: `tc${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 7)}`, status: 'draft', title: '', message: '', articles: [], design: null, openOn: null, createdAt: now.toISOString(), sealedAt: null, openedAt: null, openedEarly: false, reflection: '', reflectedAt: null };
}

/** A deep, independent copy of an Oymo design (later edits to the design can't reach it). */
export function snapshotDesign(design: { layers: readonly MotifLayer[]; backgroundColor: string; symmetry: SymmetryMode }, now = new Date()): DesignSnapshot {
  return { layers: design.layers.map((layer) => ({ ...layer, point: { ...layer.point } })), backgroundColor: design.backgroundColor, symmetry: design.symmetry, takenAt: now.toISOString() };
}

/* ---------- dates ---------- */

export const earliestOpenOn = (today: string) => shiftDate(today, 1);
export const latestOpenOn = (today: string) => {
  const [y, m, d] = today.split('-').map(Number);
  return shiftDate(`${y + MAX_YEARS}-${String(m).padStart(2, '0')}-${String(Math.min(d, 28)).padStart(2, '0')}`, 0);
};
/** Keeps a chosen date inside [tomorrow, +50 years]. */
export function clampOpenOn(date: string, today: string): string {
  if (date < earliestOpenOn(today)) return earliestOpenOn(today);
  if (date > latestOpenOn(today)) return latestOpenOn(today);
  return date;
}
/** Moves a date by days / months / years (a month or year step keeps the day, or the month's last day). */
export function stepDate(date: string, unit: 'day' | 'month' | 'year', delta: number): string {
  if (unit === 'day') return shiftDate(date, delta);
  const [y, m, d] = date.split('-').map(Number);
  const months = unit === 'month' ? delta : delta * 12;
  const first = new Date(y, m - 1 + months, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const day = Math.min(d, last);
  return `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
/** Today's local date on or after the opening date. */
export const isDue = (capsule: Pick<Capsule, 'status' | 'openOn'>, today: string) => capsule.status === 'sealed' && !!capsule.openOn && today >= capsule.openOn;
/** Whole local days until the opening date (0 when due). */
export function daysUntil(openOn: string, today: string): number {
  const toUtc = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.max(0, Math.round((toUtc(openOn) - toUtc(today)) / 86_400_000));
}

/* ---------- lifecycle ---------- */

export type SealProblem = 'noTitle' | 'noMessage' | 'noDate' | 'dateTooSoon' | 'dateTooLate' | 'notDraft';
export function sealProblems(capsule: Capsule, today: string): SealProblem[] {
  const problems: SealProblem[] = [];
  if (capsule.status !== 'draft') problems.push('notDraft');
  if (!capsule.title.trim()) problems.push('noTitle');
  if (!capsule.message.trim()) problems.push('noMessage');
  if (!capsule.openOn) problems.push('noDate');
  else if (capsule.openOn < earliestOpenOn(today)) problems.push('dateTooSoon');
  else if (capsule.openOn > latestOpenOn(today)) problems.push('dateTooLate');
  return problems;
}

/** Draft edits only; a sealed or opened capsule is unchanged. */
export function editDraft(capsule: Capsule, patch: Partial<Pick<Capsule, 'title' | 'message' | 'openOn' | 'design'>> & { articles?: ArticleRef[] }): Capsule {
  if (capsule.status !== 'draft') return capsule;
  return {
    ...capsule,
    ...(patch.title !== undefined ? { title: clean(patch.title, TITLE_MAX) } : {}),
    ...(patch.message !== undefined ? { message: clean(patch.message, MESSAGE_MAX) } : {}),
    ...(patch.openOn !== undefined ? { openOn: patch.openOn && isDate(patch.openOn) ? patch.openOn : null } : {}),
    ...(patch.design !== undefined ? { design: patch.design } : {}),
    ...(patch.articles !== undefined ? { articles: dedupeArticles(patch.articles) } : {}),
  };
}
const dedupeArticles = (articles: readonly ArticleRef[]) => {
  const seen = new Set<string>();
  return articles.filter((entry) => !seen.has(`${entry.type}:${entry.id}`) && seen.add(`${entry.type}:${entry.id}`)).slice(0, MAX_ARTICLES).map((entry) => ({ type: entry.type, id: entry.id, titleSnapshot: clean(entry.titleSnapshot, 120) }));
};
export function addArticle(capsule: Capsule, article: ArticleRef): Capsule {
  if (capsule.articles.length >= MAX_ARTICLES) return capsule;
  return editDraft(capsule, { articles: [...capsule.articles, article] });
}
export const removeArticle = (capsule: Capsule, type: string, id: string) => editDraft(capsule, { articles: capsule.articles.filter((entry) => !(entry.type === type && entry.id === id)) });

export function seal(capsule: Capsule, today: string, now = new Date()): Capsule {
  if (sealProblems(capsule, today).length) return capsule;
  return { ...capsule, status: 'sealed', title: capsule.title.trim(), sealedAt: now.toISOString() };
}

/**
 * Opens a sealed capsule. Before its date this only happens with
 * `early: true` - the explicit, confirmed "Open early" - and is recorded.
 */
export function openCapsule(capsule: Capsule, today: string, options: { early?: boolean } = {}, now = new Date()): Capsule {
  if (capsule.status !== 'sealed') return capsule;
  const due = isDue(capsule, today);
  if (!due && !options.early) return capsule;
  return { ...capsule, status: 'opened', openedAt: now.toISOString(), openedEarly: !due };
}

/** The later reflection; the original message, articles and design stay as sealed. */
export function reflect(capsule: Capsule, text: string, now = new Date()): Capsule {
  if (capsule.status !== 'opened') return capsule;
  return { ...capsule, reflection: clean(text, REFLECTION_MAX), reflectedAt: now.toISOString() };
}

/* ---------- storage shape ---------- */

function normalizeDesign(raw: unknown): DesignSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<DesignSnapshot>;
  if (!Array.isArray(value.layers) || typeof value.backgroundColor !== 'string' || !MODES.includes(value.symmetry as string)) return null;
  const layers = value.layers.flatMap((layer): MotifLayer[] => {
    if (!layer || typeof layer !== 'object' || typeof layer.motifId !== 'string' || typeof layer.color !== 'string' || !layer.point || typeof layer.point.x !== 'number' || typeof layer.point.y !== 'number') return [];
    return [{ id: typeof layer.id === 'string' ? layer.id : 'layer', motifId: layer.motifId, color: layer.color, point: { x: layer.point.x, y: layer.point.y }, rotation: Number(layer.rotation) || 0, scale: Number(layer.scale) || 1, visible: layer.visible !== false }];
  });
  return { layers: layers.slice(0, MAX_OYMO_LAYERS), backgroundColor: value.backgroundColor, symmetry: value.symmetry as SymmetryMode, takenAt: typeof value.takenAt === 'string' ? value.takenAt : '' };
}

export function normalizeCapsule(raw: unknown): Capsule | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Partial<Capsule>;
  if (typeof value.id !== 'string' || !SAFE_ID.test(value.id)) return null;
  const status: CapsuleStatus = value.status === 'sealed' || value.status === 'opened' ? value.status : 'draft';
  const openOn = isDate(value.openOn) ? value.openOn : null;
  // A sealed capsule without a valid date can't be judged: kept, and openable (never lost).
  return {
    id: value.id,
    status,
    title: clean(value.title, TITLE_MAX),
    message: clean(value.message, MESSAGE_MAX),
    articles: Array.isArray(value.articles) ? dedupeArticles(value.articles.filter((entry): entry is ArticleRef => !!entry && (entry.type === 'culture_item' || entry.type === 'culture_material') && typeof entry.id === 'string' && SAFE_ID.test(entry.id))) : [],
    design: normalizeDesign(value.design),
    openOn,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
    sealedAt: typeof value.sealedAt === 'string' ? value.sealedAt : null,
    openedAt: typeof value.openedAt === 'string' ? value.openedAt : null,
    openedEarly: value.openedEarly === true,
    reflection: clean(value.reflection, REFLECTION_MAX),
    reflectedAt: typeof value.reflectedAt === 'string' ? value.reflectedAt : null,
  };
}

/* ---------- a design handed over from the Creator (memory, owner-bound) ---------- */

let pendingDesign: { owner: string; design: DesignSnapshot } | null = null;
export function offerDesign(owner: string, design: DesignSnapshot): void {
  pendingDesign = { owner, design: JSON.parse(JSON.stringify(design)) as DesignSnapshot };
}
/** Taken once, by the same owner only. */
export function takeOfferedDesign(owner: string): DesignSnapshot | null {
  const taken = pendingDesign && pendingDesign.owner === owner ? pendingDesign.design : null;
  pendingDesign = null;
  return taken;
}
