import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, textStyles } from '@/theme';

import { ProgressBar } from './ProgressBar';

/**
 * Progress primitives (design system v2), shared by Home, Profile, Games
 * and Daily without forcing them to look identical:
 *   LevelBadge       "Level 3" pill - forest (calm) or gold (rewarding)
 *   StatPill         icon + real number, informational (not a button)
 *   ProgressSummary  label + optional value text + thin bar
 */
export function LevelBadge({ label, tone = 'forest' }: { label: string; tone?: 'forest' | 'gold' }) {
  const gold = tone === 'gold';
  return (
    <View style={[styles.level, gold && styles.levelGold]}>
      <Text style={[styles.levelText, gold && styles.levelTextGold]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function StatPill({ icon: Icon, value, color, label, accessibilityLabel }: { icon: LucideIcon; value: string | number; color: string; label?: string; accessibilityLabel?: string }) {
  const a11y = accessibilityLabel ?? (label ? `${value} ${label}` : undefined);
  return (
    <View style={styles.stat} accessible={!!a11y} accessibilityLabel={a11y}>
      <Icon size={15} color={color} strokeWidth={2.25} />
      <Text style={styles.statText}>{value}</Text>
      {label ? <Text style={styles.statLabel}>{label}</Text> : null}
    </View>
  );
}

export function ProgressSummary({ label, value, progress, height = 6, fillColor, trackColor }: { label?: string; value?: string; progress: number; height?: number; fillColor?: string; trackColor?: string }) {
  return (
    <View style={styles.summary}>
      {label || value ? (
        <View style={styles.summaryRow}>
          {label ? (
            <Text style={styles.summaryLabel} numberOfLines={1}>
              {label}
            </Text>
          ) : null}
          {value ? <Text style={styles.summaryValue}>{value}</Text> : null}
        </View>
      ) : null}
      <ProgressBar progress={progress} height={height} fillColor={fillColor} trackColor={trackColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  level: { alignSelf: 'flex-start', paddingHorizontal: spacing.xs + 2, paddingVertical: 3, borderRadius: radii.pill, backgroundColor: colors.primary },
  levelGold: { backgroundColor: colors.accentGold },
  levelText: { ...textStyles.small, color: colors.textOnDark },
  levelTextGold: { color: colors.textPrimary },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.xs + 2, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted },
  statText: { ...textStyles.caption, fontWeight: '700', color: colors.textPrimary },
  statLabel: { ...textStyles.caption, color: colors.textSecondary },
  summary: { gap: 6 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.xs },
  summaryLabel: { ...textStyles.caption, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  summaryValue: { ...textStyles.caption, fontWeight: '600', color: colors.textSecondary },
});
