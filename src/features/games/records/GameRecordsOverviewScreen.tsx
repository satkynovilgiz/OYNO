import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton, MediaImage } from '@/components/ui';
import { summaryOf } from '@/store/useGameRecordsStore';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, radii, spacing, textStyles, typography } from '@/theme';

import { gameArt } from '../gamesCatalog';
import { gameTitleKey } from '../types';
import { formatMetric, GAME_RECORD_RULES } from './gameRecords';
import { useGameRecords } from './useGameRecords';

/**
 * /profile/game-records - every game with records, each on its own terms
 * (no ranking, no comparison between games, no overall rating).
 */
export function GameRecordsOverviewScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { records } = useGameRecords();
  const gameStats = useProgressStore((state) => state.gameStats);

  const rows = Object.values(GAME_RECORD_RULES).flatMap((rule) => {
    const summary = summaryOf(records, rule.gameId);
    const plays = Math.max(gameStats[rule.gameId]?.played ?? 0, summary.sessions);
    if (plays === 0) return [];
    const name = t(gameTitleKey(rule.listId));
    const best = summary.best !== null ? formatMetric(rule.primary.unit, summary.best, t) : null;
    const playsText = t('gameRecords.playedTimes', { count: plays });
    return [{ rule, name, best, playsText, label: `${name}. ${best ? `${t('gameRecords.personalBest')} ${best}. ` : ''}${playsText}.` }];
  });

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {t('gameRecords.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        {rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('gameRecords.noRecords')}</Text>
            <Button label={t('gameRecords.browseGames')} variant="secondary" onPress={() => router.push('/games' as never)} />
          </View>
        ) : (
          rows.map(({ rule, name, best, playsText, label }) => {
            const art = gameArt({ id: rule.listId }, 'card');
            return (
              <AnimatedPressable key={rule.gameId} style={styles.row} onPress={() => router.push(rule.route as never)} accessibilityRole="button" accessibilityLabel={label}>
                <View style={styles.thumb}>{art ? <MediaImage source={art} /> : null}</View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.name}>{name}</Text>
                  {best ? <Text style={styles.best}>{t('gameRecords.bestLine', { value: best })}</Text> : null}
                  <Text style={styles.meta}>{playsText}</Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
              </AnimatedPressable>
            );
          })
        )}
        <Text style={styles.note}>{t('gameRecords.deviceNote')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  emptyText: { ...textStyles.body, color: colors.textSecondary, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  thumb: { width: 56, height: 56, borderRadius: radii.md, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  name: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  best: { ...textStyles.small, color: colors.primary, fontWeight: '700' },
  meta: { ...textStyles.small, color: colors.textSecondary },
  note: { ...textStyles.small, color: colors.textMuted, marginTop: spacing.sm },
});
