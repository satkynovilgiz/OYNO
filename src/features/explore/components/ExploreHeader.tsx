import { Backpack, Search, SlidersHorizontal } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type ExploreHeaderProps = {
  onPressSearch?: () => void;
  onPressCollection?: () => void;
  onPressFilter?: () => void;
};

export function ExploreHeader({ onPressSearch, onPressCollection, onPressFilter }: ExploreHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>Изилдөө</Text>
      <View style={styles.actions}>
        <IconButton icon={Search} accessibilityLabel="Издөө" onPress={onPressSearch} />
        <IconButton icon={Backpack} accessibilityLabel="Коллекция" onPress={onPressCollection} />
        <IconButton icon={SlidersHorizontal} accessibilityLabel="Фильтр" onPress={onPressFilter} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
