import { Crown, Eye, Gem, Image as ImageIcon, PersonStanding, Scissors, Shirt, Smile } from 'lucide-react-native';

import type { AvatarTab } from './types';

/**
 * The 8 tabs from the product spec, in display order. Several tabs group
 * more than one AvatarConfig field/section under one roof (e.g. "Face"
 * shows the skin tone swatch row plus faceShape/eyebrows/nose/mouth item
 * grids) - matching how the reference screenshots group these, while the
 * underlying catalog (avatarCatalog.ts) still treats each as its own
 * independently-unlockable category.
 */
export const AVATAR_TABS: AvatarTab[] = [
  {
    id: 'face',
    icon: Smile,
    labelKey: 'avatar.categories.face',
    sections: [
      { kind: 'colors', fieldId: 'skinTone', titleKey: 'avatar.sections.skinTone' },
      { kind: 'items', categoryId: 'faceShape', titleKey: 'avatar.sections.faceShape' },
      { kind: 'items', categoryId: 'eyebrows', titleKey: 'avatar.sections.eyebrows' },
      { kind: 'items', categoryId: 'nose', titleKey: 'avatar.sections.nose' },
      { kind: 'items', categoryId: 'mouth', titleKey: 'avatar.sections.mouth' },
    ],
  },
  {
    id: 'body',
    icon: PersonStanding,
    labelKey: 'avatar.categories.body',
    sections: [{ kind: 'items', categoryId: 'body', titleKey: 'avatar.categories.body' }],
  },
  {
    id: 'eyes',
    icon: Eye,
    labelKey: 'avatar.categories.eyes',
    sections: [
      { kind: 'items', categoryId: 'eyes', titleKey: 'avatar.categories.eyes' },
      { kind: 'colors', fieldId: 'eyeColor', titleKey: 'avatar.sections.eyeColor' },
    ],
  },
  {
    id: 'hair',
    icon: Scissors,
    labelKey: 'avatar.categories.hair',
    sections: [
      { kind: 'items', categoryId: 'hair', titleKey: 'avatar.categories.hair' },
      { kind: 'colors', fieldId: 'hairColor', titleKey: 'avatar.sections.hairColor' },
    ],
  },
  {
    id: 'headwear',
    icon: Crown,
    labelKey: 'avatar.categories.headwear',
    sections: [{ kind: 'items', categoryId: 'headwear', titleKey: 'avatar.categories.headwear' }],
  },
  {
    id: 'clothing',
    icon: Shirt,
    labelKey: 'avatar.categories.clothing',
    sections: [{ kind: 'items', categoryId: 'clothing', titleKey: 'avatar.categories.clothing' }],
  },
  {
    id: 'accessory',
    icon: Gem,
    labelKey: 'avatar.categories.accessory',
    sections: [{ kind: 'items', categoryId: 'accessory', titleKey: 'avatar.categories.accessory' }],
  },
  {
    id: 'background',
    icon: ImageIcon,
    labelKey: 'avatar.categories.background',
    sections: [{ kind: 'items', categoryId: 'background', titleKey: 'avatar.categories.background' }],
  },
];
