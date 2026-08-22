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
    players: '1–2 оюнчу',
    duration: '10–20 мүнөт',
    featured: true,
  },
  {
    id: 'chuko',
    name: 'Чүкө',
    thumbnail: chuko,
    category: 'national',
    difficulty: 'easy',
    players: '1+ оюнчу',
    duration: '5–10 мүнөт',
  },
  {
    id: 'ordo',
    name: 'Ордо',
    thumbnail: ordo,
    category: 'national',
    difficulty: 'medium',
    players: '2 оюнчу',
    duration: '5–25 мүнөт',
  },
  {
    id: 'besh-tash',
    name: 'Беш таш',
    thumbnail: beshTash,
    category: 'skill',
    difficulty: 'easy',
    players: '1 оюнчу',
    duration: '5–10 мүнөт',
    route: '/games/besh-tash',
  },
  {
    id: 'arkan-tartysh',
    name: 'Аркан тартыш',
    thumbnail: arkanTartysh,
    category: 'team',
    difficulty: 'medium',
    players: 'Команда',
    duration: '10–15 мүнөт',
    featured: true,
  },
  {
    id: 'ak-terek-kok-terek',
    name: 'Ак терек — көк терек',
    thumbnail: akTerekKokTerek,
    category: 'team',
    difficulty: 'easy',
    players: 'Команда',
    duration: '10–15 мүнөт',
  },
  {
    id: 'zholuk-tashtamay',
    name: 'Жоолук таштамай',
    thumbnail: zholukTashtamay,
    category: 'national',
    difficulty: 'easy',
    players: '3+ оюнчу',
    duration: '10–15 мүнөт',
  },
  {
    id: 'zhaa-atuu',
    name: 'Жаа атуу',
    thumbnail: zhaaAtuu,
    category: 'skill',
    difficulty: 'medium',
    players: '1 оюнчу',
    duration: '5–10 мүнөт',
  },
  {
    id: 'kyz-kuumay',
    name: 'Кыз куумай',
    thumbnail: kyzKuumay,
    category: 'horse',
    difficulty: 'medium',
    players: '2+ оюнчу',
    duration: '15–20 мүнөт',
  },
  {
    id: 'beshbarmak-challenge',
    name: 'Бешбармак Challenge',
    thumbnail: beshbarmak,
    category: 'cooking',
    difficulty: 'easy',
    players: '1 оюнчу',
    duration: '15–20 мүнөт',
  },
  {
    id: 'cooking-world',
    name: 'Бой үй Cooking World',
    thumbnail: cookingWorld,
    category: 'cooking',
    difficulty: 'easy',
    players: '1 оюнчу',
    duration: '10–20 мүнөт',
  },
];
