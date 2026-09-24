import { mockGamesList } from './mockData';
import {
  FEATURED_CANDIDATES,
  firstSentence,
  gameArt,
  gameSections,
  gameStatsFor,
  isPlayable,
  listGameForProgressId,
  pickFeaturedGame,
  pickPlayAgain,
} from './gamesCatalog';

describe('games catalog presentation', () => {
  it('sections come only from real categories, keep every game once, playable first', () => {
    const sections = gameSections(mockGamesList);
    const ids = sections.flatMap((section) => section.games.map((game) => game.id));
    expect(ids.sort()).toEqual(mockGamesList.map((game) => game.id).sort());
    for (const section of sections) {
      expect(section.games.every((game) => game.category === section.category)).toBe(true);
      const firstLocked = section.games.findIndex((game) => !isPlayable(game));
      if (firstLocked >= 0) expect(section.games.slice(firstLocked).every((game) => !isPlayable(game))).toBe(true);
    }
  });

  it('play again = the most-played playable game, from real stats only (3D ids mapped)', () => {
    expect(pickPlayAgain(mockGamesList, {})).toBeNull();
    const pick = pickPlayAgain(mockGamesList, { kok_boru: { played: 4, won: 2 }, chuko: { played: 1, won: 0 }, 'toguz-korgool': { played: 9, won: 9 } });
    // toguz-korgool isn't playable in OYNO, so it never becomes "play again".
    expect(pick?.game.id).toBe('kok-boru');
    expect(pick?.stat).toEqual({ played: 4, won: 2 });
  });

  it('featured game is playable, has large art, rotates daily and never repeats the play-again game', () => {
    const days = [0, 1, 2, 3].map((day) => pickFeaturedGame(mockGamesList, day)!.id);
    expect(new Set(days).size).toBe(FEATURED_CANDIDATES.length);
    for (const id of days) expect(FEATURED_CANDIDATES).toContain(id);
    for (let day = 0; day < 6; day += 1) expect(pickFeaturedGame(mockGamesList, day, 'kok-boru')!.id).not.toBe('kok-boru');
    expect(pickFeaturedGame(mockGamesList, 5)!.route).toBeTruthy();
  });

  it('every game has art or the designed fallback (never undefined)', () => {
    for (const game of mockGamesList) {
      expect(gameArt(game, 'card')).not.toBeUndefined();
      expect(gameArt(game, 'large')).not.toBeUndefined();
    }
    // Kok Boru has no thumbnail but now uses the Horse Culture photograph.
    expect(gameArt(mockGamesList.find((game) => game.id === 'kok-boru')!, 'card')).toBeTruthy();
  });

  it('maps Game Detail progress ids back to the catalog', () => {
    expect(listGameForProgressId('kyz_kuumai')?.id).toBe('kyz-kuumay');
    expect(listGameForProgressId('ordo')?.id).toBe('ordo');
    expect(gameStatsFor({ id: 'zhaa-atuu' }, { jaa_atuu: { played: 3, won: 1 } })).toEqual({ played: 3, won: 1 });
  });

  it('keeps card descriptions to one sentence', () => {
    expect(firstSentence('Ordo is a circle game. Knock pieces out.')).toBe('Ordo is a circle game.');
    expect(firstSentence('No full stop')).toBe('No full stop');
  });
});
