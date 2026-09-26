import type { SupportedLanguage } from '@/i18n';

import type { ExploreRegionRow } from './types';

/**
 * RU/EN translations of `explore_regions.tagline`, which is a single
 * Kyrgyz-only column in the database. Kyrgyz always comes from the row
 * itself (so admin edits still show), RU/EN from here - reviewed,
 * meaning-for-meaning translations of the current Kyrgyz taglines, not new
 * claims. Claims awaiting verification are listed in docs/CONTENT_AUDIT.md
 * ("Needs Human Verification"). Replace with localized DB columns when the
 * schema gets them.
 */
const TAGLINES: Record<'ru' | 'en', Record<string, string>> = {
  ru: {
    bishkek: 'Столица Кыргызстана',
    chuy: 'Северная область у подножия Кыргызского Ала-Тоо',
    'ysyk-kol': 'Жемчужина Кыргызстана',
    naryn: 'Самая высокогорная область Кыргызстана',
    talas: 'Священная земля эпоса «Манас»',
    osh: 'Один из древнейших городов Центральной Азии',
    'jalal-abad': 'Край целебных источников',
    batken: 'Самая молодая область Кыргызстана',
    'son-kol': 'Высокогорное озеро ледникового происхождения',
    suusamyr: 'Широкая долина летних пастбищ',
    alay: 'Край пика Ленина',
    'sary-chelek': 'Объект Всемирного наследия ЮНЕСКО',
    arslanbob: 'Крупнейший в мире ореховый лес',
    'ala-too': 'Великий хребет Северного Тянь-Шаня',
  },
  en: {
    bishkek: 'The capital of Kyrgyzstan',
    chuy: 'A northern region at the foot of the Kyrgyz Ala-Too',
    'ysyk-kol': 'The pearl of Kyrgyzstan',
    naryn: "Kyrgyzstan's highest-lying region",
    talas: 'Sacred land of the Manas epic',
    osh: 'One of the oldest cities in Central Asia',
    'jalal-abad': 'A region of healing springs',
    batken: "Kyrgyzstan's youngest region",
    'son-kol': 'A high mountain lake formed by glaciers',
    suusamyr: 'A wide valley of summer pastures',
    alay: 'Home of Lenin Peak',
    'sary-chelek': 'A UNESCO World Heritage site',
    arslanbob: "The world's largest walnut forest",
    'ala-too': 'A great range of the Northern Tian Shan',
  },
};

export function regionTagline(row: Pick<ExploreRegionRow, 'id' | 'tagline'>, language: SupportedLanguage): string {
  if (language === 'kg') return row.tagline;
  return TAGLINES[language]?.[row.id] ?? row.tagline;
}

/** Tests/audit: ids with RU+EN taglines. */
export const LOCALIZED_TAGLINE_IDS = Object.keys(TAGLINES.en);
