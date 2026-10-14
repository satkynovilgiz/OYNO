import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { APPROVED_FIELDS, approvedContent, CARD_STYLE_IDS, CARD_STYLES, looksPrivate, STYLEABLE } from './cardContent';
import { CARD_FIT, charsPerLine, fitCardText, lineCount } from './cardFit';
import type { ShareCardContent } from './ShareCard';

const ROOT = path.join(__dirname, '../../..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const LONG = {
  kg: 'Кыргыз боз үйүнүн түндүгү жана анын үй-бүлөнүн муундан муунга өткөн салттуу мааниси тууралуу узун аталыш',
  ru: 'Тюндюк кыргызской юрты и его традиционное значение для семьи, передаваемое из поколения в поколение',
  en: 'The tündük of the Kyrgyz yurt and its traditional meaning for a family, handed down from generation to generation',
};

describe('one fit rule for every card text', () => {
  it('short text keeps the largest size and is never shortened', () => {
    expect(fitCardText('Түндүк', CARD_FIT.heroTitle)).toEqual({ text: 'Түндүк', fontSize: 34, lineHeight: 40, lines: 1, shortened: false });
  });
  it('longer text steps down a size before anything is cut', () => {
    const fit = fitCardText('Кыргыз оймо-чийимдеринин тарыхы жана мааниси', CARD_FIT.paperTitle);
    expect(fit.shortened).toBe(false);
    expect(fit.fontSize).toBeLessThan(CARD_FIT.paperTitle.sizes[0]);
  });
  it.each(Object.entries(LONG))('very long %s titles are cut at a word with "…" and flagged (so the card shows the note)', (_, text) => {
    for (const role of [CARD_FIT.paperTitle, CARD_FIT.centerTitle, CARD_FIT.scoreTitle]) {
      const fit = fitCardText(text, role);
      expect(fit.shortened).toBe(true);
      expect(fit.text.endsWith('…')).toBe(true);
      expect(fit.fontSize).toBe(role.sizes[role.sizes.length - 1]);
      // What is kept really fits the role's lines at that size.
      expect(lineCount(fit.text, charsPerLine(role.width, fit.fontSize))).toBeLessThanOrEqual(role.maxLines);
      expect(text.startsWith(fit.text.slice(0, -1).trim())).toBe(true);
    }
  });
  it('deterministic, and word wrap counts lines like a renderer would', () => {
    expect(fitCardText(LONG.kg, CARD_FIT.heroTitle)).toEqual(fitCardText(LONG.kg, CARD_FIT.heroTitle));
    expect(lineCount('aaa bbb ccc', 7)).toBe(2);
    expect(lineCount('aaaaaaaaaaaaaaa', 5)).toBe(3);
    expect(lineCount('x aaaaaaaaaa', 5)).toBe(3);
  });
});

describe('approved fields only - nothing private reaches a card', () => {
  const everything = {
    title: 'Synthetic title', label: 'Label', subtitle: 'Sub', imageSource: null, excerpt: 'My line', linkedLabel: 'Түндүк', stat: '4 / 5', completedLabel: 'Done', lines: ['3 paths'], featured: ['Түндүк'], featuredLabel: 'Featured', artwork: 'ART', artworkSize: { width: 300, height: 300 }, cardSize: { width: 360, height: 450 }, cardStyle: 'felt',
    // Never approved for any card:
    userId: '7f3c2a9e-1b2d-4c5e-8f90-123456789abc', recipe: { steps: [] }, note: 'Hidden private note', email: 'person@example.com',
  } as unknown as ShareCardContent;

  it.each(Object.keys(APPROVED_FIELDS))('%s card: only its own fields', (variant) => {
    const out = approvedContent({ ...everything, variant: variant as ShareCardContent['variant'] }) as unknown as Record<string, unknown>;
    const allowed = new Set<string>(['variant', 'title', 'label', 'imageSource', ...APPROVED_FIELDS[variant as keyof typeof APPROVED_FIELDS]]);
    for (const key of Object.keys(out)) expect([variant, key, allowed.has(key)]).toEqual([variant, key, true]);
    for (const key of ['userId', 'recipe', 'note', 'email']) expect(out[key]).toBeUndefined();
  });

  it('account ids, emails and long numbers are refused even in an approved field', () => {
    expect(looksPrivate('7f3c2a9e-1b2d-4c5e-8f90-123456789abc')).toBe(true);
    expect(looksPrivate('write to person@example.com')).toBe(true);
    expect(looksPrivate('call 996555123456')).toBe(true);
    expect(looksPrivate('4 / 5 · 2026')).toBe(false);
    const out = approvedContent({ variant: 'journal', title: 'Trip', label: 'Journal', imageSource: null, excerpt: 'id 7f3c2a9e-1b2d-4c5e-8f90-123456789abc' });
    expect(out.excerpt).toBeUndefined();
    expect(approvedContent({ variant: 'summary', title: 'T', label: 'L', imageSource: null, lines: ['3 paths', 'person@example.com'] }).lines).toEqual(['3 paths']);
  });

  it('the creation card keeps its artwork (custom motifs render through the same LayerMotif renderer)', () => {
    const artwork = { custom: true };
    expect(approvedContent({ variant: 'creation', title: 'My design', label: 'Oymo', imageSource: null, artwork: artwork as never, artworkSize: { width: 300, height: 300 } }).artwork).toBe(artwork);
    expect(read('src/features/culture/oymo/components/OymoCanvas.tsx')).toMatch(/<LayerMotif layer=\{layer\}/);
    expect(read('src/features/culture/oymo/components/OymoArtwork.tsx')).toMatch(/<LayerMotif layer=\{layer\}/);
    expect(read('src/features/culture/oymo/components/LayerMotif.tsx')).toMatch(/custom/);
  });
});

describe('one rendering path, fixed card text, cleanup kept', () => {
  const card = read('src/components/share/ShareCard.tsx');
  const host = read('src/services/share/useShareCard.tsx');
  it('preview and export render the same ShareCard from the same filtered content', () => {
    expect(host).toMatch(/setPreview\(\{ content: approvedContent\(content\)/);
    expect(read('src/components/share/SharePreviewSheet.tsx')).toMatch(/<ShareCard \{\.\.\.card\} \/>/);
    expect(read('src/components/share/SharePreviewSheet.tsx')).toMatch(/onShare\(card\)/);
  });
  it('no platform auto-shrink; every card text ignores system font scaling', () => {
    expect(card).not.toMatch(/adjustsFontSizeToFit/);
    const texts = card.match(/<Text\b[^>]*>/g) ?? [];
    expect(texts.length).toBeGreaterThan(10);
    for (const tag of texts) expect(tag).toContain('{...FIXED}');
  });
  it('temporary-file cleanup and failure handling stay in the capture path', () => {
    for (const piece of ['discardPreviousExport()', 'releaseExport', 'trackExport']) expect(host).toContain(piece);
  });
  it('a small set of styles from the OYNO palette, offered where the subject is artwork or figures', () => {
    expect(CARD_STYLE_IDS).toEqual(['paper', 'forest', 'felt']);
    expect(STYLEABLE).toEqual(['creation', 'summary']);
    for (const id of CARD_STYLE_IDS) expect(CARD_STYLES[id].ink).toBeTruthy();
  });
  it('KG / RU / EN', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { shareCards: { shortened: string; style: string; styles: Record<string, string> } }).shareCards;
      expect(block.shortened && block.style).toBeTruthy();
      for (const id of CARD_STYLE_IDS) expect(block.styles[id]).toBeTruthy();
    }
  });
});
