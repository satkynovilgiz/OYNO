import akTerekKokTerek from '@assets/img/games/akTerekKokTerek/thumbnail.png';
import arkanTartysh from '@assets/img/games/arkanTartysh/thumbnail.png';
import beshbarmak from '@assets/img/games/beshbarmak/thumbnail.png';
import beshTash from '@assets/img/games/beshTash/thumbnail.png';
import chuko from '@assets/img/games/chuko/thumbnail.png';
import cookingWorld from '@assets/img/games/cookingWorld/thumbnail.png';
import kyzKuumay from '@assets/img/games/kyzKuumay/thumbnail.png';
import ordo from '@assets/img/games/ordo/thumbnail.png';
import toguzKorgool from '@assets/img/games/toguzKorgool/thumbnail.png';
import zhaaAtuu from '@assets/img/games/zhaaAtuu/thumbnail.png';
import zholukTashtamay from '@assets/img/games/zholukTashtamay/thumbnail.png';

import type { GameListItem } from './types';

export const mockGamesList: GameListItem[] = [
  {
    id: 'toguz-korgool',
    name: 'Тогуз коргоол',
    thumbnail: toguzKorgool,
    category: 'logic',
    difficulty: 'medium',
    players: { kind: 'exact', count: 2 },
    duration: { minMinutes: 10, maxMinutes: 20 },
    featured: true,
  },
  {
    id: 'chuko',
    name: 'Чүкө',
    thumbnail: chuko,
    category: 'national',
    difficulty: 'easy',
    players: { kind: 'open', min: 1 },
    duration: { minMinutes: 5, maxMinutes: 10 },
    route: '/games/chuko',
  },
  {
    id: 'ordo',
    name: 'Ордо',
    thumbnail: ordo,
    category: 'national',
    difficulty: 'medium',
    players: { kind: 'exact', count: 2 },
    duration: { minMinutes: 5, maxMinutes: 25 },
    route: '/games/ordo',
  },
  {
    id: 'besh-tash',
    name: 'Беш таш',
    thumbnail: beshTash,
    category: 'skill',
    difficulty: 'easy',
    players: { kind: 'exact', count: 1 },
    duration: { minMinutes: 5, maxMinutes: 10 },
    route: '/games/besh-tash',
  },
  {
    id: 'arkan-tartysh',
    name: 'Аркан тартыш',
    thumbnail: arkanTartysh,
    category: 'team',
    difficulty: 'medium',
    players: { kind: 'team' },
    duration: { minMinutes: 10, maxMinutes: 15 },
    featured: true,
  },
  {
    id: 'ak-terek-kok-terek',
    name: 'Ак терек — көк терек',
    thumbnail: akTerekKokTerek,
    category: 'team',
    difficulty: 'easy',
    players: { kind: 'team' },
    duration: { minMinutes: 10, maxMinutes: 15 },
  },
  {
    id: 'zholuk-tashtamay',
    name: 'Жоолук таштамай',
    thumbnail: zholukTashtamay,
    category: 'national',
    difficulty: 'easy',
    players: { kind: 'open', min: 3 },
    duration: { minMinutes: 10, maxMinutes: 15 },
  },
  {
    id: 'zhaa-atuu',
    name: 'Жаа атуу',
    thumbnail: zhaaAtuu,
    category: 'skill',
    difficulty: 'medium',
    players: { kind: 'exact', count: 1 },
    duration: { minMinutes: 5, maxMinutes: 10 },
    route: '/games/jaa-atuu',
  },
  {
    id: 'kyz-kuumay',
    name: 'Кыз куумай',
    thumbnail: kyzKuumay,
    category: 'horse',
    difficulty: 'medium',
    players: { kind: 'open', min: 2 },
    duration: { minMinutes: 15, maxMinutes: 20 },
    route: '/games/kyz-kuumai',
  },
  {
    id: 'beshbarmak-challenge',
    name: 'Бешбармак Challenge',
    thumbnail: beshbarmak,
    category: 'cooking',
    difficulty: 'easy',
    players: { kind: 'exact', count: 1 },
    duration: { minMinutes: 15, maxMinutes: 20 },
  },
  {
    id: 'cooking-world',
    name: 'Бой үй Cooking World',
    thumbnail: cookingWorld,
    category: 'cooking',
    difficulty: 'easy',
    players: { kind: 'exact', count: 1 },
    duration: { minMinutes: 10, maxMinutes: 20 },
  },
];
