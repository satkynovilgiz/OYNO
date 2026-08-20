import { Bell, Menu } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { IconButton } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type HomeHeaderProps = {
  hasUnreadNotifications: boolean;
  onPressMenu?: () => void;
  onPressNotifications?: () => void;
};

export function HomeHeader({ hasUnreadNotifications, onPressMenu, onPressNotifications }: HomeHeaderProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <IconButton
        icon={Menu}
        shape="roundedSquare"
        accessibilityLabel={t('home.header.menuLabel')}
        onPress={onPressMenu}
      />

      <View style={styles.center}>
        <View style={styles.wordmarkRow}>
          <Text style={styles.wordmark}>OYN</Text>
          <View style={styles.oRing}>
            <OymoOrnament size={16} color={colors.primary} strokeWidth={1.4} />
          </View>
        </View>
        <Text style={styles.tagline}>{t('home.header.tagline')}</Text>
      </View>

      <IconButton
        icon={Bell}
        accessibilityLabel={t('home.header.notificationsLabel')}
        showBadge={hasUnreadNotifications}
        onPress={onPressNotifications}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xxs,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordmark: {
    ...typography.wordmark,
    color: colors.primary,
  },
  oRing: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  tagline: {
    ...typography.overline,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
});
