import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Share2, Star } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { NotFoundState } from '@/components/system/NotFoundState';
import { AnimatedPressable, Button, IconButton, MediaImage } from '@/components/ui';
import { Chip } from '@/components/ui/Chip';
import { track } from '@/services/analytics/analytics';
import type { AgeExperience } from '@/services/ageExperience/types';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useShareCard } from '@/services/share/useShareCard';
import { cardRadii, colors, editorial, spacing, textStyles, typography } from '@/theme';

import { gameArt } from '../gamesCatalog';
import { formatMetric, GAME_RECORD_RULES, type GameRecordRule, type GameSessionRecord } from '../records/gameRecords';
import { useGameRecords } from '../records/useGameRecords';
import { gameTitleKey } from '../types';
import { chartPoints, chartRange, chartSummary, gamesOverview, pbSessionId, recentSessions, RECENT_LIMIT, statsShare, summarize, type ChartPoint, type SessionFilter } from './gameStatsModel';

export function statsRoute(gameId: string): string {
  return `/games/stats/${gameId}`;
}

/** /games/stats - each game on its own terms. No overall score, no rating. */
export function GameStatsScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const { records } = useGameRecords();
  const games = gamesOverview(records);

  useEffect(() => {
    track('game_stats_opened');
  }, []);

  return (
    <View style={styles.root}>
      <Header title={t('gameStats.title')} onPressBack={onPressBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Text style={styles.note}>{t('gameStats.recentNote', { count: RECENT_LIMIT })}</Text>
        {games.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('gameRecords.noRecords')}</Text>
            <Button label={t('gameRecords.browseGames')} variant="secondary" onPress={() => router.push('/games' as never)} />
          </View>
        ) : (
          games.map((game) => {
            const rule = GAME_RECORD_RULES[game.gameId];
            const name = t(gameTitleKey(game.listId));
            const parts = [
              game.best !== null ? `${t(rule.best === 'lower' ? 'gameStats.bestTime' : 'gameRecords.personalBest')}: ${formatMetric(rule.primary.unit, game.best, t)}` : null,
              t('gameStats.officialRecent', { count: game.official }),
              game.practice > 0 ? t('gameStats.practiceRecent', { count: game.practice }) : null,
              game.wins !== null ? t(game.gameId === 'kyz_kuumai' ? 'gameStats.catches' : 'gameStats.wins', { count: game.wins }) : null,
            ].filter((part): part is string => !!part);
            const art = gameArt({ id: game.listId }, 'card');
            return (
              <AnimatedPressable
                key={game.gameId}
                style={[styles.row, experience === 'child' && styles.rowChild]}
                onPress={() => router.push(statsRoute(game.gameId) as never)}
                accessibilityRole="button"
                accessibilityLabel={`${name}. ${parts.join('. ')}.`}
              >
                <View style={experience === 'child' ? styles.thumbChild : styles.thumb}>{art ? <MediaImage source={art} /> : null}</View>
                <View style={styles.rowText}>
                  <Text style={[styles.name, experience === 'adult' && styles.editorial]}>{name}</Text>
                  {(experience === 'child' ? parts.slice(0, 2) : parts).map((part) => (
                    <Text key={part} style={styles.meta}>
                      {part}
                    </Text>
                  ))}
                </View>
                <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
              </AnimatedPressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

/** /games/stats/[gameId] - one game: filters, summary, recent chart and rounds. */
export function GameStatsDetailScreen({ gameId, onPressBack }: { gameId: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const { records } = useGameRecords();
  const { share, shareHost } = useShareCard();
  const [filter, setFilter] = useState<SessionFilter>('official');
  const [selected, setSelected] = useState<string | null>(null);
  const rule = GAME_RECORD_RULES[gameId] ?? null;

  useEffect(() => {
    if (rule) track('game_stats_game_opened', { game_id: rule.gameId });
  }, [rule]);

  const sessions = useMemo(() => (rule ? recentSessions(records, rule.gameId, filter) : []), [records, rule, filter]);
  if (!rule) return <NotFoundState onPressBack={onPressBack} />;

  const name = t(gameTitleKey(rule.listId));
  const storedBest = rule.best === 'completion' ? null : (records.best[rule.gameId] ?? null);
  const summary = summarize(rule, sessions);
  const points = chartPoints(rule, sessions, storedBest);
  const pbId = pbSessionId(rule, recentSessions(records, rule.gameId, 'all'), storedBest);
  const fmt = (value: number) => formatMetric(rule.primary.unit, value, t);
  const a11ySummary = chartSummary(points, {
    lead: (count) => t(`gameStats.chartLead.${filter}`, { count }),
    format: (value) => (rule.primary.unit === 'points' || rule.primary.unit === 'goals' ? String(Math.round(value * 10) / 10) : fmt(value)),
    unitSuffix: rule.primary.unit === 'points' ? t('gameStats.pointsWord') : rule.primary.unit === 'goals' ? t('gameStats.goalsWord') : '',
  });

  function shareStats() {
    if (!rule) return;
    const data = statsShare(rule, records);
    track('game_stats_shared', { game_id: rule.gameId });
    const lines = [
      data.best !== null ? `${t(rule.best === 'lower' ? 'gameStats.bestTime' : 'gameRecords.personalBest')}: ${fmt(data.best)}` : null,
      t('gameStats.officialRecent', { count: data.officialRecent }),
      rule.best === 'completion' ? t('gameStats.wins', { count: records.wins[rule.gameId] ?? 0 }) : data.average !== null ? `${t('gameStats.recentAverage')}: ${fmt(data.average)}` : null,
    ].filter((line): line is string => !!line);
    void share({ variant: 'summary', label: t('gameStats.shareLabel'), title: name, imageSource: null, lines }, `${name} - OYNO`);
  }

  const tiles = rule.best === 'completion'
    ? [
        { label: t('gameRecords.result.win'), value: String(summary.wins) },
        { label: t('gameRecords.result.draw'), value: String(summary.draws) },
        { label: t('gameRecords.result.loss'), value: String(summary.losses) },
      ]
    : [
        { label: t('gameStats.roundsPlayed'), value: String(summary.rounds) },
        ...(summary.average !== null ? [{ label: t('gameStats.recentAverage'), value: fmt(summary.average) }] : []),
        ...(storedBest !== null ? [{ label: t(rule.best === 'lower' ? 'gameStats.bestTime' : 'gameRecords.personalBest'), value: fmt(storedBest) }] : []),
        ...(rule.gameId !== 'jaa_atuu' ? [{ label: t(rule.gameId === 'kyz_kuumai' ? 'gameStats.catchesLabel' : 'gameStats.winsLabel'), value: String(summary.wins) }] : []),
      ];

  return (
    <View style={styles.root}>
      <Header title={name} onPressBack={onPressBack} onShare={sessions.length > 0 || storedBest !== null ? shareStats : undefined} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.filters} accessibilityRole="tablist">
          {(['official', 'practice', 'all'] as SessionFilter[]).map((option) => (
            <Chip key={option} label={t(`gameStats.filter.${option}`)} selected={filter === option} onPress={() => setFilter(option)} accessibilityRole="tab" />
          ))}
        </View>
        <Text style={styles.note}>{t('gameStats.recentNote', { count: RECENT_LIMIT })}</Text>
        {filter !== 'official' ? <Text style={styles.note}>{t('gameStats.practiceNeverBest')}</Text> : null}

        <View style={styles.tiles}>
          {tiles.map((tile) => (
            <View key={tile.label} style={[styles.tile, experience === 'child' && styles.tileChild]} accessible accessibilityLabel={`${tile.label}: ${tile.value}`}>
              <Text style={[styles.tileValue, experience === 'adult' && styles.tileValueAdult]}>{tile.value}</Text>
              <Text style={styles.tileLabel}>{tile.label}</Text>
            </View>
          ))}
        </View>
        {rule.gameId === 'kok_boru' ? <Text style={styles.note}>{t('gameStats.kokBoruNoBest')}</Text> : null}
        {rule.gameId === 'kok_boru' && summary.goals.length > 0 ? <Text style={styles.meta}>{t('gameStats.recentGoals', { goals: summary.goals.join(', ') })}</Text> : null}

        {points.length >= 2 ? (
          <View style={styles.chartBlock}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {t('gameStats.recentPerformance')}
            </Text>
            {rule.best === 'lower' ? <Text style={styles.lowerBetter}>↓ {t('gameStats.lowerIsBetter')}</Text> : null}
            <RecentChart points={points} experience={experience} summary={a11ySummary} format={fmt} onSelect={setSelected} selected={selected} pbLabel={t('gameStats.pbShort')} />
            {/* The chart's text equivalent - never the only representation. */}
            <Text style={styles.meta}>{a11ySummary}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle} accessibilityRole="header">
          {t('gameStats.recentRounds')}
        </Text>
        {sessions.length === 0 ? <Text style={styles.meta}>{t('gameStats.noRounds')}</Text> : null}
        {[...sessions].reverse().map((session) => (
          <RoundRow key={session.id} session={session} rule={rule} isPb={session.id === pbId} open={selected === session.id} onPress={() => setSelected(selected === session.id ? null : session.id)} />
        ))}
      </ScrollView>
      {shareHost}
    </View>
  );
}

function Header({ title, onPressBack, onShare }: { title: string; onPressBack: () => void; onShare?: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      {onShare ? <IconButton icon={Share2} shape="roundedSquare" accessibilityLabel={t('gameStats.share')} onPress={onShare} /> : <View style={{ width: 44 }} />}
    </View>
  );
}

function RoundRow({ session, rule, isPb, open, onPress }: { session: GameSessionRecord; rule: GameRecordRule; isPb: boolean; open: boolean; onPress: () => void }) {
  const { t, i18n } = useTranslation();
  const date = new Date(session.completedAt).toLocaleDateString(i18n.language === 'kg' ? 'ky' : i18n.language, { day: 'numeric', month: 'short' });
  const result = t(`gameRecords.result.${session.result}`);
  const metric = Number.isFinite(session.primary) && (rule.best !== 'lower' || session.result === 'win') ? formatMetric(rule.primary.unit, session.primary, t) : null;
  const label = [date, result, metric, session.practice ? t('gameRecords.practice') : null, isPb ? t('gameRecords.personalBest') : null].filter(Boolean).join('. ');
  return (
    <AnimatedPressable style={styles.round} onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={label}>
      <View style={styles.roundMain}>
        <Text style={styles.roundDate}>{date}</Text>
        <Text style={styles.roundResult}>{result}</Text>
        {metric ? <Text style={styles.roundMetric}>{metric}</Text> : null}
        {session.practice ? <Text style={styles.badge}>{t('gameRecords.practice')}</Text> : null}
        {isPb ? (
          <View style={styles.pb}>
            <Star size={12} color={colors.primary} strokeWidth={2.5} />
            <Text style={styles.pbText}>{t('gameStats.pbShort')}</Text>
          </View>
        ) : null}
      </View>
      {open && rule.secondary.length > 0 ? (
        <View style={styles.detail}>
          {rule.secondary.flatMap((metricRule) => {
            const value = session.secondary[metricRule.id];
            return Number.isFinite(value) ? [<Text key={metricRule.id} style={styles.meta}>{`${t(metricRule.labelKey)}: ${formatMetric(metricRule.unit, value, t)}`}</Text>] : [];
          })}
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

const CHART_HEIGHT = 160;

/**
 * Single series, real values in session order, straight segments (no
 * smoothing). Practice rounds are hollow markers; the PB holder gets a
 * star label. The axis is the real value - for times it is NOT labelled
 * "better up": the caption above says lower is better.
 */
function RecentChart({ points, experience, summary, format, onSelect, selected, pbLabel }: { points: ChartPoint[]; experience: AgeExperience; summary: string; format: (value: number) => string; onSelect: (id: string | null) => void; selected: string | null; pbLabel: string }) {
  const { width: screen } = useWindowDimensions();
  const width = Math.min(screen - spacing.md * 2, 640);
  const range = chartRange(points)!;
  const left = experience === 'child' ? 8 : 44;
  const right = 12;
  const top = 18;
  const bottom = 18;
  const x = (index: number) => left + (points.length === 1 ? 0 : (index / (points.length - 1)) * (width - left - right));
  const y = (value: number) => top + (1 - (value - range.min) / (range.max - range.min)) * (CHART_HEIGHT - top - bottom);
  const showAxis = experience !== 'child';
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary}>
      <Svg width={width} height={CHART_HEIGHT}>
        {showAxis
          ? [range.max, range.min].map((value) => (
              <SvgText key={value} x={left - 6} y={y(value) + 4} fontSize={10} fill={colors.textMuted} textAnchor="end">
                {format(Math.round(value))}
              </SvgText>
            ))
          : null}
        <Line x1={left} y1={CHART_HEIGHT - bottom} x2={width - right} y2={CHART_HEIGHT - bottom} stroke={colors.borderSubtle} strokeWidth={1} />
        <Polyline points={points.map((point) => `${x(point.index)},${y(point.value)}`).join(' ')} fill="none" stroke={colors.primary} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point) => (
          <Circle
            key={point.sessionId}
            cx={x(point.index)}
            cy={y(point.value)}
            r={selected === point.sessionId ? 6 : 4.5}
            fill={point.practice ? colors.background : colors.primary}
            stroke={point.practice ? colors.primary : colors.background}
            strokeWidth={2}
            onPress={() => onSelect(selected === point.sessionId ? null : point.sessionId)}
          />
        ))}
        {points
          .filter((point) => point.isPb)
          .map((point) => (
            <SvgText key="pb" x={x(point.index)} y={Math.max(10, y(point.value) - 10)} fontSize={11} fontWeight="700" fill={colors.textPrimary} textAnchor="middle">
              {`★ ${pbLabel}`}
            </SvgText>
          ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h2, flex: 1, color: colors.textPrimary },
  editorial: { ...editorial(textStyles.title) },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  note: { ...textStyles.small, color: colors.textMuted },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  emptyText: { ...textStyles.body, color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  rowChild: { padding: spacing.md },
  thumb: { width: 56, height: 56, borderRadius: cardRadii.compact, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  thumbChild: { width: 84, height: 84, borderRadius: cardRadii.compact, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  rowText: { flex: 1, gap: 2 },
  name: { ...textStyles.title, fontSize: 17, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexGrow: 1, minWidth: 96, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  tileChild: { minWidth: 140, padding: spacing.md },
  tileValue: { ...editorial(textStyles.display), fontSize: 26, lineHeight: 32, color: colors.textPrimary },
  tileValueAdult: { fontSize: 22, lineHeight: 28 },
  tileLabel: { ...textStyles.small, color: colors.textSecondary },
  chartBlock: { gap: spacing.xs },
  sectionTitle: { ...typography.overline, color: colors.accentTerracotta },
  lowerBetter: { ...textStyles.small, fontWeight: '700', color: colors.textPrimary },
  round: { gap: 4, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: colors.borderSubtle },
  roundMain: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  roundDate: { ...textStyles.small, width: 56, color: colors.textMuted },
  roundResult: { ...textStyles.bodyMedium, color: colors.textPrimary },
  roundMetric: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  badge: { ...textStyles.small, paddingHorizontal: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.borderSubtle, color: colors.textSecondary },
  pb: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  pbText: { ...textStyles.small, fontWeight: '700', color: colors.primary },
  detail: { paddingLeft: 56 + spacing.sm, gap: 2 },
});
