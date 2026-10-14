import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { affectsPerceivedColor, exportSurface, paperSpeckles, previewSource, setPreviewSource, SURFACES, TEXTURE_PROVENANCE } from './surfacesModel';

const ROOT = path.join(__dirname, '../../../../..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const layer = { id: 'layer0', motifId: 'kochkorMuyuz', color: '#2F5233', point: { x: 40, y: 60 }, rotation: 15, scale: 1.2, visible: true };

describe('Presentation previews - textures and provenance', () => {
  it('every texture is an original, recorded, code-drawn pattern - and the doc lists the same', () => {
    expect(TEXTURE_PROVENANCE.map((entry) => entry.id).sort()).toEqual(SURFACES.filter((id) => id !== 'plain').sort());
    const doc = read('docs/PRESENTATION_PREVIEWS.md');
    for (const entry of TEXTURE_PROVENANCE) {
      expect(entry.source).toBe('original-code');
      expect(fs.existsSync(path.join(ROOT, entry.file))).toBe(true);
      expect(doc).toContain(`| ${entry.id} |`);
      expect(doc).toContain(entry.file);
    }
    // No bundled texture images at all (nothing to license).
    const texture = read('src/features/culture/oymo/surfaces/SurfaceTexture.tsx');
    expect(texture).not.toMatch(/require\(|\.png|\.jpe?g|\.webp|import \w+ from '@assets/);
  });

  it('the paper grain is deterministic (same picture in every preview and export)', () => {
    expect(paperSpeckles(48, 26)).toEqual(paperSpeckles(48, 26));
    expect(paperSpeckles(48, 26).every((speck) => speck.x >= 0 && speck.x <= 48 && speck.y >= 0 && speck.y <= 48)).toBe(true);
    expect(read('src/features/culture/oymo/surfaces/surfacesModel.ts')).not.toMatch(/Math\.random/);
  });
});

describe('Presentation previews - the design never changes', () => {
  it('the screen works on a copy, per owner', () => {
    const design = { layers: [layer], backgroundColor: '#EADCC0', symmetry: 'fourWay' as const };
    setPreviewSource('guest', design);
    const copy = previewSource('guest')!;
    copy.layers[0].point.x = 999;
    copy.backgroundColor = '#000000';
    expect(previewSource('guest')).toEqual(design);
    expect(design.layers[0].point.x).toBe(40);
    expect(previewSource('someone-else')).toBeNull();
  });

  it('the surface is drawn OVER the unchanged design rendering (same geometry and colours)', () => {
    const texture = read('src/features/culture/oymo/surfaces/SurfaceTexture.tsx');
    expect(texture).toMatch(/<OymoArtwork layers=\{layers\} backgroundColor=\{backgroundColor\} symmetryMode=\{symmetryMode\} size=\{size\} \/>\s*<SurfaceTexture/);
    expect(texture).toMatch(/pointerEvents="none"/);
  });
});

describe('Presentation previews - export', () => {
  it('export matches the selection: the chosen surface, or plain when left out', () => {
    expect(exportSurface('fabric', true)).toBe('fabric');
    expect(exportSurface('fabric', false)).toBe('plain');
    expect(exportSurface('plain', true)).toBe('plain');
    expect(affectsPerceivedColor('plain')).toBe(false);
    expect(affectsPerceivedColor('paper') && affectsPerceivedColor('fabric')).toBe(true);
  });

  it('preview and export share ONE rendering path; the card carries no private fields', () => {
    const screen = read('src/features/culture/oymo/surfaces/SurfacePreviewScreen.tsx');
    expect(screen.match(/<SurfacedArtwork /g)).toHaveLength(2);
    expect(screen).toMatch(/artwork: <SurfacedArtwork [^\n]*surface=\{exported\}/);
    const card = screen.slice(screen.indexOf('void share('), screen.indexOf("t('culture.labs.shareMessage')"));
    expect(card).not.toMatch(/owner|user|recipe|note|\.name\b|creationId/i);
    expect(card).toContain("title: t('culture.labs.myDesign')");
  });

  it('reduced motion: no transition when it is on', () => {
    expect(read('src/features/culture/oymo/surfaces/SurfacePreviewScreen.tsx')).toMatch(/entering=\{reducedMotion \? undefined : FadeIn/);
  });

  it('KG / RU / EN, including an explanation for each textured surface', () => {
    for (const dict of [kg, ru, en]) {
      const block = (dict as unknown as { surfaces: Record<string, unknown> }).surfaces as { names: Record<string, string>; colorNote: Record<string, string> } & Record<string, string>;
      for (const id of SURFACES) expect(block.names[id]).toBeTruthy();
      for (const id of SURFACES.filter(affectsPerceivedColor)) expect(block.colorNote[id]).toBeTruthy();
      for (const key of ['title', 'entry', 'mockupNote', 'include', 'export', 'privacy', 'description_one', 'description_other']) expect([key, !!block[key]]).toEqual([key, true]);
    }
  });
});
