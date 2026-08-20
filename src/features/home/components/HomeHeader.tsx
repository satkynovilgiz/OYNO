import { Bell, Menu } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import wordmark from '@assets/img/wordmark.png';

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
        <Image source={wordmark} style={styles.wordmark} resizeMode="contain" />
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
  wordmark: {
    width: 170,
    height: 30,
  },
  tagline: {
    ...typography.overline,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
});
