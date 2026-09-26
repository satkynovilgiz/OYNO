import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { SupportedLanguage } from '@/i18n';
import { supabase } from '@/services/supabase/client';

import { buildTranslationIndex, EMPTY_TRANSLATIONS, type TranslationIndex, type TranslationRow } from './localizedContent';

export const CONTENT_TRANSLATIONS_KEY = ['content_translations'] as const;

/** All reviewed RU/EN translations (small: a few thousand short rows at
 * most). Row-level security only returns `status = 'reviewed'`. */
export async function fetchContentTranslations(): Promise<TranslationRow[]> {
  const { data, error } = await supabase.from('content_translations').select('content_type, content_id, language, field, value');
  if (error) throw error;
  return (data ?? []) as TranslationRow[];
}

/** Same data for an offline download. A database without the table yet
 * (migration not applied) stores "no translations" instead of failing the
 * whole download; any other error still fails it honestly. */
export async function fetchContentTranslationsForOffline(): Promise<TranslationRow[]> {
  try {
    return await fetchContentTranslations();
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === '42P01' || code === 'PGRST205') return [];
    throw error;
  }
}

/** Index + current language. If translations can't load (offline before
 * first fetch, or the table isn't there yet) the index is empty and every
 * resolver falls back to Kyrgyz - and says so. */
export function useContentLocalization(): { language: SupportedLanguage; index: TranslationIndex } {
  const { i18n } = useTranslation();
  const { data } = useQuery({ queryKey: CONTENT_TRANSLATIONS_KEY, queryFn: fetchContentTranslations, staleTime: 10 * 60 * 1000, retry: 1 });
  const index = useMemo(() => (data ? buildTranslationIndex(data) : EMPTY_TRANSLATIONS), [data]);
  return { language: i18n.language as SupportedLanguage, index };
}

/** A stable `select` for react-query that localizes each row. */
export function useLocalizer<T>(localize: (row: T, language: SupportedLanguage, index: TranslationIndex) => T) {
  const { language, index } = useContentLocalization();
  const one = useCallback((row: T) => localize(row, language, index), [localize, language, index]);
  const many = useCallback((rows: T[]) => rows.map(one), [one]);
  const maybe = useCallback((row: T | null) => (row ? one(row) : row), [one]);
  return { one, many, maybe };
}
