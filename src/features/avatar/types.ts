import type { LucideIcon } from 'lucide-react-native';

import type { AvatarCategoryId } from '@/services/avatar/avatarConfig';

export type { AvatarConfig, AvatarCategoryId } from '@/services/avatar/avatarConfig';
export type { AvatarItem } from '@/services/avatar/avatarCatalog';

export type AvatarColorFieldId = 'skinTone' | 'hairColor' | 'eyeColor';

/** One section within a tab's content: either a grid of illustrated
 * catalog items for one AvatarCategoryId, or a row of color swatches for
 * one color field. A tab can have more than one section (e.g. the "Face"
 * tab shows the skin tone swatch row above the face-shape item grid). */
export type AvatarTabSection =
  | { kind: 'items'; categoryId: AvatarCategoryId; titleKey: string }
  | { kind: 'colors'; fieldId: AvatarColorFieldId; titleKey: string };

export type AvatarTabId = 'face' | 'body' | 'eyes' | 'hair' | 'headwear' | 'clothing' | 'accessory' | 'background';

export type AvatarTab = {
  id: AvatarTabId;
  icon: LucideIcon;
  labelKey: string;
  sections: AvatarTabSection[];
};
