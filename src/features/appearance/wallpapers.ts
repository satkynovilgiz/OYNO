import type { ImageSourcePropType } from 'react-native';

import bozUyYurtBuilders from '@assets/img/OYNO_design/culture/boz_uy/yurt_builders_alpine_meadow.jpg';
import bozUyYurtCamp from '@assets/img/OYNO_design/culture/boz_uy/yurt_camp.jpg';
import horseEagleHunter from '@assets/img/OYNO_design/culture/horse/eagle_hunter_golden_hour.jpg';
import komuzHero from '@assets/img/OYNO_design/culture/komuz/komuz_hero.jpg';
import oymoWoodcarving from '@assets/img/OYNO_design/culture/oymo/woodcarving_warm_light.jpg';
import shyrdakPattern from '@assets/img/OYNO_design/culture/shyrdak/colors_pattern.jpg';
import shyrdakMosaic from '@assets/img/OYNO_design/culture/shyrdak/mosaic_closeup.jpg';

import { natureSiteImages } from '@/features/explore/data';

/**
 * The one wallpaper catalog - existing OYNO photography already bundled
 * with the app (nature photos come from the same `natureSiteImages`
 * mapping Explore uses; nothing is re-imported or copied). Every image was
 * checked to have no text baked in. No "Seasonal" category: OYNO has no
 * seasonal artwork yet, and it isn't invented here.
 *
 * `portrait`: true when the source image is taller than wide, so it fills a
 * phone screen as-is; landscape photos still work - iOS/Android let the
 * user position them when setting the wallpaper.
 */
export type WallpaperCategory = 'nature' | 'culture' | 'ornament';

export type Wallpaper = {
  id: string;
  image: ImageSourcePropType;
  titleKey: string;
  category: WallpaperCategory;
  featured: boolean;
  portrait: boolean;
};

export const WALLPAPER_CATEGORIES: WallpaperCategory[] = ['nature', 'culture', 'ornament'];

export const wallpapers: Wallpaper[] = [
  { id: 'son-kol', image: natureSiteImages['son-kol'], titleKey: 'appearance.wallpapers.items.sonKol', category: 'nature', featured: true, portrait: true },
  { id: 'ala-too', image: natureSiteImages['ala-too'], titleKey: 'appearance.wallpapers.items.alaToo', category: 'nature', featured: true, portrait: true },
  { id: 'alay', image: natureSiteImages.alay, titleKey: 'appearance.wallpapers.items.alay', category: 'nature', featured: false, portrait: true },
  { id: 'arslanbob', image: natureSiteImages.arslanbob, titleKey: 'appearance.wallpapers.items.arslanbob', category: 'nature', featured: false, portrait: true },
  { id: 'sary-chelek', image: natureSiteImages['sary-chelek'], titleKey: 'appearance.wallpapers.items.saryChelek', category: 'nature', featured: false, portrait: false },
  { id: 'suusamyr', image: natureSiteImages.suusamyr, titleKey: 'appearance.wallpapers.items.suusamyr', category: 'nature', featured: false, portrait: false },
  { id: 'boz-uy', image: bozUyYurtBuilders, titleKey: 'appearance.wallpapers.items.bozUy', category: 'culture', featured: true, portrait: false },
  { id: 'yurt-camp', image: bozUyYurtCamp, titleKey: 'appearance.wallpapers.items.yurtCamp', category: 'culture', featured: false, portrait: false },
  { id: 'komuz', image: komuzHero, titleKey: 'appearance.wallpapers.items.komuz', category: 'culture', featured: false, portrait: false },
  { id: 'horse-culture', image: horseEagleHunter, titleKey: 'appearance.wallpapers.items.horseCulture', category: 'culture', featured: false, portrait: false },
  { id: 'oymo', image: oymoWoodcarving, titleKey: 'appearance.wallpapers.items.oymo', category: 'ornament', featured: true, portrait: false },
  { id: 'shyrdak', image: shyrdakPattern, titleKey: 'appearance.wallpapers.items.shyrdak', category: 'ornament', featured: false, portrait: false },
  { id: 'shyrdak-mosaic', image: shyrdakMosaic, titleKey: 'appearance.wallpapers.items.shyrdakMosaic', category: 'ornament', featured: false, portrait: false },
];

export function getWallpaper(id: string): Wallpaper | undefined {
  return wallpapers.find((wallpaper) => wallpaper.id === id);
}
