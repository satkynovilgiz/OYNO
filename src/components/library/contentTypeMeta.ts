import { BookOpen, Gamepad2, Landmark, Layers, MapPin, Mountain, Route, Sparkles, type LucideIcon } from 'lucide-react-native';

import type { CatalogContentType } from '@/services/content/contentCatalog';
import type { OfflineKind } from '@/services/offline/offlineManifest';
import { colors } from '@/theme';

/**
 * How each existing content type is presented across "Your OYNO"
 * (Search, Saved, Offline): one label, one small icon and one tonal
 * fallback colour for content without artwork. Purely presentational -
 * the content types themselves come from the shared catalog.
 */
export type ContentTypeMeta = { labelKey: string; icon: LucideIcon; tone: string };

const META: Record<CatalogContentType, ContentTypeMeta> = {
  game: { labelKey: 'library.types.game', icon: Gamepad2, tone: colors.primary },
  nature: { labelKey: 'library.types.place', icon: Mountain, tone: '#3D6E72' },
  region: { labelKey: 'library.types.place', icon: MapPin, tone: '#3D6E72' },
  culture_item: { labelKey: 'library.types.culture', icon: Landmark, tone: colors.accentTerracotta },
  culture_category: { labelKey: 'library.types.culture', icon: Landmark, tone: colors.accentTerracotta },
  culture_material: { labelKey: 'library.types.material', icon: BookOpen, tone: '#7A3226' },
  interactive_experience: { labelKey: 'library.types.experience', icon: Sparkles, tone: '#5B4B7A' },
  trail: { labelKey: 'library.types.trail', icon: Route, tone: '#8B6B3D' },
  collection: { labelKey: 'library.types.collection', icon: Layers, tone: colors.surfaceFeature },
};

export function contentTypeMeta(type: CatalogContentType): ContentTypeMeta {
  return META[type];
}

/** The offline download kind for a content type, if it can be downloaded. */
export function offlineKindFor(type: CatalogContentType): OfflineKind | null {
  if (type === 'nature') return 'nature';
  if (type === 'collection') return 'collection';
  if (type === 'culture_item') return 'culture_item';
  return null;
}
