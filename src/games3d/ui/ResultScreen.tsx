import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, CompletionSheet } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

export type ResultStat = { label: string; value: string };

type ResultScreenProps = {
  visible: boolean;
  title: string;
  /** A short celebratory line above the stats grid (e.g. "New personal
   * best!") - optional, and deliberately not tied to any one game's idea
   * of what's worth celebrating. */
  banner?: string;
  stats: ResultStat[];
  onReplay: () => void;
  onExit: () => void;
};

/** Shared result screen (Section 22) - each game supplies its own stat
 * list; this component doesn't assume every game has the same fields.
 * Built on `CompletionSheet` (spec "Task 9... reusable foundation with
 * variants") for OYNO's premium completion chrome - ornament row, gold
 * border, restrained scale+fade entrance - instead of the plain white
 * system-alert sheet this used to be. Same props for all 5 games; only
 * the presentation changed. */
export function ResultScreen({ visible, title, banner, stats, onReplay, onExit }: ResultScreenProps) {
  const { t } = useTranslation();

  return (
    <CompletionSheet visible={visible}>
      <Text style={styles.title}>{title}</Text>
      {banner ? <Text style={styles.banner}>{banner}</Text> : null}

      <View style={styles.statsGrid}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Button label={t('games3d.result.replay')} onPress={onReplay} />
        <Button label={t('games3d.result.exit')} variant="secondary" onPress={onExit} />
      </View>
    </CompletionSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  banner: {
    ...typography.small,
    color: colors.accentGoldPressed,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: -spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    width: '100%',
  },
  statCard: {
    minWidth: 90,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  statValue: {
    ...typography.h1,
    color: colors.primary,
  },
  statLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  actions: {
    gap: spacing.sm,
    width: '100%',
  },
});
