import { Play } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable } from '@/components/ui';
import { useProgressStore } from '@/store/useProgressStore';
import { summaryOf } from '@/store/useGameRecordsStore';
import { colors, radii, spacing, textStyles, typography } from '@/theme';

import { formatMetric, ruleFor, type GameRecordRule, type GameSessionRecord } from './gameRecords';
import { useGameRecords } from './useGameRecords';

const RECENT_SHOWN = 5;

/** "30.09 · 18:20" for Kyrgyz (no reliable Kyrgyz month names in every
 * JS engine - numeric is never wrong), the platform format otherwise. */
export function formatSessionDate(iso: string, language: string): string {
  const date = new Date(iso);
  if (language === 'kg') {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

export function sessionResultText(rule: GameRecordRule, session: GameSessionRecord, t: (key: string, options?: Record<string, unknown>) => string): string {
  return `${t(`gameRecords.result.${session.result}`)} · ${formatMetric(rule.primary.unit, session.primary, t)}`;
}

/**
 * "Your records" on Game Detail: best (by the game's own rule), last
 * result, games played, and the latest rounds with Play again. Compact;
 * nothing renders for a game without record rules. Children see only the
 * headline numbers.
 */
export function GameRecordsSection({ gameId, compact, onPressPlay }: { gameId: string; compact: boolean; onPressPlay: () => void }) {
  const { t, i18n } = useTranslation();
  const rule = ruleFor(gameId);
  const { records } = useGameRecords();
  // Plays and wins: the synced account totals that existed before Game
  // Records (kept as-is); best and recent rounds: this device, from now on.
  const played = useProgressStore((state) => state.gameStats[gameId]?.played ?? 0);
  const won = useProgressStore((state) => state.gameStats[gameId]?.won ?? 0);
  if (!rule) return null;

  const summary = summaryOf(records, gameId);
  const plays = Math.max(played, summary.sessions);
  const recent = (records.recent[gameId] ?? []).slice(0, RECENT_SHOWN);
  const bestText = summary.best !== null ? formatMetric(rule.primary.unit, summary.best, t) : null;
  const latest = summary.latest;

  const cards: { key: string; label: string; value: string }[] = [];
  if (bestText) cards.push({ key: 'best', label: t('gameRecords.personalBest'), value: bestText });
  if (latest && !compact) cards.push({ key: 'last', label: t('gameRecords.lastResult'), value: sessionResultText(rule, latest, t) });
  cards.push({ key: 'plays', label: t('gameRecords.gamesPlayed'), value: String(plays) });
  if (rule.best === 'completion' && won > 0) cards.push({ key: 'wins', label: t('gameDetail.wins'), value: String(won) });

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <OymoOrnament size={11} color={colors.accentGold} strokeWidth={1.75} />
        <Text style={styles.title} accessibilityRole="header">
          {t('gameRecords.yourRecords')}
        </Text>
      </View>

      {plays === 0 ? (
        <Text style={styles.empty}>{t('gameRecords.noRecords')}</Text>
      ) : (
        <View style={styles.cards}>
          {cards.map((card) => (
            <View key={card.key} style={styles.card} accessible accessibilityLabel={`${card.label}: ${card.value}`}>
              <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
                {card.value}
              </Text>
              <Text style={styles.label}>{card.label}</Text>
            </View>
          ))}
        </View>
      )}

      {!compact && recent.length > 0 ? (
        <View style={styles.recent}>
          <Text style={styles.recentTitle} accessibilityRole="header">
            {t('gameRecords.recentGames')}
          </Text>
          {recent.map((session) => {
            const when = formatSessionDate(session.completedAt, i18n.language);
            const result = sessionResultText(rule, session, t);
            return (
              <View key={session.id} style={styles.recentRow} accessible accessibilityLabel={`${when}. ${result}.${session.practice ? ` ${t('gameRecords.practice')}.` : ''}`}>
                <Text style={styles.recentDate}>{when}</Text>
                <Text style={styles.recentResult} numberOfLines={1}>
                  {result}
                </Text>
                {session.practice ? <Text style={styles.practice}>{t('gameRecords.practice')}</Text> : null}
              </View>
            );
          })}
          <AnimatedPressable style={styles.playAgain} onPress={onPressPlay} accessibilityRole="button" accessibilityLabel={t('gameRecords.playAgain')}>
            <Play size={14} color={colors.primary} strokeWidth={2.5} />
            <Text style={styles.playAgainText}>{t('gameRecords.playAgain')}</Text>
          </AnimatedPressable>
          <Text style={styles.note}>{t('gameRecords.deviceNote')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...typography.overline, color: colors.accentTerracotta },
  empty: { ...textStyles.small, color: colors.textSecondary },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { flexGrow: 1, flexBasis: 96, minHeight: 64, justifyContent: 'center', gap: 2, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  value: { ...typography.h2, color: colors.primary, fontVariant: ['tabular-nums'] },
  label: { ...textStyles.small, color: colors.textSecondary },
  recent: { gap: 6 },
  recentTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 32 },
  recentDate: { ...textStyles.small, color: colors.textMuted, width: 104 },
  recentResult: { ...textStyles.small, color: colors.textPrimary, flex: 1, fontWeight: '600' },
  practice: { ...textStyles.small, color: colors.accentTerracotta, fontWeight: '700' },
  playAgain: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surfaceElevated },
  playAgainText: { ...textStyles.small, color: colors.primary, fontWeight: '700' },
  note: { ...textStyles.small, color: colors.textMuted },
});
