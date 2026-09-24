import { Bell, Menu, Search } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/ui';
import { colors, spacing, textStyles } from '@/theme';
import wordmark from '@assets/img/OYNO_design/wordmark.png';

type HomeHeaderProps = {
  hasUnreadNotifications: boolean;
  /** The real signed-in account's display name - omitted for guests, who
   * see the localized tagline instead of a greeting with no real name
   * ("САЛАМ, БЕК!" only for a real name, never "HI, GUEST!"). */
  greetingName?: string;
  onPressMenu?: () => void;
  onPressSearch?: () => void;
  onPressNotifications?: () => void;
};

/** Visual control size - the touch target stays 44 pt via hitSlop. */
const CONTROL = 40;

/**
 * Native-proportioned Home header: light, flat controls (tonal surface +
 * hairline, no floating shadows) on equal-width sides so the OYNO
 * wordmark is truly centred and stays the anchor; the localized greeting
 * or tagline sits under it as a quiet secondary line (wraps to two lines
 * rather than shrinking or truncating in RU/KG).
 */
export function HomeHeader({ hasUnreadNotifications, greetingName, onPressMenu, onPressSearch, onPressNotifications }: HomeHeaderProps) {
  const { t } = useTranslation();
  const line = greetingName ? t('home.header.greeting', { name: greetingName }) : t('home.header.tagline');

  return (
    <View style={styles.row}>
      <View style={styles.side}>
        <IconButton icon={Menu} size={CONTROL} iconSize={20} shape="roundedSquare" elevated={false} accessibilityLabel={t('home.header.menuLabel')} onPress={onPressMenu} />
        <IconButton icon={Search} size={CONTROL} iconSize={20} shape="roundedSquare" elevated={false} accessibilityLabel={t('search.entryLabel')} onPress={onPressSearch} />
      </View>

      <View style={styles.center} accessible accessibilityRole="header" accessibilityLabel={`OYNO. ${line}`}>
        <Image source={wordmark} style={styles.wordmark} resizeMode="contain" />
        <Text style={styles.line} numberOfLines={2}>
          {line}
        </Text>
      </View>

      <View style={[styles.side, styles.sideEnd]}>
        <IconButton icon={Bell} size={CONTROL} iconSize={20} shape="roundedSquare" elevated={false} accessibilityLabel={t('home.header.notificationsLabel')} showBadge={hasUnreadNotifications} onPress={onPressNotifications} />
      </View>
    </View>
  );
}

const SIDE_WIDTH = CONTROL * 2 + spacing.xs;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: spacing.md, gap: spacing.xs },
  side: { width: SIDE_WIDTH, flexDirection: 'row', gap: spacing.xs },
  sideEnd: { justifyContent: 'flex-end' },
  center: { flex: 1, alignItems: 'center', minWidth: 0, paddingTop: 2 },
  wordmark: { width: 132, height: 24, maxWidth: '100%' },
  line: { ...textStyles.overline, fontSize: 10.5, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
});
