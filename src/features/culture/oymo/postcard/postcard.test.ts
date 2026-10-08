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

import { BACKGROUNDS, backgroundColor, CARD_WIDTH, cardSize, cleanGreeting, contrast, exportSize, FORMATS, frameFor, GREETING_MAX, GREETING_SIZES, greetingFontSize, greetingLength, greetingStyle, LAYOUTS, POSITIONS, SIZES, startPostcard, textColorOn, typedGreeting, worstCaseHeight, type Box, type PostcardComposition } from './postcardModel';
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

  it('the flow never writes a saved pattern (no save/update/delete call anywhere in it)', () => {
    const dir = __dirname;
    for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.tsx') || (name.endsWith('.ts') && !name.endsWith('.test.ts')))) {
      const text = fs.readFileSync(path.join(dir, file), 'utf8');
      expect(text).not.toMatch(/saveOymoCreation|updateOymoCreation|deleteOymoCreation|\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
    }
  });
});

describe('layout', () => {
  it('in both formats, all three layouts and every placement: the pattern, strips and greeting stay inside the card and never overlap', () => {
    const all = everyComposition();
    expect(all.length).toBe(2 * 3 * 3 * 3 * 2 * 4);
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

  it('the longest, widest greeting still fits its box at the smallest size; short greetings get the largest', () => {
    const box = frameFor({ ...startPostcard(SAVED), greeting: 'x' }).greeting!;
    expect(worstCaseHeight(box.width)).toBeLessThanOrEqual(box.height);
    expect(greetingFontSize('Hello', box)).toBe(GREETING_SIZES[0]);
    const long = greetingFontSize('Ж'.repeat(GREETING_MAX), box);
    expect(long).toBeLessThan(GREETING_SIZES[0]);
    // A single unbroken 80-letter word fits too (it wraps across lines).
    expect(greetingFontSize('Майрамыңызменен'.repeat(6).slice(0, GREETING_MAX), box)).toBeGreaterThanOrEqual(GREETING_SIZES[GREETING_SIZES.length - 1]);
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
    const hook = fs.readFileSync(path.join(__dirname, '../../../../services/share/useShareCard.tsx'), 'utf8');
    expect(hook).toContain('const size = shareCardSize(content);');
    expect(hook).toContain('width: (size.width * EXPORT_SCALE) / scale, height: (size.height * EXPORT_SCALE) / scale');
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

  it('failed exports clean up and keep the composition (the preview stays open on failure)', () => {
    const hook = fs.readFileSync(path.join(__dirname, '../../../../services/share/useShareCard.tsx'), 'utf8');
    expect(hook).toContain('if (uri) releaseExport(uri);');
    expect(hook).toContain('discardPreviousExport();');
    // The screen keeps its own state; export never resets it.
    const screen = fs.readFileSync(path.join(__dirname, 'PostcardScreen.tsx'), 'utf8');
    expect(screen.slice(screen.indexOf('const onExport'), screen.indexOf('const choices'))).not.toContain('setComposition');
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
