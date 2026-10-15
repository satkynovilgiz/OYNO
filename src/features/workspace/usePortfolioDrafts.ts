import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { Portfolio } from '@/features/culture/oymo/portfolio/portfolioModel';
import { entriesFor } from '@/services/drafts/draftRegistry';

/**
 * The current owner's unsaved design-portfolio edits (the portfolio editor's
 * own in-memory draft map - the same source the Recovery Center lists).
 * Re-read whenever the screen is shown, since the map lives outside React.
 */
export function usePortfolioDraftsFor(owner: string): { id: string; title: string; entries: { creationId: string }[] }[] {
  const [version, setVersion] = useState(0);
  useFocusEffect(useCallback(() => setVersion((v) => v + 1), []));
  void version;
  return entriesFor<Portfolio>('portfolio', owner).map(({ rest, value }) => ({ id: rest, title: value.title, entries: value.entries }));
}
