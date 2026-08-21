import { Compass, Diamond, Mountain, PawPrint, Soup, TreePine, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Card, ProgressBar } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

import type { ExploreProgress, ExploreStatId } from '../types';

type StatDef = { id: ExploreStatId; label: string; icon: LucideIcon };

const STATS: StatDef[] = [
  { id: 'locations', label: 'Локациялар', icon: Mountain },
  { id: 'nature', label: 'Жаратылыш', icon: TreePine },
  { id: 'culture', label: 'Маданият', icon: Diamond },
  { id: 'animals', label: 'Жаныбарлар', icon: PawPrint },
  { id: 'food', label: 'Ашкана', icon: Soup },
  { id: 'quests', label: 'Квесттер', icon: Compass },
];

type RegionProgressCardProps = {
  progress: ExploreProgress;
};

export function RegionProgressCard({ progress }: RegionProgressCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Кыргызстанды изилдөө прогресси</Text>
        <Text style={styles.percent}>{progress.overallPercent}%</Text>
      </View>

      <ProgressBar progress={progress.overallPercent / 100} height={8} />

      <View style={styles.statsRow}>
        {STATS.map(({ id, label, icon: Icon }) => {
          const stat = progress.stats[id];
          return (
            <View key={id} style={styles.statItem}>
              <Icon size={20} color={colors.primary} strokeWidth={1.75} />
              <Text style={styles.statLabel} numberOfLines={1}>
                {label}
              </Text>
              <Text style={styles.statCount}>
                {stat.current} / {stat.total}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  percent: {
    ...typography.h1,
    color: colors.primary,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xxs,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statCount: {
    ...typography.small,
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
