import type { QueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/store/useAuthStore';

/**
 * Query roots whose data belongs to the signed-in person (row-level
 * security decides what the server returns), so their cache keys carry no
 * user id. Everything else in the query cache is public content.
 */
export const USER_SCOPED_QUERY_ROOTS = ['admin_role', 'admin_section', 'oymo_creations', 'shyrdak_creation'] as const;

export function clearUserScopedQueries(client: QueryClient): void {
  client.removeQueries({ predicate: (query) => (USER_SCOPED_QUERY_ROOTS as readonly string[]).includes(String(query.queryKey[0])) });
}

/**
 * Drops user-scoped cache the moment the account changes (sign-in,
 * sign-out, switching accounts, session lost) - synchronously on the store
 * change, before any screen can render the previous person's cached rows.
 * Returns the unsubscribe function.
 */
export function bindUserScopedCache(client: QueryClient): () => void {
  let owner = useAuthStore.getState().user?.id ?? null;
  return useAuthStore.subscribe((state) => {
    const next = state.user?.id ?? null;
    if (next === owner) return;
    owner = next;
    clearUserScopedQueries(client);
  });
}
