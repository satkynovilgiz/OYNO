import { router } from 'expo-router';
import { Check, ChevronLeft, Share2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { Button, IconButton, MediaImage } from '@/components/ui';
import { cultureItemImages } from '@/features/culture/data';
import { gameArt } from '@/features/games/gamesCatalog';
import { formatMetric, GAME_RECORD_RULES } from '@/features/games/records/gameRecords';
import { useGameRecords } from '@/features/games/records/useGameRecords';
import { gameTitleKey } from '@/features/games/types';
import { usePathSignals } from '@/features/learn/usePathSignals';
import { getAchievement, profileAchievements } from '@/features/profile/data';
import { track } from '@/services/analytics/analytics';
import type { AgeExperience } from '@/services/ageExperience/types';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureMaterials } from '@/services/content/cultureService';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { useShareCard } from '@/services/share/useShareCard';
import { ownerPins, useAchievementShowcaseStore } from '@/store/useAchievementShowcaseStore';
import { useChallengeStore } from '@/store/useChallengeStore';
import { ownerStudy, useGlossaryStudyStore } from '@/store/useGlossaryStudyStore';
import { useProgressStore } from '@/store/useProgressStore';
import { ownerReading, useReadingStore } from '@/store/useReadingStore';
import { cardRadii, colors, editorial, radii, spacing, textStyles, typography } from '@/theme';

import { buildPortfolio, DEFAULT_SHARE, pathA11yLabel, portfolioShare, SHAREABLE_CATEGORIES, type PortfolioPath, type ShareCategory } from './portfolioModel';

const CATALOG_IDS = profileAchievements.map((achievement) => achievement.id);

/** The current owner's portfolio, re-derived the moment the account changes. */
function usePortfolio() {
  const { signals, owner } = usePathSignals();
  const challengeResults = useChallengeStore((state) => state.results);
  const reading = ownerReading(useReadingStore((state) => state.saved), owner);
  const study = ownerStudy(useGlossaryStudyStore((state) => state.saved), owner);
  const { records } = useGameRecords();
  const progressOwner = useProgressStore((state) => state.loadedOwner);
  const unlocked = useProgressStore((state) => state.unlockedAchievementIds) as string[];
  const pins = ownerPins(useAchievementShowcaseStore((state) => state.saved), owner);
  const items = useAllCultureItems();
  const materials = useCultureMaterials();

  useEffect(() => {
    void useAchievementShowcaseStore.getState().load();
  }, []);

  // Achievements belong to the loaded progress owner - never show another account's.
  const earned = progressOwner === owner ? unlocked.filter((id) => CATALOG_IDS.includes(id)) : [];
  const portfolio = useMemo(
    () =>
      buildPortfolio({
        signals,
        challengeResults,
        reading,
        // Unknown until content loads: kept (never dropped on a slow network).
        readingExists: (type, id) => (type === 'culture_item' ? !items.data || items.data.some((item) => item.id === id) : !materials.data || materials.data.some((material) => material.id === id)),
        study,
        records,
        earnedAchievementIds: earned,
        pinnedAchievementIds: pins,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signals, challengeResults, reading, study, records, earned.join(','), pins, items.data, materials.data],
  );
  const titleOf = (id: string) => items.data?.find((item) => item.id === id)?.title ?? null;
  return { portfolio, titleOf, owner };
}

/**
 * /profile/portfolio - "My Learning Portfolio": a private summary of
 * evidence OYNO already records for this person. Not a timeline, not a
 * leaderboard; no XP, no rank, no invented dates.
 */
export function PortfolioScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const { portfolio, titleOf } = usePortfolio();
  const { share, shareHost } = useShareCard();
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    track('learning_portfolio_opened');
  }, []);

  const isChild = experience === 'child';
  const isAdult = experience === 'adult';
  const steps = (done: number, total: number) => t('portfolio.steps', { done, total });

  function shareSelected(include: Record<ShareCategory, boolean>) {
    setShareOpen(false);
    const summary = portfolioShare(portfolio, include);
    if (summary.lines.length === 0) return;
    track('learning_portfolio_shared');
    void share(
      {
        variant: 'summary',
        label: t('portfolio.shareLabel'),
        title: t('portfolio.shareTitle'),
        imageSource: null,
        lines: summary.lines.map((line) => t(`portfolio.shareLine.${line.key}`, { count: line.count })),
        featured: summary.featured.map((entry) => t(entry.titleKey)),
        featuredLabel: summary.featured.length ? t('portfolio.featured') : null,
      },
      t('portfolio.shareTitle'),
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={[styles.headerTitle, isAdult && styles.editorial]} accessibilityRole="header" numberOfLines={1}>
          {t('portfolio.title')}
        </Text>
        {!portfolio.isEmpty ? <IconButton icon={Share2} shape="roundedSquare" accessibilityLabel={t('portfolio.share')} onPress={() => setShareOpen(true)} /> : <View style={{ width: 44 }} />}
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Text style={styles.private}>{t('portfolio.privateNote')}</Text>

        {portfolio.isEmpty ? (
          <View style={styles.empty}>
            <OymoOrnament size={48} color={colors.accentGoldPressed} strokeWidth={1.5} />
            <Text style={[styles.emptyText, isChild && styles.emptyTextChild]}>{t('portfolio.empty')}</Text>
            <Button label={t('portfolio.startLearning')} variant="accent" size={isChild ? 'lg' : 'md'} onPress={() => router.push('/study' as never)} />
            <Button label={t('portfolio.exploreCulture')} variant="secondary" onPress={() => router.push('/culture' as never)} />
          </View>
        ) : null}

        {portfolio.completedPaths.length + portfolio.activePaths.length > 0 ? (
          <Section title={t('portfolio.sections.paths')}>
            {[...portfolio.completedPaths, ...portfolio.activePaths].map((path) => (
              <PathCard
                key={path.id}
                path={path}
                title={t(path.titleKey)}
                experience={experience}
                status={path.done ? t('portfolio.completed') : t('portfolio.inProgress')}
                steps={steps(path.completed, path.total)}
                a11y={pathA11yLabel(t(path.titleKey), path, { learningPath: t('portfolio.learningPath'), completed: t('portfolio.completed'), inProgress: t('portfolio.inProgress'), steps })}
              />
            ))}
          </Section>
        ) : null}

        {portfolio.quizzes.length > 0 ? (
          <Section title={t('portfolio.sections.quizzes')}>
            {portfolio.quizzes.map((quiz) => {
              const best = quiz.best <= quiz.lastTotal && quiz.lastTotal > 0 ? `${quiz.best} / ${quiz.lastTotal}` : String(quiz.best);
              const label = `${t(quiz.titleKey)}. ${t('portfolio.best', { value: best })}. ${t('portfolio.attempts', { count: quiz.attempts })}.`;
              return (
                <Card key={quiz.id} image={cultureItemImages[quiz.heroItemId]?.[0] ?? null} experience={experience} a11y={label}>
                  <Text style={styles.cardTitle}>{t(quiz.titleKey)}</Text>
                  <Text style={styles.meta}>{t('portfolio.best', { value: best })}</Text>
                  <Text style={styles.meta}>{t('portfolio.attempts', { count: quiz.attempts })}</Text>
                </Card>
              );
            })}
          </Section>
        ) : null}

        {portfolio.reading ? (
          <Section title={t('portfolio.sections.reading')}>
            <Stats experience={experience} items={[{ label: t('portfolio.articlesCompleted'), value: portfolio.reading.completed }, { label: t('portfolio.currentlyReading'), value: portfolio.reading.inProgress }]} />
            {portfolio.reading.recentlyCompletedIds.flatMap((id) => {
              const title = titleOf(id);
              return title ? [<Text key={id} style={styles.listItem}>◆ {title}</Text>] : [];
            })}
          </Section>
        ) : null}

        {portfolio.glossary ? (
          <Section title={t('portfolio.sections.glossary')}>
            <Stats
              experience={experience}
              items={[
                { label: t('portfolio.termsStudied'), value: portfolio.glossary.studied },
                { label: t('portfolio.gotIt'), value: portfolio.glossary.gotIt },
                { label: t('portfolio.needsReview'), value: portfolio.glossary.needsReview },
              ]}
            />
          </Section>
        ) : null}

        {portfolio.games.length > 0 ? (
          <Section title={t('portfolio.sections.games')}>
            {portfolio.games.map((game) => {
              const rule = GAME_RECORD_RULES[game.gameId];
              const name = t(gameTitleKey(game.listId));
              const best = game.best !== null ? formatMetric(rule.primary.unit, game.best, t) : null;
              const bestLabel = best ? (game.bestRule === 'lower' ? t('portfolio.bestTime', { value: best }) : t('portfolio.personalBest', { value: best })) : null;
              const parts = [bestLabel, t('portfolio.rounds', { count: game.rounds }), game.wins !== null ? t(game.gameId === 'kyz_kuumai' ? 'portfolio.catches' : 'portfolio.wins', { count: game.wins }) : null].filter((part): part is string => !!part);
              return (
                <Card key={game.gameId} image={gameArt({ id: game.listId }, 'card') ?? null} experience={experience} a11y={`${name}. ${parts.join('. ')}.`}>
                  <Text style={styles.cardTitle}>{name}</Text>
                  {parts.map((part) => (
                    <Text key={part} style={styles.meta}>
                      {part}
                    </Text>
                  ))}
                </Card>
              );
            })}
            <Button label={t('gameStats.title')} variant="text" onPress={() => router.push('/games/stats' as never)} />
          </Section>
        ) : null}

        {portfolio.achievements ? (
          <Section title={t('portfolio.sections.achievements')}>
            <Text style={styles.meta}>{t('portfolio.achievementsEarned', { count: portfolio.achievements.earned.length })}</Text>
            <View style={styles.badges}>
              {portfolio.achievements.earned.slice(0, isChild ? 6 : 9).map((id) => {
                const achievement = getAchievement(id);
                if (!achievement) return null;
                const pinned = portfolio.achievements!.pinned.includes(id);
                return (
                  <View key={id} style={[styles.badge, isChild && styles.badgeChild]} accessible accessibilityLabel={`${t(achievement.titleKey)}${pinned ? `. ${t('portfolio.pinned')}` : ''}`}>
                    <MediaImage source={achievement.iconSource} fill={false} style={isChild ? styles.badgeArtChild : styles.badgeArt} />
                    <Text style={styles.badgeText} numberOfLines={2}>
                      {t(achievement.titleKey)}
                    </Text>
                    {pinned ? <Text style={styles.pinned}>{t('portfolio.pinned')}</Text> : null}
                  </View>
                );
              })}
            </View>
          </Section>
        ) : null}
      </ScrollView>
      {shareOpen ? <ShareOptionsSheet onCancel={() => setShareOpen(false)} onShare={shareSelected} /> : null}
      {shareHost}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Same facts for every age; only the presentation changes. */
function Card({ image, experience, a11y, children }: { image: ImageSourcePropType | null; experience: AgeExperience; a11y: string; children: React.ReactNode }) {
  const big = experience === 'child';
  return (
    <View style={[styles.card, big && styles.cardChild, experience === 'adult' && styles.cardAdult]} accessible accessibilityLabel={a11y}>
      {experience !== 'adult' || image ? (
        <View style={big ? styles.artChild : experience === 'adult' ? styles.artAdult : styles.art}>{image ? <MediaImage source={image} /> : <OymoOrnament size={28} color={colors.accentGoldPressed} strokeWidth={1.5} />}</View>
      ) : null}
      <View style={styles.cardText}>{children}</View>
    </View>
  );
}

function PathCard({ path, title, experience, status, steps, a11y }: { path: PortfolioPath; title: string; experience: AgeExperience; status: string; steps: string; a11y: string }) {
  return (
    <Card image={path.heroItemId ? (cultureItemImages[path.heroItemId]?.[0] ?? null) : null} experience={experience} a11y={a11y}>
      <Text style={styles.cardTitle}>{title}</Text>
      {/* Status in words + icon, never colour alone. No completion date: none is recorded. */}
      <View style={styles.status}>
        {path.done ? <Check size={14} color={colors.primary} strokeWidth={2.5} /> : null}
        <Text style={[styles.meta, path.done && styles.done]}>{status}</Text>
      </View>
      <Text style={styles.meta}>{steps}</Text>
    </Card>
  );
}

function Stats({ items, experience }: { items: { label: string; value: number }[]; experience: AgeExperience }) {
  return (
    <View style={styles.stats}>
      {items.map((item) => (
        <View key={item.label} style={[styles.stat, experience === 'child' && styles.statChild]} accessible accessibilityLabel={`${item.label}: ${item.value}`}>
          <Text style={[styles.statValue, experience === 'child' && styles.statValueChild]}>{item.value}</Text>
          <Text style={styles.statLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Choose what the card includes. Journal, notes, mistakes, reading and identity are never options. */
function ShareOptionsSheet({ onShare, onCancel }: { onShare: (include: Record<ShareCategory, boolean>) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [include, setInclude] = useState(DEFAULT_SHARE);
  return (
    <Modal visible transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityRole="button" accessibilityLabel={t('common.cancel')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} accessibilityViewIsModal>
        <Text style={styles.sheetTitle} accessibilityRole="header">
          {t('portfolio.shareChoose')}
        </Text>
        {SHAREABLE_CATEGORIES.map((category) => (
          <View key={category} style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t(`portfolio.shareInclude.${category}`)}</Text>
            <Switch value={include[category]} onValueChange={(value) => setInclude((current) => ({ ...current, [category]: value }))} accessibilityLabel={t(`portfolio.shareInclude.${category}`)} />
          </View>
        ))}
        <Text style={styles.meta}>{t('portfolio.shareNever')}</Text>
        <Button label={t('portfolio.share')} variant="accent" disabled={!Object.values(include).some(Boolean)} onPress={() => onShare(include)} />
        <Button label={t('common.cancel')} variant="secondary" onPress={onCancel} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  headerTitle: { ...typography.h2, flex: 1, color: colors.textPrimary },
  editorial: { ...editorial(typography.h2) },
  content: { paddingHorizontal: spacing.md, gap: spacing.lg },
  private: { ...textStyles.small, color: colors.textMuted },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  emptyText: { ...textStyles.body, textAlign: 'center', color: colors.textSecondary },
  emptyTextChild: { fontSize: 19, lineHeight: 27 },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.overline, color: colors.accentTerracotta },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardChild: { flexDirection: 'column', alignItems: 'stretch', padding: spacing.md },
  cardAdult: { backgroundColor: 'transparent', borderWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderRadius: 0, paddingHorizontal: 0 },
  art: { width: 64, height: 64, borderRadius: cardRadii.compact, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  artChild: { width: '100%', aspectRatio: 1.8, borderRadius: cardRadii.media, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  artAdult: { width: 44, height: 44, borderRadius: radii.md, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { ...textStyles.title, fontSize: 17, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  done: { color: colors.primary, fontWeight: '700' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  listItem: { ...textStyles.body, color: colors.textPrimary },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: { flexGrow: 1, minWidth: 96, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  statChild: { padding: spacing.md },
  statValue: { ...editorial(textStyles.display), fontSize: 28, lineHeight: 34, color: colors.textPrimary },
  statValueChild: { fontSize: 36, lineHeight: 42 },
  statLabel: { ...textStyles.small, color: colors.textSecondary },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: { width: 96, alignItems: 'center', gap: 4 },
  badgeChild: { width: 132 },
  badgeArt: { width: 64, height: 64 },
  badgeArtChild: { width: 96, height: 96 },
  badgeText: { ...textStyles.small, textAlign: 'center', color: colors.textPrimary },
  pinned: { ...textStyles.small, fontWeight: '700', color: colors.primary },
  backdrop: { flex: 1, backgroundColor: 'rgba(20,24,18,0.45)' },
  sheet: { gap: spacing.sm, padding: spacing.md, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, backgroundColor: colors.background },
  sheetTitle: { ...typography.h2, color: colors.textPrimary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  toggleLabel: { ...textStyles.bodyMedium, color: colors.textPrimary },
});
