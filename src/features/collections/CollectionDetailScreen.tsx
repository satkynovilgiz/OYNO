import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Gamepad2, Play } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, CompactContentCard, EditorialCard, HeroCard, IconButton, InteractiveCard } from '@/components/ui';
import { cultureItemImages, cultureMaterialImages } from '@/features/culture/data';
import { INTERACTIVE_EXPERIENCES, routeForInteractiveExperience } from '@/features/culture/interactiveExperiences';
import { mockGamesList } from '@/features/games/mockData';
import { gameTitleKey } from '@/features/games/types';
import type { SupportedLanguage } from '@/i18n';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureMaterials } from '@/services/content/cultureService';
import { colors, radii, spacing, typography } from '@/theme';

import type { Collection, CollectionSectionRef } from './collectionsData';

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

  const { data: items, isLoading: itemsLoading } = useAllCultureItems();
  const { data: materials, isLoading: materialsLoading } = useCultureMaterials();
  const isLoading = itemsLoading || materialsLoading;

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

        {isLoading ? (
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
                      <InteractiveCard
                        key={`${ref.kind}:${ref.id}`}
                        imageSource={experience.imageSource}
                        title={t(experience.titleKey)}
                        ctaIcon={Play}
                        onPress={() => handlePress(ref)}
                      />
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
                      <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
                    </AnimatedPressable>
                  );
                })}
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
