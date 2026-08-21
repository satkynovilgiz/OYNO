import { Bell, ChevronLeft, Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { IconButton } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type ProfileHeaderProps = {
  hasUnreadNotifications: boolean;
  onPressBack?: () => void;
  onPressSettings?: () => void;
  onPressNotifications?: () => void;
};

export function ProfileHeader({
  hasUnreadNotifications,
  onPressBack,
  onPressSettings,
  onPressNotifications,
}: ProfileHeaderProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <IconButton
        icon={ChevronLeft}
        shape="roundedSquare"
        accessibilityLabel={t('profile.backLabel')}
        onPress={onPressBack}
      />

      <View style={styles.titleRow}>
        <OymoOrnament size={18} color={colors.accentBrown} />
        <Text style={styles.title}>{t('profile.title')}</Text>
        <OymoOrnament size={18} color={colors.accentBrown} />
      </View>

      <View style={styles.actions}>
        <IconButton icon={Settings} accessibilityLabel={t('profile.settingsLabel')} onPress={onPressSettings} />
        <IconButton
          icon={Bell}
          accessibilityLabel={t('profile.notificationsLabel')}
          showBadge={hasUnreadNotifications}
          onPress={onPressNotifications}
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
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
