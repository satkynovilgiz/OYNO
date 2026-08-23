import { Bell, Coins, Flame, Search } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { CharacterAvatar } from '@/components/character';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, IconButton } from '@/components/ui';
import { useAppStore } from '@/store/useAppStore';
import { colors, radii, spacing, typography } from '@/theme';

type CultureHeaderProps = {
  streakDays: number;
  coins: number;
  hasUnreadNotifications: boolean;
  onPressAvatar?: () => void;
  onPressSearch?: () => void;
  onPressNotifications?: () => void;
};

export function CultureHeader({
  streakDays,
  coins,
  hasUnreadNotifications,
  onPressAvatar,
  onPressSearch,
  onPressNotifications,
}: CultureHeaderProps) {
  const { t } = useTranslation();
  const characterId = useAppStore((state) => state.characterId) ?? 'bek';

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <View style={styles.identity}>
          <AnimatedPressable
            style={styles.avatarWrap}
            onPress={onPressAvatar}
            accessibilityRole="button"
            accessibilityLabel={t('culture.profileLabel')}
          >
            <CharacterAvatar characterId={characterId} emotion="happy" size={40} />
          </AnimatedPressable>
          <View style={styles.statChip}>
            <Flame size={14} color={colors.danger} strokeWidth={2} />
            <Text style={styles.statText}>{streakDays}</Text>
          </View>
          <View style={styles.statChip}>
            <Coins size={14} color={colors.accentGold} strokeWidth={2} />
            <Text style={styles.statText}>{coins}</Text>
          </View>
        </View>

        <Text style={styles.wordmark}>OYNO</Text>

        <View style={styles.actions}>
          <IconButton icon={Search} accessibilityLabel={t('culture.searchLabel')} onPress={onPressSearch} />
          <IconButton
            icon={Bell}
            accessibilityLabel={t('culture.notificationsLabel')}
            showBadge={hasUnreadNotifications}
            onPress={onPressNotifications}
          />
        </View>
      </View>

      <View style={styles.titleBlock}>
        <View style={styles.titleRow}>
          <OymoOrnament size={18} color={colors.accentBrown} />
          <Text style={styles.title}>{t('culture.title')}</Text>
          <OymoOrnament size={18} color={colors.accentBrown} />
        </View>
        <Text style={styles.subtitle}>{t('culture.subtitle')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  statText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  wordmark: {
    ...typography.h1,
    color: colors.primary,
    letterSpacing: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  titleBlock: {
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.wordmark,
    fontSize: 30,
    color: colors.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
});
