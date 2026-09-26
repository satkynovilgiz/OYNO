import type { SupportedLanguage } from '@/i18n';

import type { CultureCategoryRow } from './types';

/**
 * RU/EN names for the 10 culture categories - `culture_categories.title`
 * is a single Kyrgyz-only column, so Russian and English readers used to
 * see "Улуттук кийим", "Ат маданияты"... Kyrgyz always comes from the row
 * (admin edits still show). Craft/instrument names stay the proper noun
 * the rest of the app already uses. Replace with localized DB columns when
 * the schema gets them.
 */
const TITLES: Record<'ru' | 'en', Record<string, string>> = {
  ru: {
    oymo: 'Оймо',
    shyrdak: 'Шырдак',
    komuz: 'Комуз',
    music: 'Музыка',
    clothing: 'Национальная одежда',
    horse: 'Конная культура',
    food: 'Кухня',
    games: 'Национальные игры',
    tradition: 'Обычаи и традиции',
    'boz-uy': 'Боз үй',
  },
  en: {
    oymo: 'Oymo',
    shyrdak: 'Shyrdak',
    komuz: 'Komuz',
    music: 'Music',
    clothing: 'Traditional clothing',
    horse: 'Horse culture',
    food: 'Food',
    games: 'Traditional games',
    tradition: 'Customs and traditions',
    'boz-uy': 'Boz üy',
  },
};

export function cultureCategoryTitle(row: Pick<CultureCategoryRow, 'id' | 'title'>, language: SupportedLanguage): string {
  if (language === 'kg') return row.title;
  return TITLES[language]?.[row.id] ?? row.title;
}

export const LOCALIZED_CATEGORY_IDS = Object.keys(TITLES.en);
