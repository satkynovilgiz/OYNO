import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, radii, spacing, typography } from '@/theme';

import { game3DRegistry } from './gameRegistry';

/** Development-only test bench (Section 6) - lists every 3D game and lets
 * you jump straight into whichever one has a route, skipping the production
 * Games hub. Not linked from production navigation; open it directly at
 * /games/3d-lab during development. */
export function Game3DLabScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}
    >
      <Text style={styles.title}>{t('games3d.lab.title')}</Text>
      <Text style={styles.subtitle}>{t('games3d.lab.subtitle')}</Text>

      {game3DRegistry.map((entry) => (
        <View key={entry.id} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{t(entry.titleKey)}</Text>
            <Text style={styles.rowStatus}>{t(`games3d.status.${entry.status}`)}</Text>
          </View>
          <Button
            label={t('games.play')}
            disabled={!entry.route}
            onPress={() => entry.route && router.push(entry.route as never)}
          />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  rowStatus: {
    ...typography.small,
    color: colors.textSecondary,
  },
});
