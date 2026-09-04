import { Modal, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { colors, radii, spacing, typography } from '@/theme';

export type ResultStat = { label: string; value: string };

type ResultScreenProps = {
  visible: boolean;
  title: string;
  stats: ResultStat[];
  onReplay: () => void;
  onExit: () => void;
};

/** Shared result screen (Section 22) - each game supplies its own stat
 * list; this component doesn't assume every game has the same fields. */
export function ResultScreen({ visible, title, stats, onReplay, onExit }: ResultScreenProps) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>

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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,14,8,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    width: 380,
    maxWidth: '85%',
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  statCard: {
    minWidth: 90,
    alignItems: 'center',
    backgroundColor: colors.background,
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
  },
});
