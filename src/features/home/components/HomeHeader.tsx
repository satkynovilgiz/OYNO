import { Bell, Menu, Search } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import wordmark from '@assets/img/OYNO_design/wordmark.png';

type HomeHeaderProps = {
  hasUnreadNotifications: boolean;
  /** The real signed-in account's display name - omitted for guests, who
   * see the tagline instead of a greeting with no real name to use. */
  greetingName?: string;
  onPressMenu?: () => void;
  onPressSearch?: () => void;
  onPressNotifications?: () => void;
};

/**
 * Home header - the OYNO wordmark + greeting are the visual centre; menu,
 * search and notifications are quieter secondary controls, all the same
 * shape and size (40 pt visual, 44 pt touch). The centre column is kept
 * clear of the side controls on every width, and the greeting stays on one
 * line (scales down rather than wrapping under the logo).
 */
export function HomeHeader({ hasUnreadNotifications, greetingName, onPressMenu, onPressSearch, onPressNotifications }: HomeHeaderProps) {
  const { t } = useTranslation();
  // A short greeting for everyone ("САЛАМ, БЕК!" / guests: the existing guest
  // name) - one line on every width; the long tagline no longer competes.
  const greeting = t('home.header.greeting', { name: greetingName ?? t('common.guestName') });

  return (
    <View style={styles.row}>
      <View style={styles.side}>
        <IconButton icon={Menu} size={40} iconSize={19} accessibilityLabel={t('home.header.menuLabel')} onPress={onPressMenu} />
        <IconButton icon={Search} size={40} iconSize={19} accessibilityLabel={t('search.entryLabel')} onPress={onPressSearch} />
      </View>

      <View style={styles.center} accessible accessibilityRole="header" accessibilityLabel={`OYNO. ${greeting}`}>
        <Image source={wordmark} style={styles.wordmark} resizeMode="contain" />
        <Text style={styles.greeting} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {greeting}
        </Text>
      </View>

      <View style={[styles.side, styles.sideRight]}>
        <IconButton icon={Bell} size={40} iconSize={19} accessibilityLabel={t('home.header.notificationsLabel')} showBadge={hasUnreadNotifications} onPress={onPressNotifications} />
      </View>
    </View>
  );
}

const SIDE_WIDTH = 40 * 2 + spacing.xs;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.xs },
  // Both sides reserve the same width so the logo is truly centred.
  side: { width: SIDE_WIDTH, flexDirection: 'row', gap: spacing.xs },
  sideRight: { justifyContent: 'flex-end' },
  center: { flex: 1, alignItems: 'center', minWidth: 0 },
  wordmark: { width: 132, height: 26 },
  greeting: { ...typography.overline, fontSize: 10, letterSpacing: 0.4, color: colors.textSecondary, marginTop: 2, maxWidth: '100%', textAlign: 'center' },
});
