import { toggleWallpaperId } from '@/store/useWallpaperFavoritesStore';

describe('toggleWallpaperId', () => {
  it('adds and removes a favorite', () => {
    expect(toggleWallpaperId([], 'son-kol')).toEqual(['son-kol']);
    expect(toggleWallpaperId(['son-kol', 'alay'], 'son-kol')).toEqual(['alay']);
  });
});
