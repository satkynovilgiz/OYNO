import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, editorial, spacing, textStyles } from '@/theme';

import { AnimatedPressable } from './AnimatedPressable';

type SectionHeaderProps = {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  /** Small count after the title (e.g. "Saved 12"). */
  count?: number;
  actionLabel?: string;
  onPressAction?: () => void;
  /** 'md' = a major section (h2), 'sm' = a light secondary row (title). */
  size?: 'md' | 'sm';
  /** Serif title - editorial screens only. */
  editorialTitle?: boolean;
  /** Horizontal padding (defaults to the screen gutter). Pass 0 inside an
   * already padded container. */
  inset?: number;
};

/**
 * The one section header: optional eyebrow, title (+count), optional one
 * line subtitle, optional tertiary "See all" link. Same spacing and type
 * everywhere it's used (Home, Games, Library).
 */
export function SectionHeader({ title, eyebrow, subtitle, count, actionLabel, onPressAction, size = 'md', editorialTitle = false, inset = spacing.md }: SectionHeaderProps) {
  const titleStyle = size === 'md' ? textStyles.h2 : textStyles.title;
  return (
    <View style={[styles.row, { paddingHorizontal: inset }]}>
      <View style={styles.text}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <View style={styles.titleRow}>
          <Text style={[styles.title, editorialTitle ? editorial(titleStyle) : titleStyle]} accessibilityRole="header">
            {title}
          </Text>
          {count !== undefined ? <Text style={styles.count}>{count}</Text> : null}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionLabel && onPressAction ? <TextLink label={actionLabel} onPress={onPressAction} /> : null}
    </View>
  );
}

/** Tertiary action - forest text + small chevron, 44 pt tall target. */
export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <AnimatedPressable style={styles.link} onPress={onPress} press="strong" hitSlop={6} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.linkText} numberOfLines={1}>
        {label}
      </Text>
      <ChevronRight size={15} color={colors.primary} strokeWidth={2.5} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.sm },
  text: { flex: 1, gap: 2 },
  eyebrow: { ...textStyles.overline, color: colors.accentTerracotta },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  title: { color: colors.textPrimary, flexShrink: 1 },
  count: { ...textStyles.caption, fontWeight: '700', color: colors.accentTerracotta },
  subtitle: { ...textStyles.caption, color: colors.textSecondary },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, flexShrink: 0 },
  linkText: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.primary },
});
