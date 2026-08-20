import { StyleSheet, Text, View } from 'react-native';

import { Card, ProgressBar } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type OverallProgressCardProps = {
  discoveredLocations: number;
  totalLocations: number;
  overallPercent: number;
};

/**
 * Only "locations" has a real (if mock) number behind it right now. The
 * spec's fuller breakdown (culture/nature/animals/collectibles/quests) is
 * deferred until those subsystems exist - showing fabricated stats for them
 * would violate the "don't invent" rule just as much as inventing facts.
 */
export function OverallProgressCard({
  discoveredLocations,
  totalLocations,
  overallPercent,
}: OverallProgressCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Кыргызстанды изилдөө</Text>
        <Text style={styles.percent}>{overallPercent}%</Text>
      </View>
      <ProgressBar progress={overallPercent / 100} height={8} />
      <Text style={styles.subtitle}>
        Аймактар: {discoveredLocations} / {totalLocations}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  percent: {
    ...typography.h1,
    color: colors.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
