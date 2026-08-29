import { Backpack, Search } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { UserAvatar } from '@/components/avatar';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, IconButton } from '@/components/ui';
import { useAppStore } from '@/store/useAppStore';
import { useAvatarStore } from '@/store/useAvatarStore';
import { colors, spacing, typography } from '@/theme';

type ExploreHeaderProps = {
  onPressAvatar?: () => void;
  onPressSearch?: () => void;
  onPressCollection?: () => void;
};

export function ExploreHeader({ onPressAvatar, onPressSearch, onPressCollection }: ExploreHeaderProps) {
  const { t } = useTranslation();
  const characterId = useAppStore((state) => state.characterId) ?? 'bek';
  const avatarConfig = useAvatarStore((state) => (state.hasEverSaved ? state.config : null));

  return (
    <View style={styles.row}>
      <AnimatedPressable
        style={styles.avatarWrap}
        onPress={onPressAvatar}
        accessibilityRole="button"
        accessibilityLabel={t('explore.header.profileLabel')}
      >
        <UserAvatar characterId={characterId} avatarConfig={avatarConfig} size="medium" />
      </AnimatedPressable>

      <View style={styles.center}>
        <View style={styles.titleRow}>
          <OymoOrnament size={16} color={colors.accentBrown} />
          <Text style={styles.title}>{t('explore.header.title')}</Text>
          <OymoOrnament size={16} color={colors.accentBrown} />
        </View>
        <Text style={styles.subtitle}>{t('explore.header.subtitle')}</Text>
      </View>

      <View style={styles.actions}>
        <IconButton
          icon={Search}
          shape="roundedSquare"
          accessibilityLabel={t('explore.header.searchLabel')}
          onPress={onPressSearch}
        />
        <IconButton
          icon={Backpack}
          shape="roundedSquare"
          accessibilityLabel={t('explore.header.collectionLabel')}
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
