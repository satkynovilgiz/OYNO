import { mockGamesList } from '@/features/games/mockData';
import tileCultureBozUy from '@assets/img/OYNO_design/home/tile_culture_bozuy.png';
import tileFoodPlov from '@assets/img/OYNO_design/home/tile_food_plov.png';
import tileMapLake from '@assets/img/OYNO_design/home/tile_map_lake.png';
import tileMusicKomuz from '@assets/img/OYNO_design/home/tile_music_komuz.png';

import type { CultureTileTone } from './types';

// Home's carousel is a preview: the first 5 games from the shared list
// (same order/content as the full Games hub), not a separate data source.
export const mockGames = mockGamesList.slice(0, 5);

/** Visual-only data (no copy - title/subtitle are localized in HomeScreen
 * via `home.cultureTiles.<id>`, since a static string here would freeze at
 * whatever language was active at module load and never update when the
 * user switches language). */
export const cultureTileAssets: { id: string; tone: CultureTileTone; imageSource: typeof tileCultureBozUy }[] = [
  { id: 'culture', tone: 'culture', imageSource: tileCultureBozUy },
  { id: 'food', tone: 'food', imageSource: tileFoodPlov },
  { id: 'music', tone: 'music', imageSource: tileMusicKomuz },
  { id: 'map', tone: 'map', imageSource: tileMapLake },
];
