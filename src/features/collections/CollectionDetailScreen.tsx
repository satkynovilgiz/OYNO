import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, Gamepad2, Play } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddToJournalButton } from '@/components/journal/AddToJournalButton';
import { DownloadButton } from '@/components/offline/DownloadButton';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, CompactContentCard, EditorialCard, HeroCard, IconButton, InteractiveCard, ProgressBar } from '@/components/ui';
import { cultureItemImages, cultureMaterialImages } from '@/features/culture/data';
import { INTERACTIVE_EXPERIENCES, routeForInteractiveExperience } from '@/features/culture/interactiveExperiences';
import { mockGamesList } from '@/features/games/mockData';
import { gameTitleKey } from '@/features/games/types';
import type { SupportedLanguage } from '@/i18n';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureMaterials } from '@/services/content/cultureService';
import { isWaitingForNetwork } from '@/services/offline/offlineManifest';
import { useShareCard } from '@/services/share/useShareCard';
import { colors, radii, spacing, typography } from '@/theme';

import { computeCollectionProgress } from './collectionProgress';
import { collections, type Collection, type CollectionSectionRef } from './collectionsData';
import { useCollectionSignals } from './useCollectionProgress';
import { collectionQuestionIds } from '@/features/challenges/challengeLogic';
import { TestKnowledgeLink } from '@/features/culture/components/ArticleParts';

type CollectionDetailScreenProps = {
  collection: Collection;
  onPressBack: () => void;
};

function resolveLocalized(text: { kg: string; ru: string; en: string }, language: SupportedLanguage): string {
  return text[language] ?? text.kg;
}

/** One reusable screen for every collection (spec "Create a reusable
 * Collection Detail screen"). Mixes card treatments on purpose (spec
 * "Avoid repetitive identical cards... large editorial cards, small story
 * rows, photography, interactive CTA"): the first culture item/material
 * gets the large `EditorialCard` "feature" treatment, the rest ride a
 * horizontal row of small `CompactContentCard`s, interactive experiences
 * get their own `InteractiveCard` row, and games get a plain text CTA
 * row - never all the same shape end to end. */
export function CollectionDetailScreen({ collection, onPressBack }: CollectionDetailScreenProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const insets = useSafeAreaInsets();

  const itemsQuery = useAllCultureItems();
  const materialsQuery = useCultureMaterials();
  const { data: items, isLoading: itemsLoading } = itemsQuery;
  const { data: materials, isLoading: materialsLoading } = materialsQuery;
  const waitingForNetwork = isWaitingForNetwork(itemsQuery) || isWaitingForNetwork(materialsQuery);
  const isLoading = itemsLoading || materialsLoading;

  const signals = useCollectionSignals();
  const { share, shareHost } = useShareCard();
  const progress = computeCollectionProgress(collection, signals);
  // One next step after completion: the next collection not yet finished
  // (real routes only), else this collection's own Culture category.
  const nextCollection = collections.find((other) => other.id !== collection.id && computeCollectionProgress(other, signals).status !== 'completed');

  const itemById = useMemo(() => new Map((items ?? []).map((item) => [item.id, item])), [items]);
  const materialById = useMemo(() => new Map((materials ?? []).map((material) => [material.id, material])), [materials]);

  const contentRefs = collection.sections.filter((ref) => ref.kind === 'culture_item' || ref.kind === 'culture_material');
  const interactiveRefs = collection.sections.filter((ref) => ref.kind === 'interactive_experience');
  const gameRefs = collection.sections.filter((ref) => ref.kind === 'game');

  function titleFor(ref: CollectionSectionRef): string {
    if (ref.kind === 'culture_item') return itemById.get(ref.id)?.title ?? '';
    if (ref.kind === 'culture_material') return materialById.get(ref.id)?.title ?? '';
    return '';
  }

  function imageFor(ref: CollectionSectionRef) {
    if (ref.kind === 'culture_item') return cultureItemImages[ref.id]?.[0];
    if (ref.kind === 'culture_material') return cultureMaterialImages[ref.id];
    return undefined;
  }

  function routeFor(ref: CollectionSectionRef): string | null {
    if (ref.kind === 'culture_item') return `/culture/item/${ref.id}`;
    if (ref.kind === 'culture_material') return `/culture/material/${ref.id}`;
    if (ref.kind === 'interactive_experience') return routeForInteractiveExperience(ref.id);
    const game = mockGamesList.find((g) => g.id === ref.id);
    return game?.route ?? null;
  }

  function handlePress(ref: CollectionSectionRef) {
    const route = routeFor(ref);
    if (route) router.push(route as never);
  }

  const [featureRef, ...restRefs] = contentRefs;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <HeroCard imageSource={collection.heroImage} title={resolveLocalized(collection.title, language)} aspectRatio={4 / 3}>
            <View style={styles.heroTopRow}>
              <IconButton icon={ChevronLeft} shape="roundedSquare" variant="surface" accessibilityLabel={t('common.back')} onPress={onPressBack} />
            </View>
          </HeroCard>
        </View>

        <Text style={styles.intro}>{resolveLocalized(collection.intro, language)}</Text>

        <View style={[styles.horizontalPad, styles.actions]}>
          <DownloadButton kind="collection" contentId={collection.id} title={resolveLocalized(collection.title, language)} />
          <AddToJournalButton type="collection" id={collection.id} title={resolveLocalized(collection.title, language)} />
        </View>

        {progress.total > 0 ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressRow}>
              <OymoOrnament size={11} color={colors.accentGoldPressed} strokeWidth={1.75} />
              <Text style={styles.progressText}>{t('collections.progress', { completed: progress.completed, total: progress.total })}</Text>
            </View>
            <ProgressBar progress={progress.completed / progress.total} height={4} fillColor={colors.accentGold} trackColor={colors.surfaceAlt} />
            <Text style={styles.progressScope}>{t('collections.progressScope')}</Text>
          </View>
        ) : null}

        {waitingForNetwork ? (
          <View style={styles.offlineNote}>
            <Text style={styles.offlineNoteText}>{t('offline.notAvailable')}</Text>
          </View>
        ) : isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : (
          <>
            {featureRef && imageFor(featureRef) ? (
              <View style={styles.horizontalPad}>
                <EditorialCard
                  imageSource={imageFor(featureRef)!}
                  title={titleFor(featureRef)}
                  size="feature"
                  aspectRatio={16 / 9}
                  onPress={() => handlePress(featureRef)}
                />
              </View>
            ) : null}

            {restRefs.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {restRefs.map((ref) => {
                  const image = imageFor(ref);
                  return image ? (
                    <CompactContentCard
                      key={`${ref.kind}:${ref.id}`}
                      imageSource={image}
                      title={titleFor(ref)}
                      onPress={() => handlePress(ref)}
                    />
                  ) : null;
                })}
              </ScrollView>
            ) : null}

            {interactiveRefs.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('culture.interactive.title')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                  {interactiveRefs.map((ref) => {
                    const experience = INTERACTIVE_EXPERIENCES.find((exp) => exp.id === ref.id);
                    if (!experience) return null;
                    return (
                      <View key={`${ref.kind}:${ref.id}`}>
                        <InteractiveCard imageSource={experience.imageSource} title={t(experience.titleKey)} ctaIcon={Play} onPress={() => handlePress(ref)} />
                        {progress.stateOf(ref) === 'completed' ? (
                          <View style={styles.doneBadge} accessibilityLabel={t('collections.status.completed')}>
                            <Check size={13} color={colors.textPrimary} strokeWidth={3} />
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {gameRefs.length > 0 ? (
              <View style={[styles.horizontalPad, styles.section]}>
                <Text style={styles.sectionTitle}>{t('games.title')}</Text>
                {gameRefs.map((ref) => {
                  const game = mockGamesList.find((g) => g.id === ref.id);
                  if (!game) return null;
                  return (
                    <AnimatedPressable key={ref.id} style={styles.gameRow} onPress={() => handlePress(ref)} hoverEffect accessibilityRole="button" accessibilityLabel={t(gameTitleKey(game.id))}>
                      {game.thumbnail ? (
                        <Image source={game.thumbnail} style={styles.gameThumb} resizeMode="cover" />
                      ) : (
                        <View style={[styles.gameThumb, styles.gameThumbFallback]}>
                          <Gamepad2 size={20} color={colors.accentGold} strokeWidth={1.75} />
                        </View>
                      )}
                      <Text style={styles.gameTitle}>{t(gameTitleKey(game.id))}</Text>
                      {progress.stateOf(ref) === 'completed' ? (
                        <View style={styles.doneInline}>
                          <Check size={12} color={colors.textPrimary} strokeWidth={3} />
                        </View>
                      ) : (
                        <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
                      )}
                    </AnimatedPressable>
                  );
                })}
              </View>
            ) : null}

            {progress.status === 'completed' ? (
              <View style={styles.completeWrap}>
                <View style={styles.completeSeal}>
                  <Image source={collection.heroImage} style={styles.completeSealImage} resizeMode="cover" />
                  <View style={styles.completeSealCheck}>
                    <Check size={14} color={colors.textPrimary} strokeWidth={3} />
                  </View>
                </View>
                <Text style={styles.completeEyebrow}>{t('collections.completeEyebrow')}</Text>
                <Text style={styles.completeTitle}>{resolveLocalized(collection.title, language)}</Text>
                <Text style={styles.completeBody}>{t('collections.completeBody')}</Text>
                <AnimatedPressable
                  style={styles.completeCta}
                  onPress={() =>
                    router.push((nextCollection ? `/collections/${nextCollection.id}` : `/culture/${collection.relatedCategoryId}`) as never)
                  }
                  pressScale={0.98}
                  haptic="light"
                  accessibilityRole="button"
                  accessibilityLabel={nextCollection ? resolveLocalized(nextCollection.title, language) : t('collections.relatedDiscovery')}
                >
                  <Text style={styles.completeCtaText} numberOfLines={2}>
                    {nextCollection ? `${t('collections.nextCollection')}: ${resolveLocalized(nextCollection.title, language)}` : t('collections.relatedDiscovery')}
                  </Text>
                  <ChevronRight size={18} color={colors.accentGold} strokeWidth={2.5} />
                </AnimatedPressable>
                <AnimatedPressable
                  style={styles.completeShare}
                  onPress={() =>
                    void share(
                      {
                        title: resolveLocalized(collection.title, language),
                        label: t('collections.sectionTitle'),
                        imageSource: collection.heroImage,
                        completedLabel: t('collections.status.completed'),
                      },
                      t('share.message', { title: resolveLocalized(collection.title, language) }),
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t('share.action')}
                >
                  <Text style={styles.completeShareText}>{t('share.action')}</Text>
                </AnimatedPressable>
              </View>
            ) : null}

            {collectionQuestionIds(collection).length > 0 ? (
              <View style={styles.horizontalPad}>
                <TestKnowledgeLink collection={collection} />
              </View>
            ) : null}

            <AnimatedPressable
              style={styles.relatedLink}
              onPress={() => router.push(`/culture/${collection.relatedCategoryId}` as never)}
              hoverEffect
              accessibilityRole="button"
              accessibilityLabel={t('collections.relatedDiscovery')}
            >
              <Text style={styles.relatedLinkText}>{t('collections.relatedDiscovery')}</Text>
              <ChevronRight size={18} color={colors.primary} strokeWidth={2.25} />
            </AnimatedPressable>
          </>
        )}
      </ScrollView>
      {shareHost}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  heroWrap: {
    width: '100%',
  },
  heroTopRow: {
    marginBottom: spacing.sm,
  },
  intro: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  loading: {
    marginTop: spacing.lg,
  },
  horizontalPad: {
    paddingHorizontal: spacing.md,
  },
  actions: {
    gap: spacing.sm,
  },
  row: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
  },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  gameThumb: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
  },
  gameThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flex: 1,
  },
  offlineNote: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  offlineNoteText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  progressBlock: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  progressText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  progressScope: {
    ...typography.small,
    fontWeight: '500',
    color: colors.textMuted,
  },
  doneBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneInline: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeWrap: {
    marginHorizontal: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.xxl,
    backgroundColor: colors.surfaceFeature,
    alignItems: 'center',
    gap: spacing.xs,
  },
  completeSeal: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: colors.accentGold,
    padding: 4,
    marginBottom: spacing.xs,
    transform: [{ rotate: '-5deg' }],
  },
  completeSealImage: {
    width: '100%',
    height: '100%',
    borderRadius: 42,
  },
  completeSealCheck: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentGold,
    borderWidth: 2,
    borderColor: colors.surfaceFeature,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeEyebrow: {
    ...typography.overline,
    color: colors.accentGold,
  },
  completeTitle: {
    ...typography.h1,
    color: colors.textOnDark,
    textAlign: 'center',
  },
  completeBody: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  completeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(232,185,61,0.5)',
  },
  completeCtaText: {
    ...typography.bodyBold,
    color: colors.textOnDark,
    textAlign: 'center',
    flexShrink: 1,
  },
  completeShare: {
    paddingVertical: spacing.xs,
  },
  completeShareText: {
    ...typography.bodyBold,
    color: colors.accentGold,
  },
  relatedLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  relatedLinkText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
});
