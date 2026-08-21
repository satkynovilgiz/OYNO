import { Backpack, Search } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { CharacterAvatar } from '@/components/character';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, IconButton } from '@/components/ui';
import { useAppStore } from '@/store/useAppStore';
import { colors, spacing, typography } from '@/theme';

type ExploreHeaderProps = {
  onPressAvatar?: () => void;
  onPressSearch?: () => void;
  onPressCollection?: () => void;
};

export function ExploreHeader({ onPressAvatar, onPressSearch, onPressCollection }: ExploreHeaderProps) {
  const characterId = useAppStore((state) => state.characterId);

  return (
    <View style={styles.row}>
      <AnimatedPressable
        style={styles.avatarWrap}
        onPress={onPressAvatar}
        accessibilityRole="button"
        accessibilityLabel="Профиль"
      >
        {characterId ? (
          <CharacterAvatar characterId={characterId} emotion="happy" size={56} />
        ) : (
          <View style={styles.avatarPlaceholder} />
        )}
      </AnimatedPressable>

      <View style={styles.center}>
        <View style={styles.titleRow}>
          <OymoOrnament size={16} color={colors.accentBrown} />
          <Text style={styles.title}>Изилдөө</Text>
          <OymoOrnament size={16} color={colors.accentBrown} />
        </View>
        <Text style={styles.subtitle}>Кыргызстанды изилде, үйрөн, ач!</Text>
      </View>

      <View style={styles.actions}>
        <IconButton icon={Search} shape="roundedSquare" accessibilityLabel="Издөө" onPress={onPressSearch} />
        <IconButton
          icon={Backpack}
          shape="roundedSquare"
          accessibilityLabel="Коллекция"
          onPress={onPressCollection}
        />
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
    gap: spacing.xs,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  avatarPlaceholder: {
    flex: 1,
    borderRadius: 28,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.wordmark,
    fontSize: 28,
    color: colors.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
