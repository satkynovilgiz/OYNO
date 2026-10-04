import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { CULTURAL_CALENDAR } from '@/features/culture/calendar/culturalCalendar';

import { buildPublicWidgetSnapshot, isWidgetSnapshotPublicSafe, PUBLIC_WIDGET_KEY, type PublicWidgetInput } from './publicWidgetSnapshot';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const root = path.join(__dirname, '../../..');
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

const base: PublicWidgetInput = {
  language: 'kg',
  now: new Date('2026-10-03T08:00:00Z'),
  localDate: '2026-10-03',
  labels: { brand: 'OYNO', open: 'Ачуу', fallbackTitle: 'OYNOну ач', fallbackSubtitle: 'Кыргыз дүйнөсү телефонуңда' },
  calendar: null,
  daily: { itemId: 'boz-uy-overview', title: 'Боз үй', eyebrow: 'Күндүн ачылышы', subtitle: '2 мүнөт' },
  whatsNew: null,
  path: { id: 'boz-uy', title: 'Боз үй жолу', eyebrow: 'Окуу жолу' },
};

describe('public widget snapshot', () => {
  it('Daily OYNO is primary when no cultural date is near', () => {
    const snapshot = buildPublicWidgetSnapshot(base);
    expect(snapshot.primary).toEqual({ kind: 'daily', eyebrow: 'Күндүн ачылышы', title: 'Боз үй', subtitle: '2 мүнөт', url: 'oyno://open/culture_item/boz-uy-overview' });
    expect(snapshot.secondary?.kind).toBe('learning_path');
    expect(isWidgetSnapshotPublicSafe(snapshot)).toBe(true);
  });

  it('a Cultural Calendar date takes priority, Daily moves to the secondary slot', () => {
    const snapshot = buildPublicWidgetSnapshot({ ...base, calendar: { id: 'world-kalpak-day', title: 'Калпак күнү', dateText: '5-март', isToday: true, eyebrowToday: 'Бүгүн', eyebrowSoon: 'Жакында' } });
    expect(snapshot.primary).toMatchObject({ kind: 'calendar_event', eyebrow: 'Бүгүн', url: 'oyno://open/calendar_event/world-kalpak-day' });
    expect(snapshot.secondary?.kind).toBe('daily');
    expect(isWidgetSnapshotPublicSafe(snapshot)).toBe(true);
  });

  it('no content -> no primary (the widget shows its bundled fallback)', () => {
    const snapshot = buildPublicWidgetSnapshot({ ...base, daily: null, path: null });
    expect(snapshot.primary).toBeNull();
    expect(snapshot.secondary).toBeNull();
    expect(isWidgetSnapshotPublicSafe(snapshot)).toBe(true);
  });

  it("What's New is preferred over the static path for the secondary card", () => {
    const snapshot = buildPublicWidgetSnapshot({ ...base, daily: null, whatsNew: { type: 'culture_material', id: 'komuz-history', title: 'Комуз', eyebrow: 'Жаңы' } });
    expect(snapshot.primary).toBeNull();
    expect(snapshot.secondary?.url).toBe('oyno://open/culture_material/komuz-history');
  });

  it('every calendar event id builds a link the app accepts', () => {
    for (const event of CULTURAL_CALENDAR) {
      const snapshot = buildPublicWidgetSnapshot({ ...base, calendar: { id: event.id, title: 'x', dateText: 'y', isToday: false, eyebrowToday: 'a', eyebrowSoon: 'b' } });
      expect(isWidgetSnapshotPublicSafe(snapshot)).toBe(true);
    }
  });

  it('rejects anything private, unknown, oversized or linking elsewhere', () => {
    const good = buildPublicWidgetSnapshot(base);
    const bad: unknown[] = [
      null,
      { ...good, version: 1 },
      { ...good, userId: 'abc' },
      { ...good, token: 'x' },
      { ...good, email: 'a@b.c' },
      { ...good, journal: [] },
      { ...good, progress: { completed: 1 } },
      { ...good, labels: { ...good.labels, accountName: 'x' } },
      { ...good, primary: { ...good.primary, sessionId: 'x' } },
      { ...good, primary: { ...good.primary, url: 'https://evil.example/x' } },
      { ...good, primary: { ...good.primary, url: 'oyno://open/journal/x' } },
      { ...good, primary: { ...good.primary, url: 'oyno://open/culture_item/x?token=abc' } },
      { ...good, primary: { ...good.primary, title: 'a'.repeat(200) } },
      { ...good, primary: { ...good.primary, kind: 'journey' } },
      { ...good, language: 'de' },
      { ...good, primary: { ...good.primary, subtitle: 'someone@example.com' } },
      { ...good, primary: { ...good.primary, title: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc' } },
      { ...good, labels: { ...good.labels, open: '3f2b8c1e-1234-4abc-9def-0123456789ab' } },
      { ...good, localDate: 'today' },
    ];
    for (const value of bad) expect(isWidgetSnapshotPublicSafe(value)).toBe(false);
  });

  it('long titles are clipped instead of rejected', () => {
    const snapshot = buildPublicWidgetSnapshot({ ...base, daily: { ...base.daily!, title: 'Б'.repeat(300) } });
    expect(snapshot.primary!.title.length).toBeLessThanOrEqual(80);
    expect(isWidgetSnapshotPublicSafe(snapshot)).toBe(true);
  });
});

describe('widget wiring', () => {
  const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
  const swiftData = read('targets/widget/OYNOWidgetData.swift');
  const swiftViews = read('targets/widget/OYNOWidgets.swift');

  it('the Swift widget reads the same key and the same (single) App Group', () => {
    expect(swiftData).toContain(`snapshotKey = "${PUBLIC_WIDGET_KEY}"`);
    const app = JSON.parse(read('app.json')) as { expo: { ios: { bundleIdentifier: string; entitlements: Record<string, string[]> } } };
    const groups = app.expo.ios.entitlements['com.apple.security.application-groups'];
    expect(groups).toEqual([`group.${app.expo.ios.bundleIdentifier}.widgets`]);
    expect(swiftData).toContain('+ ".widgets"');
  });

  it('one widget product: small + medium only', () => {
    expect(swiftViews.match(/StaticConfiguration\(/g)).toHaveLength(1);
    expect(swiftViews).toMatch(/supportedFamilies\(\[\.systemSmall, \.systemMedium\]\)/);
    expect(swiftViews).not.toMatch(/accessory(Inline|Circular|Rectangular)/);
  });

  it('the widget never touches the network or Supabase', () => {
    for (const code of [swiftData, swiftViews]) expect(code).not.toMatch(/URLSession|supabase|https?:\/\//i);
  });

  it('the widget only opens oyno://open content links (or the app root)', () => {
    expect(swiftData).toMatch(/hasPrefix\("oyno:\/\/open\/"\)/);
    expect(swiftData).toContain('?via=widget_');
  });

  it('bundled fallback text matches the spec', () => {
    expect(swiftData).toContain('"Explore OYNO"');
    expect(swiftData).toContain('"Кыргыз дүйнөсү телефонуңда"');
  });

  it('the bridge writes only after the public-safety check and removes the old v1 key', () => {
    const bridge = strip(read('src/services/widgets/widgetBridge.ts'));
    expect(bridge.indexOf('isWidgetSnapshotPublicSafe(snapshot)')).toBeGreaterThan(-1);
    expect(bridge.indexOf('isWidgetSnapshotPublicSafe(snapshot)')).toBeLessThan(bridge.indexOf('storage.set('));
    expect(bridge).toContain("'oyno.widgetSnapshot.v1'");
    expect(bridge).toMatch(/storage\.remove\(key\)/);
  });

  it('the snapshot hook reads no personal state', () => {
    const hook = strip(read('src/features/appearance/useWidgetSnapshot.ts'));
    expect(hook).not.toMatch(/useAuthStore|useProgressStore|Journal|Passport|useTrailSignals|useHomeRecommendation|SecureStore|supabase/);
  });

  it('widget_opened is a known analytics event and labels exist in KG/RU/EN', () => {
    expect(read('src/services/analytics/analytics.ts')).toContain("'widget_opened'");
    for (const locale of [en, ru, kg] as Record<string, Record<string, unknown>>[]) {
      const widget = locale.widget as Record<string, unknown>;
      for (const key of ['name', 'open', 'fallbackTitle', 'fallbackSubtitle', 'privacyNote']) expect(typeof widget[key]).toBe('string');
    }
    expect((kg.widget as { fallbackSubtitle: string }).fallbackSubtitle).toBe('Кыргыз дүйнөсү телефонуңда');
  });
});
