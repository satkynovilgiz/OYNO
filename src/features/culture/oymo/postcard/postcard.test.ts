import * as fs from 'fs';
import * as path from 'path';
import { createElement } from 'react';
import { act, create } from 'react-test-renderer';

import { ShareCard, shareCardSize } from '@/components/share/ShareCard';
import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import type { MotifLayer } from '@/services/culture/oymoEditor';
import { colors } from '@/theme';

import { BACKGROUNDS, backgroundColor, BOTTOM_RESERVE, CARD_HEIGHT, CARD_WIDTH, CLOCK_ZONE, compositionFor, startDesignSet, textZone, updatePlacement, updateShared, cardSize, cleanGreeting, contrast, exportSize, FORMATS, frameFor, GREETING_MAX, GREETING_SIZES, fits, glyphEm, greetingFontSize, greetingLength, greetingStyle, greetingTextBox, wrapLines, LAYOUTS, POSITIONS, SIZES, startPostcard, textColorOn, typedGreeting, type Box, type PostcardComposition } from './postcardModel';
import { PostcardView } from './PostcardView';

jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
const mockFiles = { existing: new Set<string>(), deleted: [] as string[] };
jest.mock('expo-file-system', () => ({
  File: class {
    mockUri: string;
    constructor(mockPath: string) {
      this.mockUri = mockPath;
    }
    get exists() {
      return mockFiles.existing.has(this.mockUri);
    }
    delete() {
      mockFiles.existing.delete(this.mockUri);
      mockFiles.deleted.push(this.mockUri);
    }
  },
}));

const layer = (id: string, x: number, y: number): MotifLayer => ({ id, motifId: 'kochkorMuyuz', color: '#2F5D3A', point: { x, y }, rotation: 0, scale: 1, visible: true });
const SAVED = { id: 'saved-1', name: 'My oymo', layers: [layer('a', 150, 150), layer('b', 80, 60)], background_color: '#EADCC0', symmetry_mode: 'fourWay' as const, created_at: '', updated_at: '' };
const deepFreeze = <T,>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};
/** 80-letter greetings: widest glyphs, Kyrgyz letters, mixed scripts, long words, short. */
export const REPRESENTATIVE = [
  'Ж'.repeat(GREETING_MAX),
  'Ш'.repeat(GREETING_MAX),
  'W'.repeat(GREETING_MAX),
  'Ңөү ңөү Ңөү ңөү '.repeat(6).slice(0, GREETING_MAX),
  'Жаңы жылыңыз менен! С Новым годом! Happy New Year! Майрамыңыз кут болсун, достор!'.slice(0, GREETING_MAX),
  'Майрамыңызмененкуттуктайбыз ПоздравляемсНовымгодом WishingyouwonderfulholidaysW'.slice(0, GREETING_MAX),
  'Ыраазычылык'.repeat(8).slice(0, GREETING_MAX),
  'Happy holidays!',
];
const inside = (box: Box, card: { width: number; height: number }) => box.x >= 0 && box.y >= 0 && box.x + box.width <= card.width + 0.001 && box.y + box.height <= card.height + 0.001;
const overlap = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

function everyComposition(): PostcardComposition[] {
  const base = startPostcard(SAVED);
  const out: PostcardComposition[] = [];
  for (const format of FORMATS) for (const layout of LAYOUTS) for (const size of SIZES) for (const position of POSITIONS) for (const greeting of ['', 'Hello']) for (const background of BACKGROUNDS) out.push({ ...base, format, layout, size, position, greeting, background });
  return out;
}

describe('the original is never touched', () => {
  it('the postcard works on a deep copy of the saved pattern', () => {
    const saved = deepFreeze(JSON.parse(JSON.stringify(SAVED)));
    const before = JSON.stringify(saved);
    const postcard = startPostcard(saved);
    expect(postcard.artwork.layers).not.toBe(saved.layers);
    postcard.artwork.layers[0].point.x = 1;
    postcard.artwork.layers[0].color = '#000000';
    postcard.artwork.layers.push(layer('c', 1, 1));
    expect(JSON.stringify(saved)).toBe(before);
  });

});

describe('layout', () => {
  it('in all three outputs, all three layouts and every placement: the pattern, strips and greeting stay inside the card and never overlap', () => {
    const all = everyComposition();
    expect(all.length).toBe(3 * 3 * 3 * 3 * 2 * 4);
    for (const composition of all) {
      const frame = frameFor(composition);
      expect(frame.card).toEqual(cardSize(composition.format));
      const drawn = composition.layout === 'border' && frame.greeting ? [] : [frame.pattern];
      for (const box of [...drawn, ...frame.strips, ...(frame.greeting ? [frame.greeting] : [])]) expect(inside(box, frame.card)).toBe(true);
      if (frame.greeting) {
        for (const box of [...drawn, ...frame.strips]) expect(overlap(box, frame.greeting)).toBe(false);
      }
      expect(frame.pattern.width).toBe(frame.pattern.height);
    }
  });

  it('size and position really move the pattern', () => {
    const base = { ...startPostcard(SAVED), layout: 'classic' as const };
    expect(frameFor({ ...base, size: 'small' }).pattern.width).toBeLessThan(frameFor({ ...base, size: 'large' }).pattern.width);
    expect(frameFor({ ...base, size: 'small', position: 'top' }).pattern.y).toBeLessThan(frameFor({ ...base, size: 'small', position: 'bottom' }).pattern.y);
  });
});

describe('greeting', () => {
  it('a clear limit, counted in letters (Kyrgyz and Cyrillic never split); whitespace tidied', () => {
    const kyrgyz = 'Ңөү '.repeat(40);
    expect(greetingLength(typedGreeting(kyrgyz))).toBe(GREETING_MAX);
    expect(greetingLength(cleanGreeting(kyrgyz))).toBeLessThanOrEqual(GREETING_MAX);
    expect(typedGreeting('Line one\nline two')).toBe('Line one line two');
    expect(cleanGreeting('  Майрамыңыз   менен!  ')).toBe('Майрамыңыз менен!');
    // Emoji are one character each, not two.
    expect(greetingLength(typedGreeting('🎉'.repeat(100)))).toBe(GREETING_MAX);
  });

  it('the size chosen is the largest that fits, measured with the same width table', () => {
    for (const composition of everyComposition().filter((item) => item.greeting)) {
      for (const greeting of REPRESENTATIVE) {
        const box = greetingTextBox(frameFor({ ...composition, greeting }).greeting!);
        const size = greetingFontSize(greeting, box);
        expect(fits(greeting, size, box)).toBe(true);
        const larger = GREETING_SIZES.filter((candidate) => candidate > size);
        for (const candidate of larger) expect(fits(greeting, candidate, box)).toBe(false);
      }
    }
  });

  it('every 80-letter greeting of the widest glyphs fits at the smallest size', () => {
    const box = greetingTextBox(frameFor({ ...startPostcard(SAVED), format: 'square', greeting: 'x' }).greeting!);
    const smallest = GREETING_SIZES[GREETING_SIZES.length - 1];
    for (const char of ['Ж', 'Ш', 'Щ', 'Ю', 'М', 'W', 'M', 'Ф', 'Ы', 'ж', 'ш', 'Ң', 'Ө', 'Ү', '🎉']) {
      expect(fits(char.repeat(GREETING_MAX), smallest, box)).toBe(true);
    }
    // The estimate never treats a wide glyph as narrower than a plain letter.
    expect(glyphEm('Ж')).toBeGreaterThan(glyphEm('а'));
    expect(glyphEm('W')).toBeGreaterThan(glyphEm('n'));
  });

  it('wrapping: words move to the next line, an over-long word breaks across lines', () => {
    expect(wrapLines('', 20, 100)).toBe(0);
    expect(wrapLines('aa aa', 10, 1000)).toBe(1);
    expect(wrapLines('aa aa', 10, 15)).toBe(2);
    expect(wrapLines('Ж'.repeat(30), 10, 105)).toBe(3); // 10.5 per glyph -> 10 per line
  });

  it('readable by default: the text colour always reaches 4.5:1 on the chosen background', () => {
    const editorBackgrounds = ['#EADCC0', colors.primary, colors.tiles.food, colors.accentBrown, colors.accentGold, colors.textMuted, colors.accentBrownDark, '#FFFFFF', '#000000'];
    for (const background of BACKGROUNDS) {
      for (const own of editorBackgrounds) {
        const card = backgroundColor({ ...startPostcard({ ...SAVED, background_color: own }), background });
        const ink = greetingStyle(card);
        expect(contrast(ink.color, ink.plate ?? card)).toBeGreaterThanOrEqual(4.5);
        if (!ink.plate) expect(ink.color).toBe(textColorOn(card));
      }
    }
  });
});

describe('export matches the preview', () => {
  it('portrait exports 1080 x 1350, square 1080 x 1080 - the card size x 3', () => {
    expect(exportSize('portrait')).toEqual({ width: 1080, height: 1350 });
    expect(exportSize('square')).toEqual({ width: 1080, height: 1080 });
    for (const format of FORMATS) expect(shareCardSize({ variant: 'postcard', cardSize: cardSize(format) })).toEqual(cardSize(format));
    expect(shareCardSize({ variant: 'story' })).toEqual({ width: CARD_WIDTH, height: 450 });
  });

  it('the exported card renders exactly the previewed postcard - nothing added around it', () => {
    for (const format of FORMATS) {
      const composition = { ...startPostcard(SAVED), format, greeting: 'Жаңы жылыңыз менен! С Новым годом!' };
      let preview: ReturnType<typeof create> | null = null;
      let exported: ReturnType<typeof create> | null = null;
      act(() => {
        preview = create(createElement(PostcardView, { composition }));
        exported = create(createElement(ShareCard, { variant: 'postcard', title: 't', label: 'l', imageSource: null, cardSize: cardSize(format), artwork: createElement(PostcardView, { composition }) }));
      });
      const exportedTree = exported!.toJSON() as unknown as { props: { style: Record<string, number> }; children: unknown[] };
      expect(exportedTree.props.style).toMatchObject(cardSize(format));
      expect(exportedTree.children).toHaveLength(1);
      expect(JSON.stringify(exportedTree.children[0])).toBe(JSON.stringify(preview!.toJSON()));
      // Only the chosen content: the greeting, no title/label text.
      const text = JSON.stringify(exportedTree);
      expect(text).toContain('Жаңы жылыңыз менен!');
      expect(text).not.toContain('"t"');
      expect(text).not.toContain('My oymo');
    }
  });
});

describe('temporary export files', () => {
  beforeEach(() => {
    mockFiles.existing.clear();
    mockFiles.deleted = [];
    jest.resetModules();
  });

  it('repeated exports keep at most one file; a saved one is removed once copied', () => {
    const files = jest.requireActual('@/services/share/exportFiles') as typeof import('@/services/share/exportFiles');
    for (let index = 1; index <= 4; index += 1) {
      files.discardPreviousExport();
      const uri = `file:///cache/ReactNative-snapshot-${index}.jpg`;
      mockFiles.existing.add(uri);
      files.trackExport(uri);
      expect(mockFiles.existing.size).toBe(1);
    }
    files.releaseExport('file:///cache/ReactNative-snapshot-4.jpg');
    expect(mockFiles.existing.size).toBe(0);
    expect(files.currentExportForTests()).toBeNull();
    // A bare path (Android) is handled too, and a missing file is not an error.
    mockFiles.existing.add('file:///data/cache/x.jpg');
    files.releaseExport('/data/cache/x.jpg');
    expect(mockFiles.existing.size).toBe(0);
    expect(() => files.releaseExport('/gone.jpg')).not.toThrow();
  });

});

describe('languages', () => {
  it('every control is translated in KG, RU and EN', () => {
    const keys = (value: unknown, prefix = ''): string[] => (value && typeof value === 'object' ? Object.entries(value).flatMap(([key, child]) => keys(child, `${prefix}${key}.`)) : [prefix]);
    const sections = [en, ru, kg].map((lang) => (lang as unknown as { postcard: unknown }).postcard);
    expect(keys(sections[1]).sort()).toEqual(keys(sections[0]).sort());
    expect(keys(sections[2]).sort()).toEqual(keys(sections[0]).sort());
  });
});

describe('design set', () => {
  const SET = () => startDesignSet(SAVED);

  it('defines and keeps each output\'s dimensions: 1080 x 1080, 1080 x 1350, 1080 x 2340', () => {
    expect(FORMATS).toEqual(['square', 'portrait', 'wallpaper']);
    expect(FORMATS.map((format) => exportSize(format))).toEqual([
      { width: 1080, height: 1080 },
      { width: 1080, height: 1350 },
      { width: 1080, height: 2340 },
    ]);
    for (const format of FORMATS) expect(frameFor(compositionFor(SET(), format)).card).toEqual(cardSize(format));
  });

  it('editing one placement leaves the other outputs exactly as they were', () => {
    const before = SET();
    const after = updatePlacement(before, 'wallpaper', { size: 'large', position: 'top', layout: 'banner' });
    expect(after.outputs.wallpaper).toEqual({ size: 'large', position: 'top', layout: 'banner' });
    expect(after.outputs.square).toBe(before.outputs.square);
    expect(after.outputs.portrait).toBe(before.outputs.portrait);
    expect(compositionFor(after, 'portrait')).toEqual(compositionFor(before, 'portrait'));
    expect(before.outputs.wallpaper).toEqual({ size: 'medium', position: 'center', layout: 'classic' });
  });

  it('the palette and greeting are shared by every output', () => {
    const set = updateShared(SET(), { background: 'forest', greeting: 'Майрамыңыз менен!' });
    for (const format of FORMATS) expect(compositionFor(set, format)).toMatchObject({ background: 'forest', greeting: 'Майрамыңыз менен!', format });
  });

  it('works on one copy: the saved pattern is untouched by any change to the set', () => {
    const saved = deepFreeze(JSON.parse(JSON.stringify(SAVED)));
    const before = JSON.stringify(saved);
    let set = startDesignSet(saved);
    set.artwork.layers[0].color = '#000000';
    set = updatePlacement(updateShared(set, { greeting: 'x', background: 'gold' }), 'square', { size: 'small' });
    expect(JSON.stringify(saved)).toBe(before);
  });

  it('wallpaper: the greeting never enters the suggested clock area or the bottom reserve', () => {
    for (const composition of everyComposition().filter((item) => item.format === 'wallpaper' && item.greeting)) {
      const box = frameFor(composition).greeting!;
      expect(overlap(box, CLOCK_ZONE)).toBe(false);
      expect(box.y + box.height).toBeLessThanOrEqual(CARD_HEIGHT.wallpaper - BOTTOM_RESERVE);
      expect(box.y).toBeGreaterThanOrEqual(textZone('wallpaper').top);
    }
  });

  it('square and portrait are laid out exactly as before the design set existed', () => {
    // Reference boxes from the single-postcard layout (classic/banner/border, medium, centre, with a greeting).
    const at = (format: 'square' | 'portrait', layout: 'classic' | 'banner' | 'border') => frameFor({ ...startPostcard(SAVED), format, layout, greeting: 'Hi' });
    expect(at('portrait', 'classic').greeting).toEqual({ x: 24, y: 294, width: 312, height: 132 });
    expect(at('portrait', 'classic').pattern.y).toBeCloseTo(24 + (450 - 48 - 144 - (450 - 48 - 144) * 0.8) / 2, 5);
    expect(at('square', 'banner').greeting).toEqual({ x: 24, y: 204, width: 312, height: 132 });
    expect(at('square', 'border').greeting!.y).toBe(114);
  });

  it('every output exports exactly its preview', () => {
    for (const format of FORMATS) {
      const composition = compositionFor(updateShared(startDesignSet(SAVED), { greeting: 'Жаңы жылыңыз менен!' }), format);
      let preview: ReturnType<typeof create> | null = null;
      let exported: ReturnType<typeof create> | null = null;
      act(() => {
        preview = create(createElement(PostcardView, { composition }));
        exported = create(createElement(ShareCard, { variant: 'postcard', title: 't', label: 'l', imageSource: null, cardSize: cardSize(format), artwork: createElement(PostcardView, { composition }) }));
      });
      const tree = exported!.toJSON() as unknown as { props: { style: Record<string, number> }; children: unknown[] };
      expect(tree.props.style).toMatchObject(cardSize(format));
      expect(JSON.stringify(tree.children[0])).toBe(JSON.stringify(preview!.toJSON()));
    }
  });
});
