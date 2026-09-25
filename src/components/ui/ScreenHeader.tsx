import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { colors, editorial, spacing, textStyles } from '@/theme';

/**
 * Tab-level screen header (design system v2): a small oymo eyebrow, a
 * controlled h1 title (serif only when `editorialTitle`), one short
 * subtitle line, and a right-hand slot for 1-2 flat IconButtons. Used by
 * Explore / Culture / Profile so every tab opens with the same rhythm.
 */
export function ScreenHeader({ eyebrow, title, subtitle, editorialTitle = false, actions }: { eyebrow?: string; title: string; subtitle?: string; editorialTitle?: boolean; actions?: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        {eyebrow ? (
          <View style={styles.eyebrowRow}>
            <OymoOrnament size={10} color={colors.accentGoldPressed} strokeWidth={1.75} />
            <Text style={styles.eyebrow} numberOfLines={1}>
              {eyebrow}
            </Text>
          </View>
        ) : null}
        <Text style={[styles.title, editorialTitle ? editorial(textStyles.h1) : textStyles.h1]} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.md },
  text: { flex: 1, gap: 3, minWidth: 0 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  eyebrow: { ...textStyles.overline, color: colors.accentGoldPressed },
  title: { color: colors.textPrimary },
  subtitle: { ...textStyles.body, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: spacing.xs, paddingTop: 2 },
});
