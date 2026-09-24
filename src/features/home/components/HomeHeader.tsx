import { Bell, Menu, Search } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import wordmark from '@assets/img/OYNO_design/wordmark.png';

type HomeHeaderProps = {
  hasUnreadNotifications: boolean;
  /** The real signed-in account's display name - omitted for guests, who
   * see the localized tagline instead of a greeting with no real name
   * (the original Home behaviour: "САЛАМ, БЕК!" only for a real name). */
  greetingName?: string;
  onPressMenu?: () => void;
  onPressSearch?: () => void;
  onPressNotifications?: () => void;
};

/**
 * The original OYNO Home header at its original, full native scale: menu +
 * search (44 pt rounded squares), the full-size OYNO wordmark with the
 * localized greeting / tagline under it, and notifications - the same
 * layout as the original header: the centre takes all remaining width, and
 * the greeting wraps to two centred lines rather than shrinking.
 */
export function HomeHeader({ hasUnreadNotifications, greetingName, onPressMenu, onPressSearch, onPressNotifications }: HomeHeaderProps) {
  const { t } = useTranslation();
  const line = greetingName ? t('home.header.greeting', { name: greetingName }) : t('home.header.tagline');

  return (
    <View style={styles.row}>
      <View style={styles.side}>
        <IconButton icon={Menu} shape="roundedSquare" accessibilityLabel={t('home.header.menuLabel')} onPress={onPressMenu} />
        <IconButton icon={Search} shape="roundedSquare" accessibilityLabel={t('search.entryLabel')} onPress={onPressSearch} />
      </View>

      <View style={styles.center} accessible accessibilityRole="header" accessibilityLabel={`OYNO. ${line}`}>
        <Image source={wordmark} style={styles.wordmark} resizeMode="contain" />
        <Text style={styles.tagline} numberOfLines={2}>
          {line}
        </Text>
      </View>

      <IconButton icon={Bell} accessibilityLabel={t('home.header.notificationsLabel')} showBadge={hasUnreadNotifications} onPress={onPressNotifications} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: spacing.md, gap: spacing.xs },
  side: { flexDirection: 'row', gap: spacing.xs },
  center: { flex: 1, alignItems: 'center', paddingTop: spacing.xxs, minWidth: 0 },
  wordmark: { width: 170, height: 30, maxWidth: '100%' },
  tagline: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.xxs, textAlign: 'center' },
});
