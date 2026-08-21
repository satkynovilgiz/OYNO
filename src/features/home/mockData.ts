import { mockGamesList } from '@/features/games/mockData';

import type { CultureTile } from './types';

// Home's carousel is a preview: the first 5 games from the shared list
// (same order/content as the full Games hub), not a separate data source.
export const mockGames = mockGamesList.slice(0, 5);

export const mockCultureTiles: CultureTile[] = [
  { id: 'culture', title: 'Маданият', subtitle: 'Боз үй, оймо, шырдак', tone: 'culture' },
  { id: 'food', title: 'Ашкана', subtitle: 'Улуттук тамактар', tone: 'food' },
  { id: 'music', title: 'Музыка', subtitle: 'Комуз, ырлар, обондор', tone: 'music' },
  { id: 'map', title: 'Дүйнө картасы', subtitle: 'Аймактарды изилде', tone: 'map' },
];
