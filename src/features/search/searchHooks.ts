import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { announce } from '@/services/a11y/announce';

/** How long results must stay the same before they are announced. */
export const ANNOUNCE_SETTLE_MS = 900;

/**
 * Announces `message` to screen readers once it has stayed the same for
 * ANNOUNCE_SETTLE_MS - so typing "komuz" is one announcement, not five -
 * and never repeats the message just announced. null = say nothing (and
 * forget the last message, so the same answer is announced again later).
 */
export function useSettledAnnouncement(message: string | null, settleMs = ANNOUNCE_SETTLE_MS) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!message) {
      last.current = null;
      return;
    }
    if (message === last.current) return;
    const timer = setTimeout(() => {
      last.current = message;
      announce(message);
    }, settleMs);
    return () => clearTimeout(timer);
  }, [message, settleMs]);
}

/**
 * A counter that changes when query-cache data arrives or goes (batched),
 * so derived checks that read the cache directly - "is this download's
 * data really there?" - are recomputed, e.g. after startup re-seeding.
 */
export function useQueryCacheVersion(queryClient: QueryClient): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      const relevant = event.type === 'added' || event.type === 'removed' || (event.type === 'updated' && event.action.type === 'success');
      if (!relevant || timer) return;
      timer = setTimeout(() => {
        timer = null;
        setVersion((value) => value + 1);
      }, 100);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [queryClient]);
  return version;
}
