import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import type { CultureCategoryRow, CultureItemRow, CultureMaterialRow } from '@/services/content/types';

import { seededCultureItems } from '../glossary/seededCultureItems';
import { buildGallery, filterGallery, GALLERY_PRESENTATION, galleryFilters, MATERIALS_FILTER, neighbour, previewContext, tileAspect } from './galleryModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const ROOT = path.join(__dirname, '../../../..');
const ITEMS = [...seededCultureItems(ROOT).values()] as unknown as CultureItemRow[];
const CATEGORIES: CultureCategoryRow[] = ['boz-uy', 'oymo', 'shyrdak', 'komuz', 'horse', 'clothing', 'food'].map((id, index) => ({ id, title: id, sort_order: index }));
const MATERIALS = [
  { id: 'kalpak-history', kind: 'reading', title: 'Калпак', description: 'Калпак жөнүндө.', sort_order: 1, body: 'x', accuracy_level: 'partially_verified', sources: [], image_url: null, duration_minutes: 3 },
  { id: 'no-image', kind: 'reading', title: 'Сүрөтсүз', description: null, sort_order: 2, body: 'x', accuracy_level: 'unverified', sources: null, image_url: null, duration_minutes: 3 },
] as unknown as CultureMaterialRow[];
// Bundled-image maps as the real app has them, but with dummy asset ids.
const ITEM_IMAGES: Record<string, number[]> = Object.fromEntries(['boz-uy-tunduk', 'horse-eer', 'clothing-chapan', 'oymo-bulak'].map((id, index) => [id, [index + 1]]));
const MATERIAL_IMAGES: Record<string, number> = { 'kalpak-history': 99 };
const build = (offline = false) => buildGallery({ items: ITEMS, materials: MATERIALS, categories: CATEGORIES, itemImages: ITEM_IMAGES, materialImages: MATERIAL_IMAGES, language: 'kg', offline });

describe('Culture Gallery', () => {
  it('only real content with an image and a valid route; no duplicates', () => {
    const entries = build();
    expect(entries.map((entry) => entry.contentId).sort()).toEqual(['boz-uy-tunduk', 'clothing-chapan', 'horse-eer', 'kalpak-history', 'oymo-bulak'].sort());
    expect(new Set(entries.map((entry) => entry.key)).size).toBe(entries.length);
    for (const entry of entries) expect(entry.route).toBe(entry.contentType === 'culture_item' ? `/culture/item/${entry.contentId}` : `/culture/material/${entry.contentId}`);
    expect(fs.existsSync(path.join(ROOT, 'src/app/culture/item/[itemId]/index.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'src/app/culture/material/[materialId].tsx'))).toBe(true);
  });

  it('category filters come from real categories, with current counts and stable order', () => {
    const entries = build();
    expect(galleryFilters(entries, CATEGORIES)).toEqual([
      { id: 'boz-uy', count: 1 },
      { id: 'oymo', count: 1 },
      { id: 'horse', count: 1 },
      { id: 'clothing', count: 1 },
      { id: MATERIALS_FILTER, count: 1 },
    ]);
    expect(filterGallery(entries, 'horse').map((entry) => entry.contentId)).toEqual(['horse-eer']);
    expect(filterGallery(entries, 'food')).toEqual([]);
  });

  it('preview text is EXISTING authored text only', () => {
    const tunduk = ITEMS.find((item) => item.id === 'boz-uy-tunduk')!;
    const entry = build().find((candidate) => candidate.contentId === 'boz-uy-tunduk')!;
    expect(entry.context).toBe(previewContext(tunduk, 'kg'));
    expect([tunduk.cultural_meaning?.trim(), tunduk.simple_summary_kg?.trim()]).toContain(entry.context);
    expect(build().find((candidate) => candidate.contentId === 'kalpak-history')!.context).toBe('Калпак жөнүндө.');
  });

  it('previous / next stop at the ends of the filtered order', () => {
    expect(neighbour(3, 0, -1)).toBeNull();
    expect(neighbour(3, 0, 1)).toBe(1);
    expect(neighbour(3, 2, 1)).toBeNull();
  });

  it('missing image or content is skipped; offline skips remote-only images', () => {
    const remoteOnly = { ...ITEMS.find((item) => item.id === 'horse-kok-boru')!, image_url: 'https://example.org/k.jpg' };
    const entries = buildGallery({ items: [remoteOnly], materials: [], categories: CATEGORIES, itemImages: {}, materialImages: {}, language: 'kg', offline: false });
    expect(entries.map((entry) => entry.contentId)).toEqual(['horse-kok-boru']);
    expect(buildGallery({ items: [remoteOnly], materials: [], categories: CATEGORIES, itemImages: {}, materialImages: {}, language: 'kg', offline: true })).toEqual([]);
    expect(buildGallery({ items: undefined, materials: undefined, categories: undefined, itemImages: {}, materialImages: {}, language: 'kg', offline: false })).toEqual([]);
  });

  it('Save and My Collections reuse the existing systems (no gallery-specific stores)', () => {
    const screen = fs.readFileSync(path.join(__dirname, 'CultureGalleryScreen.tsx'), 'utf8');
    expect(screen).toMatch(/toggleFavoriteWithFeedback\(entry\.contentType, entry\.contentId\)/);
    expect(screen).toMatch(/<AddToCollectionButton contentType=\{entry\.contentType\}/);
    expect(screen).toMatch(/<SourcesAndNotes contentType=\{entry\.contentType\} level=\{entry\.accuracy\}/);
    expect(screen).toMatch(/<FlatList/);
    expect(fs.readdirSync(path.join(ROOT, 'src/store')).filter((file) => /gallery/i.test(file))).toEqual([]);
  });

  it('no generated factual text; no image-origin labels invented', () => {
    const code = ['galleryModel.ts', 'CultureGalleryScreen.tsx'].map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')).join('\n');
    expect(code).not.toMatch(/openai|anthropic|summari[sz]e\(|generate|photograph|illustration/i);
  });

  it('age presentation config and real aspect ratios', () => {
    expect(GALLERY_PRESENTATION.child).toMatchObject({ columns: 1, showCategory: false });
    expect(GALLERY_PRESENTATION.teen.columns).toBe(2);
    expect(GALLERY_PRESENTATION.adult.editorial).toBe(true);
    expect(tileAspect(1600, 900)).toBe(1.4);
    expect(tileAspect(800, 1000)).toBe(0.8);
    expect(tileAspect(undefined, undefined)).toBe(0.8);
  });

  it('KG / RU / EN strings', () => {
    for (const dict of [kg, ru, en]) {
      const block = (dict as unknown as { cultureGallery: Record<string, string> }).cultureGallery;
      for (const key of ['entry', 'title', 'all', 'openStory', 'learnMore', 'previous', 'next', 'close', 'save', 'saved', 'addToCollection', 'emptyCategory']) expect(block[key]).toBeTruthy();
    }
  });
});
