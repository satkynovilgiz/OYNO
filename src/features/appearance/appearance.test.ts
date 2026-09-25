import * as fs from 'fs';
import * as path from 'path';

import { SWIFT_FAMILY, WIDGET_CATALOG, widgetAvailability } from './widgetCatalog';
import { wallpaperSaveFeedback } from './wallpaperFeedback';

describe('widget catalog', () => {
  const swift = fs.readFileSync(path.join(__dirname, '../../../targets/widget/OYNOWidgets.swift'), 'utf8');

  it('lists exactly the widgets and sizes the native extension supports', () => {
    const native = Array.from(swift.matchAll(/kind:\s*"(\w+)"[\s\S]*?supportedFamilies\(\[([^\]]+)\]\)/g)).map(([, kind, families]) => ({
      kind,
      families: families.split(',').map((f) => SWIFT_FAMILY[f.trim().replace(/^\./, '')]),
    }));
    expect(native.length).toBe(WIDGET_CATALOG.length);
    for (const entry of WIDGET_CATALOG) {
      const match = native.find((n) => n.kind === entry.swiftKind);
      expect(match?.families.sort()).toEqual([...entry.families].sort());
    }
  });

  it('says widgets are unavailable outside an iOS build with the extension', () => {
    expect(widgetAvailability('web', () => true)).toBe('unavailable');
    expect(widgetAvailability('android', () => true)).toBe('unavailable');
    expect(widgetAvailability('ios', () => false)).toBe('unavailable');
    expect(widgetAvailability('ios', () => true)).toBe('installed');
  });
});

describe('wallpaper save feedback', () => {
  it('maps every save result to an honest state (never success on failure)', () => {
    expect(wallpaperSaveFeedback('saved')).toEqual({ state: 'saved', toast: true });
    expect(wallpaperSaveFeedback('downloaded')).toEqual({ state: 'saved', toast: true });
    expect(wallpaperSaveFeedback('denied').state).toBe('failed');
    expect(wallpaperSaveFeedback('unsupported').state).toBe('failed');
    expect(wallpaperSaveFeedback('error')).toEqual({ state: 'failed', toast: false });
  });
});
