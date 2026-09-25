import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

export type NotificationRowProps = {
  icon: LucideIcon;
  /** Localized category name, read first by screen readers. */
  typeLabel: string;
  title: string;
  body?: string | null;
  /** Already formatted ("18:30", "24-сен."), or null for live items. */
  timeLabel: string | null;
  unread: boolean;
  image?: ImageSourcePropType | null;
  /** Gold medallion for rewarding types (gift, achievement), forest otherwise. */
  accent?: boolean;
  large?: boolean;
  bodyLines?: number;
  onPress: () => void;
};

/**
 * One inbox row (~72-96 pt): small artwork or icon, title, one or two lines
 * of body, time, a quiet unread dot and a chevron. Unread = warmer surface
 * + stronger title + dot (never a big red badge).
 */
export function NotificationRow({ icon: Icon, typeLabel, title, body, timeLabel, unread, image, accent = false, large = false, bodyLines = 2, onPress }: NotificationRowProps) {
  const { t } = useTranslation();
  const a11y = [unread ? t('notificationsScreen.v2.unread') : null, typeLabel, title, body, timeLabel].filter(Boolean).join('. ');
  const size = large ? 52 : 44;
  return (
    <AnimatedPressable style={[styles.row, unread && styles.rowUnread, large && styles.rowLarge]} onPress={onPress} press="soft" accessibilityRole="button" accessibilityLabel={a11y}>
      {image ? (
        <View style={[styles.thumbWrap, { width: size, height: size, borderRadius: size / 3.2 }]}>
          <Image source={image} style={styles.thumb} resizeMode="cover" />
          <View style={[styles.miniIcon, accent && styles.miniIconAccent]}>
            <Icon size={10} color={accent ? colors.textPrimary : colors.textOnDark} strokeWidth={2.5} />
          </View>
        </View>
      ) : (
        <View style={[styles.icon, { width: size, height: size, borderRadius: size / 2 }, accent && styles.iconAccent]}>
          <Icon size={large ? 22 : 19} color={accent ? colors.textPrimary : colors.primary} strokeWidth={2} />
        </View>
      )}
      <View style={styles.text}>
        <View style={styles.topLine}>
          <Text style={[styles.title, unread && styles.titleUnread, large && styles.titleLarge]} numberOfLines={2}>
            {title}
          </Text>
          {timeLabel ? <Text style={styles.time}>{timeLabel}</Text> : null}
        </View>
        {body ? (
          <Text style={styles.body} numberOfLines={bodyLines}>
            {body}
          </Text>
        ) : null}
      </View>
      <View style={styles.trail}>
        {unread ? <View style={styles.dot} /> : <View style={styles.dotSpace} />}
        <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 72, paddingVertical: spacing.sm, paddingLeft: spacing.sm, paddingRight: spacing.xs, borderRadius: cardRadii.compact, backgroundColor: 'transparent' },
  rowUnread: { backgroundColor: colors.surfaceElevated },
  rowLarge: { minHeight: 88 },
  icon: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  iconAccent: { backgroundColor: colors.accentGold },
  thumbWrap: { overflow: 'visible' },
  thumb: { width: '100%', height: '100%', borderRadius: 14, backgroundColor: colors.surfaceMuted },
  miniIcon: { position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.background },
  miniIconAccent: { backgroundColor: colors.accentGold },
  text: { flex: 1, gap: 2, minWidth: 0 },
  topLine: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  title: { ...textStyles.bodyMedium, color: colors.textPrimary, flex: 1 },
  titleUnread: { fontWeight: '800' },
  titleLarge: { fontSize: 17, lineHeight: 23 },
  time: { ...textStyles.small, color: colors.textMuted, marginTop: 2 },
  body: { ...textStyles.caption, fontSize: 14, lineHeight: 19, color: colors.textSecondary },
  trail: { alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentTerracotta },
  dotSpace: { width: 8, height: 8 },
});
