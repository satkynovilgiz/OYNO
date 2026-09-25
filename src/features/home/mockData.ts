import { mockGamesList } from '@/features/games/mockData';
// Same subjects as the original banner tiles, but the full-resolution
// OYNO photographs (1100-1536 px) - the old 500x206 banners were
// upscaled ~3x inside the ~250x220 pt Explore cards on 3x iPhones.
import tileCultureBozUy from '@assets/img/OYNO_design/culture/boz_uy/yurt_camp.jpg';
import tileFoodPlov from '@assets/img/OYNO_design/culture/food/yurt_feast_lake.jpg';
import tileMusicKomuz from '@assets/img/OYNO_design/culture/music/yurt_and_instruments.jpg';
import tileMapLake from '@assets/img/OYNO_design/explore/nature/son_kol.jpg';

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
