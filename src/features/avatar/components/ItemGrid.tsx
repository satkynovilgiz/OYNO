import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AVATAR_CATALOG } from '@/services/avatar/avatarCatalog';
import { getAvatarItemArt } from '@/services/avatar/avatarArt';
import type { AvatarCategoryId } from '@/services/avatar/avatarConfig';
import { spacing } from '@/theme';

import { ItemCard } from './ItemCard';

type ItemGridProps = {
  categoryId: AvatarCategoryId;
  icon: LucideIcon;
  selectedId: string;
  unlockedItemIds: ReadonlySet<string>;
  onSelect: (itemId: string) => void;
};

/** Item ids are data-layer identifiers (`hair_10`, `embroideredCap`), not
 * copy - this only feeds ItemCard's accessibilityLabel (there's no visible
 * text on a card, per spec "most options should be understandable
 * visually"), so a screen reader reads "Embroidered Cap" instead of the
 * raw camelCase/underscore id. */
function humanizeItemId(id: string): string {
  return id
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ItemGrid({ categoryId, icon, selectedId, unlockedItemIds, onSelect }: ItemGridProps) {
  const items = AVATAR_CATALOG[categoryId];

  return (
    <View style={styles.grid}>
      {items.map((item, index) => (
        <ItemCard
          key={item.id}
          index={index + 1}
          icon={icon}
          imageSource={getAvatarItemArt(categoryId, item.id)}
          label={humanizeItemId(item.id)}
          selected={item.id === selectedId}
          locked={!unlockedItemIds.has(item.id)}
          onPress={() => onSelect(item.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
