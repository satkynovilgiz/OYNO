import type { Exhibition, ExhibitSlide } from './museumModel';
import { cardContent, STORY_MIN, storySlides, type StoryCardContent } from './storyModel';

/**
 * Mini Museum "Preview as a visitor": the readiness checklist (only
 * conditions the app can verify) and the story-card fit rule shared by
 * the preview and the export.
 */
export type PreviewStart = 'exhibition' | 'tour' | 'story';
export const PREVIEW_STARTS: PreviewStart[] = ['exhibition', 'tour', 'story'];

/** Where a checklist item sends the curator in editing. */
export type EditTarget = { kind: 'exhibit'; index: number } | { kind: 'exhibits' } | { kind: 'story'; index: number | null };

export type ReadinessItem =
  /** No exhibits at all - nothing to visit. */
  | { id: 'noExhibits'; severity: 'blocker'; target: EditTarget }
  /** The exhibit's content is no longer in OYNO; visitors see "no longer available". */
  | { id: 'unavailable'; severity: 'warning'; key: string; index: number; target: EditTarget }
  /** No picture for this exhibit; visitors see a placeholder. */
  | { id: 'noImage'; severity: 'info'; key: string; index: number; target: EditTarget }
  /** A story exists but has fewer than STORY_MIN cards, so it can't be presented. */
  | { id: 'storyTooShort'; severity: 'warning'; count: number; target: EditTarget }
  /** A story card's exhibit is unavailable. */
  | { id: 'storyUnavailable'; severity: 'warning'; index: number; target: EditTarget }
  /** A story card's words don't fully fit the exported card: they will be shortened (marked on the card). */
  | { id: 'storyShortened'; severity: 'info'; index: number; target: EditTarget };

/**
 * Verifiable conditions only. Optional fields (title, introduction,
 * captions, card words, narration) are optional - never listed. While the
 * catalogue is still loading (`ready` false) availability isn't judged.
 */
export function readiness(exhibition: Exhibition, slides: readonly ExhibitSlide[], ready: boolean): ReadinessItem[] {
  const items: ReadinessItem[] = [];
  if (exhibition.exhibits.length === 0) return [{ id: 'noExhibits', severity: 'blocker', target: { kind: 'exhibits' } }];
  if (ready)
    slides.forEach((slide, index) => {
      if (slide.kind === 'removed') items.push({ id: 'unavailable', severity: 'warning', key: slide.key, index, target: { kind: 'exhibit', index } });
      else if (slide.kind === 'exhibit' && !slide.content.thumbnail) items.push({ id: 'noImage', severity: 'info', key: slide.key, index, target: { kind: 'exhibit', index } });
    });
  const story = exhibition.story;
  if (story && story.cards.length > 0) {
    if (story.cards.length < STORY_MIN) items.push({ id: 'storyTooShort', severity: 'warning', count: story.cards.length, target: { kind: 'story', index: null } });
    storySlides(story, slides).forEach((slide, index) => {
      if (ready && slide.exhibit?.kind !== 'exhibit') items.push({ id: 'storyUnavailable', severity: 'warning', index, target: { kind: 'story', index } });
      else if (fitStoryCard(cardContent(slide)).shortened) items.push({ id: 'storyShortened', severity: 'info', index, target: { kind: 'story', index } });
    });
  }
  return items;
}

/** Which starting views can be previewed now, and why not. */
export function startAvailability(exhibition: Exhibition): Record<PreviewStart, 'ok' | 'noExhibits' | 'noStory'> {
  const none = exhibition.exhibits.length === 0;
  const story = (exhibition.story?.cards.length ?? 0) >= STORY_MIN;
  return { exhibition: none ? 'noExhibits' : 'ok', tour: none ? 'noExhibits' : 'ok', story: none ? 'noExhibits' : story ? 'ok' : 'noStory' };
}

/* ---------- story card fit (export = preview) ---------- */

/** Logical card: 360 x 450, padding 20 -> a 320 x 410 content box. */
export const CARD = { width: 360, height: 450, padding: 20, gap: 8 } as const;
export const TYPE = {
  part: { size: 12, line: 16 },
  exhibit: { size: 13, line: 18 },
  title: { size: 22, line: 30 },
  text: { size: 15, line: 22 },
  note: { size: 11, line: 14 },
} as const;
export const IMAGE_HEIGHTS = { full: 220, min: 120 } as const;

/**
 * A CONSERVATIVE estimate of wrapped lines (no font metrics here): glyphs
 * counted as 0.6 of the size wide (0.66 bold) - wider than average Latin or
 * Cyrillic text - so real text takes at most the lines planned; whole
 * words kept together, a word longer than a line is broken.
 */
export function estimateLines(text: string, fontSize: number, width: number, bold = false): number {
  const perLine = Math.max(1, Math.floor(width / (fontSize * (bold ? 0.66 : 0.6))));
  let lines = 0;
  for (const paragraph of text.split('\n')) {
    let used = 0;
    let count = 1;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const length = [...word].length;
      if (length > perLine) {
        count += used > 0 ? 1 : 0;
        count += Math.ceil(length / perLine) - 1;
        used = length % perLine;
        continue;
      }
      const needed = used === 0 ? length : used + 1 + length;
      if (needed > perLine) {
        count += 1;
        used = length;
      } else used = needed;
    }
    lines += count;
  }
  return lines;
}

export type StoryCardFit = {
  imageHeight: number;
  /** Max lines for each text (0 = not shown); `numberOfLines` on the card, with an ellipsis. */
  lines: { exhibit: number; title: number; text: number };
  /** Some of the curator's words or the exhibit title won't fit: the card shows "…" and a visible note. */
  shortened: boolean;
};

/**
 * The ONE layout rule for a story card, used by the preview and the
 * exported image (same component, same numbers), so nothing is silently
 * cut off: first the picture shrinks (220 -> 120 pt), then the text is
 * limited to the lines that fit, with an ellipsis and a note on the card.
 */
export function fitStoryCard(content: StoryCardContent): StoryCardFit {
  const inner = CARD.width - CARD.padding * 2;
  const budget = CARD.height - CARD.padding * 2;
  const want = {
    exhibit: content.exhibitTitle ? Math.min(2, estimateLines(content.exhibitTitle, TYPE.exhibit.size, inner, true)) : 0,
    title: content.cardTitle ? estimateLines(content.cardTitle, TYPE.title.size, inner, true) : 0,
    text: content.text ? estimateLines(content.text, TYPE.text.size, inner) : 0,
  };
  const exhibitCut = !!content.exhibitTitle && estimateLines(content.exhibitTitle, TYPE.exhibit.size, inner, true) > 2;
  const blocks = (lines: typeof want, noteShown: boolean) => {
    const parts = [TYPE.part.line, lines.exhibit * TYPE.exhibit.line, lines.title * TYPE.title.line, lines.text * TYPE.text.line, noteShown ? TYPE.note.line : 0].filter((height) => height > 0);
    return parts.reduce((sum, height) => sum + height, 0) + parts.length * CARD.gap; // + gap after each block (image follows the part)
  };
  // 1. Everything with the full picture?
  let imageHeight: number = IMAGE_HEIGHTS.full;
  if (!exhibitCut && blocks(want, false) + imageHeight <= budget) return { imageHeight, lines: want, shortened: false };
  // 2. Shrink the picture as far as needed.
  imageHeight = Math.max(IMAGE_HEIGHTS.min, budget - blocks(want, false));
  if (!exhibitCut && blocks(want, false) + imageHeight <= budget) return { imageHeight, lines: want, shortened: false };
  // 3. Limit lines: the title to 2, then the text to what is left (at least 2 lines when there is text).
  imageHeight = IMAGE_HEIGHTS.min;
  const lines = { ...want, title: Math.min(want.title, 2) };
  const room = budget - imageHeight - blocks({ ...lines, text: 0 }, true) - (lines.text > 0 ? CARD.gap : 0);
  lines.text = want.text > 0 ? Math.max(Math.min(want.text, Math.floor(room / TYPE.text.line)), Math.min(2, want.text)) : 0;
  const shortened = exhibitCut || lines.title < want.title || lines.text < want.text;
  return { imageHeight, lines, shortened };
}

/* ---------- preview in progress (memory only) ---------- */

/** Survives the screen being re-created while a source is open (owner + collection bound). */
let previewing: { owner: string; collectionId: string; view: PreviewStart | null; editY: number } | null = null;
export const keepPreview = (owner: string, collectionId: string, view: PreviewStart | null, editY: number) => {
  previewing = { owner, collectionId, view, editY };
};
export const resumePreview = (owner: string, collectionId: string) => (previewing && previewing.owner === owner && previewing.collectionId === collectionId ? previewing : null);
export const endPreview = () => {
  previewing = null;
};
