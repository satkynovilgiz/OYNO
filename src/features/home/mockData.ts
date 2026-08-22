import { mockGamesList } from '@/features/games/mockData';
import tileCultureBozUy from '@assets/img/OYNO_design/home/tile_culture_bozuy.png';
import tileFoodPlov from '@assets/img/OYNO_design/home/tile_food_plov.png';
import tileMapLake from '@assets/img/OYNO_design/home/tile_map_lake.png';
import tileMusicKomuz from '@assets/img/OYNO_design/home/tile_music_komuz.png';

import type { CultureTile } from './types';

// Home's carousel is a preview: the first 5 games from the shared list
// (same order/content as the full Games hub), not a separate data source.
export const mockGames = mockGamesList.slice(0, 5);

export const mockCultureTiles: CultureTile[] = [
  { id: 'culture', title: 'Маданият', subtitle: 'Боз үй, оймо, шырдак', tone: 'culture', imageSource: tileCultureBozUy },
  { id: 'food', title: 'Ашкана', subtitle: 'Улуттук тамактар', tone: 'food', imageSource: tileFoodPlov },
  { id: 'music', title: 'Музыка', subtitle: 'Комуз, ырлар, обондор', tone: 'music', imageSource: tileMusicKomuz },
  { id: 'map', title: 'Дүйнө картасы', subtitle: 'Аймактарды изилде', tone: 'map', imageSource: tileMapLake },
];
