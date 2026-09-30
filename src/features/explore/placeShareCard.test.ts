import * as fs from 'fs';
import * as path from 'path';

import { isTaglineLocalized, regionTagline } from '@/services/content/regionTaglines';

import { natureSiteCoordinates, natureSiteImages } from './data';
import { buildPlaceShareCard } from './placeShareCard';

const kgTagline = 'Бийик тоодогу көл жана жайкы жайлоо';
const base = { kindLabel: 'Nature site', imageSource: 42, fallbackTone: '#2F5233' };

describe('Explore place share card', () => {
  it('uses the localized name and a tagline that is really in the app language', () => {
    for (const language of ['kg', 'ru', 'en'] as const) {
      const tagline = regionTagline({ id: 'son-kol', tagline: kgTagline }, language);
      const card = buildPlaceShareCard({ ...base, name: `Son-Köl (${language})`, tagline, taglineInAppLanguage: isTaglineLocalized('son-kol', language) });
      expect(card.title).toBe(`Son-Köl (${language})`);
      expect(card.subtitle).toBe(tagline);
      if (language !== 'kg') expect(card.subtitle).not.toBe(kgTagline);
    }
  });

  it('never puts a Kyrgyz fallback tagline under a Russian/English name', () => {
    // All 14 current destinations have RU/EN taglines; a destination added
    // later without them must not get its Kyrgyz line on a RU/EN card.
    expect(isTaglineLocalized('new-destination', 'ru')).toBe(false);
    const tagline = regionTagline({ id: 'new-destination', tagline: kgTagline }, 'ru');
    expect(tagline).toBe(kgTagline);
    const card = buildPlaceShareCard({ ...base, name: 'Новое место', tagline, taglineInAppLanguage: isTaglineLocalized('new-destination', 'ru') });
    expect(card.subtitle).toBeNull();
    expect(isTaglineLocalized('new-destination', 'kg')).toBe(true);
  });

  it('keeps a long tagline short', () => {
    const card = buildPlaceShareCard({ ...base, name: 'X', tagline: 'a '.repeat(80), taglineInAppLanguage: true });
    expect(card.subtitle!.length).toBeLessThanOrEqual(90);
    expect(card.subtitle!.endsWith('…')).toBe(true);
  });

  it('every nature destination has its real photo mapped; the card uses the page hero', () => {
    for (const id of Object.keys(natureSiteCoordinates)) expect(natureSiteImages[id]).toBeTruthy();
    const card = buildPlaceShareCard({ ...base, imageSource: natureSiteImages['son-kol'], name: 'Соң-Көл', tagline: '', taglineInAppLanguage: true });
    expect(card.imageSource).toBe(natureSiteImages['son-kol']);
    const route = fs.readFileSync(path.join(__dirname, '../../app/explore/[id].tsx'), 'utf8');
    expect(route).toMatch(/natureSiteImages\[row\.id\]/);
  });

  it('missing image: the destination tone with the ornament, never a black card', () => {
    const card = buildPlaceShareCard({ ...base, imageSource: null, name: 'Нарын', tagline: '', taglineInAppLanguage: true });
    expect(card.imageSource).toBeNull();
    expect(card.fallbackTone).toBe('#2F5233');
    const shareCard = fs.readFileSync(path.join(__dirname, '../../components/share/ShareCard.tsx'), 'utf8');
    expect(shareCard).toMatch(/style=\{\[styles\.card, \{ backgroundColor: fallbackTone \}\]\}/);
    expect(shareCard).toMatch(/fallbackMark/);
  });

  it('carries public content only - no account, date, journal text or internal id', () => {
    const card = buildPlaceShareCard({ ...base, name: 'Соң-Көл', tagline: kgTagline, taglineInAppLanguage: true });
    expect(Object.keys(card).sort()).toEqual(['fallbackTone', 'imageSource', 'label', 'subtitle', 'title']);
    const text = JSON.stringify(card);
    expect(text).not.toMatch(/son-kol|@|visited|\d{4}-\d{2}-\d{2}/);
  });

  it('the Share button says what it shares', () => {
    const screen = fs.readFileSync(path.join(__dirname, 'LocationDetailScreen.tsx'), 'utf8');
    expect(screen).toMatch(/icon=\{Share2\}[^\n]*accessibilityLabel=\{t\('explore\.locationDetail\.shareNamedLabel', \{ name: locationName \}\)\}/);
  });
});
