import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UserAvatar } from '@/components/avatar/UserAvatar';
import { StoryCompanion } from '@/components/companion/CompanionMoment';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { Button, IconButton } from '@/components/ui';
import { gameTitleKey } from '@/features/games/types';
import { listGameForProgressId } from '@/features/games/gamesCatalog';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { track } from '@/services/analytics/analytics';
import { useShareCard } from '@/services/share/useShareCard';
import { useAvatarStore } from '@/store/useAvatarStore';
import { colors, editorial, radii, spacing, textStyles, typography } from '@/theme';

import { presentMetrics, RECAP_PRESENTATION, type RecapHighlight, type RecapMetric } from './recapModel';
import { buildRecapShareCard } from './recapShare';
import { useOYNORecap } from './useOYNORecap';

/**
 * /profile/recap - My OYNO Recap: private, all time, built from real
 * stored activity only. No ranks, no comparisons with other people.
 * Shared only through the explicit Share recap action (with preview).
 */
export function RecapScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const presentation = RECAP_PRESENTATION[experience];
  const { recap, signedIn } = useOYNORecap();
  // The user's own avatar - never the Story Companion's portrait.
  const avatarConfig = useAvatarStore((state) => (state.hasEverSaved ? state.config : null));
  const { share, shareHost } = useShareCard();

  useEffect(() => {
    // Event name only - no recap numbers leave the device.
    track('recap_opened');
  }, []);

  function highlightText(highlight: RecapHighlight): { title: string; value: string } {
    if (highlight.kind === 'mostPlayed') {
      const game = listGameForProgressId(highlight.gameId);
      return { title: t('recap.mostPlayed'), value: `${game ? t(gameTitleKey(game.id)) : highlight.gameId} · ${t('recap.plays', { count: highlight.plays })}` };
    }
    return { title: t('recap.dailyTitle'), value: t('recap.metric.daily', { count: highlight.count }) };
  }

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.headerTitle} accessibilityRole="header" numberOfLines={1}>
        {t('recap.title')}
      </Text>
    </View>
  );

  if (!recap) {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  const metrics = presentMetrics(recap, experience);
  const highlights = recap.highlights.map((highlight) => ({ highlight, ...highlightText(highlight) }));
  const highlightsBlock =
    highlights.length > 0 ? (
      <View style={styles.highlights}>
        {highlights.map(({ highlight, title, value }) => (
          <View key={highlight.kind} style={styles.highlight} accessible accessibilityLabel={`${title}: ${value}`}>
            <OymoOrnament size={14} color={colors.accentGold} strokeWidth={1.75} />
            <View style={{ flex: 1 }}>
              <Text style={styles.highlightTitle}>{title}</Text>
              <Text style={styles.highlightValue}>{value}</Text>
            </View>
          </View>
        ))}
      </View>
    ) : null;

  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.hero}>
          <View style={styles.heroOrnament} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <OymoOrnament size={120} color="rgba(232,185,61,0.16)" strokeWidth={1} />
          </View>
          <UserAvatar avatarConfig={avatarConfig} size={presentation.avatar === 'large' ? 'large' : 'medium'} />
          <Text style={[styles.heroTitle, presentation.editorial && styles.heroTitleEditorial]}>{t('recap.storyTitle')}</Text>
          <Text style={styles.heroMeta}>{t('recap.allTime')}</Text>
          <Text style={styles.scope}>{signedIn ? t('recap.scopeAccount') : t('recap.scopeDevice')}</Text>
        </View>

        {recap.isEmpty ? (
          <View style={styles.empty}>
            <StoryCompanion surface="recap" moment="empty" />
            <Text style={styles.emptyText}>{t('recap.emptyBody')}</Text>
            <Button label={t('recap.startStory')} onPress={() => router.push('/home' as never)} />
          </View>
        ) : (
          <>
            <StoryCompanion surface="recap" moment="completion" />
            {presentation.highlightsFirst ? highlightsBlock : null}
            <View style={styles.grid}>
              {metrics.map((metric) => {
                const label = t(`recap.label.${metric.id}`);
                return (
                  <View
                    key={metric.id}
                    style={[styles.card, presentation.cardSize === 'large' && styles.cardLarge]}
                    accessible
                    accessibilityLabel={`${label}: ${metric.value}.${metric.source === 'device' && signedIn ? ` ${t('recap.onThisDevice')}.` : ''}`}
                  >
                    <Text style={[styles.cardValue, presentation.cardSize === 'large' && styles.cardValueLarge]}>{metric.value}</Text>
                    <Text style={styles.cardLabel}>{label}</Text>
                    {metric.source === 'device' && signedIn ? <Text style={styles.cardNote}>{t('recap.onThisDevice')}</Text> : null}
                  </View>
                );
              })}
            </View>
            {!presentation.highlightsFirst ? highlightsBlock : null}
            <Button
              label={t('recap.share')}
              variant="secondary"
              onPress={() => {
                track('recap_shared');
                void share({ ...buildRecapShareCard(recap, t), variant: 'story' }, t('recap.shareMessage'));
              }}
            />
            <Text style={styles.private}>{t('recap.privateNote')}</Text>
          </>
        )}
      </ScrollView>
      {shareHost}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  headerTitle: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg, borderRadius: radii.xl, backgroundColor: colors.surfaceFeature, overflow: 'hidden' },
  heroOrnament: { position: 'absolute', right: -24, top: -24 },
  heroTitle: { ...textStyles.h2, color: colors.textOnDark, textAlign: 'center' },
  heroTitleEditorial: { ...editorial(textStyles.h2) },
  heroMeta: { ...typography.overline, color: colors.accentGold },
  scope: { ...textStyles.small, color: 'rgba(251,243,227,0.78)', textAlign: 'center', paddingHorizontal: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { flexGrow: 1, flexBasis: 140, minHeight: 84, justifyContent: 'center', gap: 2, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  cardLarge: { flexBasis: 300, minHeight: 104 },
  cardValue: { ...typography.h1, color: colors.primary, fontVariant: ['tabular-nums'] },
  cardValueLarge: { fontSize: 40, lineHeight: 46 },
  cardLabel: { ...textStyles.bodyMedium, color: colors.textPrimary },
  cardNote: { ...textStyles.small, color: colors.textMuted },
  highlights: { gap: spacing.sm },
  highlight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surfaceElevated },
  highlightTitle: { ...typography.overline, color: colors.accentTerracotta },
  highlightValue: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  empty: { alignItems: 'stretch', gap: spacing.md },
  emptyText: { ...textStyles.body, color: colors.textSecondary, textAlign: 'center' },
  private: { ...textStyles.small, color: colors.textMuted, textAlign: 'center' },
});
