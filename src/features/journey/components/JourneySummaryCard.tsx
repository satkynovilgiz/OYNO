import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { LevelBadge } from '@/components/ui';
import { cardRadii, colors, editorial, spacing, textStyles } from '@/theme';

export type JourneyMetric = { id: string; icon: LucideIcon; label: string; value: number; total?: number };

/**
 * Compact journey overview: who (name + level) and a grid of SEPARATE real
 * counts - places, collections, challenges, trails, memories, achievements.
 * Never summed into one number or turned into a percentage.
 */
export function JourneySummaryCard({ title, subtitle, name, levelLabel, metrics, note, editorialTitle }: { title: string; subtitle: string; name: string; levelLabel: string; metrics: JourneyMetric[]; note?: string; editorialTitle?: boolean }) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <View style={styles.eyebrowRow}>
            <OymoOrnament size={10} color={colors.accentGold} strokeWidth={1.75} />
            <Text style={styles.eyebrow}>OYNO</Text>
          </View>
          <Text style={[styles.title, editorialTitle ? editorial(textStyles.h1) : textStyles.h1]} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.identity}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <LevelBadge label={levelLabel} tone="gold" />
      </View>
      <View style={styles.grid}>
        {metrics.map(({ id, icon: Icon, label, value, total }) => (
          <View key={id} style={styles.metric} accessible accessibilityLabel={`${label}: ${value}${total !== undefined ? ` / ${total}` : ''}`}>
            <Icon size={16} color={colors.accentGold} strokeWidth={2} />
            <Text style={styles.value}>
              {value}
              {total !== undefined ? <Text style={styles.total}>/{total}</Text> : null}
            </Text>
            <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {label}
            </Text>
          </View>
        ))}
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, gap: spacing.sm, borderRadius: cardRadii.hero, backgroundColor: colors.surfaceFeature },
  head: { flexDirection: 'row' },
  headText: { flex: 1, gap: 2 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  eyebrow: { ...textStyles.overline, color: colors.accentGold },
  title: { color: colors.textOnDark },
  subtitle: { ...textStyles.caption, color: colors.textOnDarkSecondary },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textOnDark, flexShrink: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metric: { flexBasis: '31%', flexGrow: 1, gap: 2, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderRadius: cardRadii.chip, backgroundColor: 'rgba(251,243,227,0.07)' },
  value: { ...textStyles.h3, color: colors.textOnDark },
  total: { ...textStyles.caption, color: colors.textOnDarkSecondary },
  label: { ...textStyles.small, fontSize: 11, letterSpacing: -0.1, color: colors.textOnDarkSecondary },
  note: { ...textStyles.small, color: colors.textOnDarkSecondary },
});
