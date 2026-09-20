import en from './locales/en.json';
import kg from './locales/kg.json';
import ru from './locales/ru.json';

type Locale = 'en' | 'ru' | 'kg';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

const locales: Record<Locale, Record<string, unknown>> = { en, ru, kg };
const keySets: Record<Locale, Set<string>> = {
  en: new Set(flattenKeys(en)),
  ru: new Set(flattenKeys(ru)),
  kg: new Set(flattenKeys(kg)),
};

// Onboarding's slide copy and navigation labels are the exact strings the
// user reads first - a parity gap here is the most visible possible
// localization bug, so it gets its own explicit check on top of the
// generic full-parity sweep below.
const CRITICAL_KEYS = [
  'onboarding.skip',
  'onboarding.next',
  'onboarding.start',
  'onboarding.later',
  'onboarding.slides.welcome.title',
  'onboarding.slides.welcome.description',
  'onboarding.slides.culture.title',
  'onboarding.slides.culture.description',
  'onboarding.slides.play.title',
  'onboarding.slides.play.description',
  'onboarding.slides.journey.title',
  'onboarding.slides.journey.description',
];

describe('locale key parity (en/ru/kg)', () => {
  it.each<[Locale, Locale]>([
    ['en', 'ru'],
    ['en', 'kg'],
    ['ru', 'kg'],
  ])('%s and %s have exactly the same keys', (a, b) => {
    const missingFromB = [...keySets[a]].filter((key) => !keySets[b].has(key));
    const missingFromA = [...keySets[b]].filter((key) => !keySets[a].has(key));
    expect({ missingFromB, missingFromA }).toEqual({ missingFromB: [], missingFromA: [] });
  });

  it.each(CRITICAL_KEYS)('critical key "%s" exists in every locale', (key) => {
    for (const locale of Object.keys(locales) as Locale[]) {
      expect(keySets[locale].has(key)).toBe(true);
    }
  });

  it('has no value accidentally left in a different script than its own locale', () => {
    const cyrillic = /[Ѐ-ӿ]/;
    const latinWord = /\b[A-Za-z]{4,}\b/;
    // Terms that legitimately appear in Latin script inside en/ru/kg text
    // regardless of locale (brand name, borrowed technical terms, and the
    // culturally-specific game/craft names this app intentionally keeps
    // transliterated rather than translating).
    const allowedLatinInNonEnglish =
      /\b(OYNO|Google|Apple|XP|Haptics|ID|PDF|URL|iOS|Android|VS|email|Jaa Atuu|Ordo|Chuko|Kok Boru|Kyz Kuumai|Komuz|Challenge|Cooking World)\b/gi;

    const enKeys = flattenKeys(en);
    for (const key of enKeys) {
      const value = key.split('.').reduce<unknown>((obj, part) => (obj as Record<string, unknown>)?.[part], en);
      if (typeof value === 'string' && cyrillic.test(value)) {
        throw new Error(`en.json key "${key}" contains Cyrillic text: ${JSON.stringify(value)}`);
      }
    }

    for (const [name, locale] of [
      ['ru', ru],
      ['kg', kg],
    ] as const) {
      for (const key of flattenKeys(locale)) {
        const value = key.split('.').reduce<unknown>((obj, part) => (obj as Record<string, unknown>)?.[part], locale);
        if (typeof value !== 'string') continue;
        const stripped = value.replace(/\{\{[^}]+\}\}/g, '').replace(allowedLatinInNonEnglish, '');
        if (latinWord.test(stripped)) {
          throw new Error(`${name}.json key "${key}" contains unexpected Latin-script text: ${JSON.stringify(value)}`);
        }
      }
    }
  });
});
