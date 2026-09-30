import { useQueries, useQuery } from '@tanstack/react-query';

import { fetchViaRpc } from '@/services/admin/adminService';

import type { AdminCatalog, AdminTranslationRow } from './adminModel';
import { ADMIN_SECTIONS, type AdminLinkTable, type AdminRow } from './sections';

export const ADMIN_TRANSLATIONS_KEY = ['admin_translations'] as const;
export const ADMIN_REVIEW_NOTES_KEY = ['admin_review_notes'] as const;

/** Every RU/EN translation row (drafts included) - editors only. */
export function useAdminTranslations(enabled: boolean) {
  return useQuery({ queryKey: ADMIN_TRANSLATIONS_KEY, queryFn: () => fetchViaRpc<AdminTranslationRow>('admin_get_content_translations'), enabled });
}

export type AdminReviewNote = { id: string; content_type: string; content_id: string; note: string; updated_at: string | null };

export function useAdminReviewNotes(enabled: boolean) {
  return useQuery({ queryKey: ADMIN_REVIEW_NOTES_KEY, queryFn: () => fetchViaRpc<AdminReviewNote>('admin_get_content_review_notes'), enabled });
}

/** Ids of the tables a section links to, loaded with the same queries (and
 * cache keys) as those sections' own lists. A table still loading is left
 * out, so it is never reported as "missing". */
export function useAdminCatalog(tables: readonly AdminLinkTable[]): AdminCatalog {
  const results = useQueries({
    queries: tables.map((table) => {
      const section = ADMIN_SECTIONS.find((candidate) => candidate.id === table)!;
      return { queryKey: ['admin_section', table], queryFn: section.fetch };
    }),
  });
  const catalog: AdminCatalog = {};
  tables.forEach((table, index) => {
    const rows = results[index]?.data as AdminRow[] | undefined;
    if (rows) catalog[table] = new Set(rows.map((row) => String(row.id)));
  });
  return catalog;
}
