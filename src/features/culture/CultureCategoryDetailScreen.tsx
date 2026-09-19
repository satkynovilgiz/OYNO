import { LinearGradient } from 'expo-linear-gradient';
import {
  BookOpen,
  ChevronLeft,
  Flame,
  Play,
  PartyPopper,
  Repeat,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

import { AnimatedPressable, FadeSlideIn, IconButton, Pill } from '@/components/ui';
import { pickCategoryIntro } from '@/features/culture/categoryIntro';
import type { InteractiveExperience } from '@/features/culture/components';
import { cultureItemImages } from '@/features/culture/data';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useHeroParallax } from '@/services/motion/useHeroParallax';
import type { CultureItemRow, CultureItemTypeLabel } from '@/services/content/types';
import { colors, radii, shadows, spacing, typography } from '@/theme';

type CultureCategoryDetailScreenProps = {
  categoryId: string;
  categoryTitle: string;
  categoryImage: ImageSourcePropType;
  progress: { current: number; total: number };
  items: CultureItemRow[];
  isLoading: boolean;
  hasError: boolean;
  interactiveExperience: InteractiveExperience | null;
  onPressBack: () => void;
  onPressItem: (item: CultureItemRow) => void;
  onPressInteractiveExperience: (id: string) => void;
};

/** Per-item photography doesn't exist for every item (only one image per
 * whole category is guaranteed), so item cards fall back to a colored icon
 * tile keyed off `type_label` when `cultureItemImages` has nothing for that
 * specific id - distinct, meaningful, and doesn't fake photography that
 * doesn't exist (same fallback the old flat-grid screen used). */
const TYPE_ICON: Record<CultureItemTypeLabel, LucideIcon> = {
  custom: BookOpen,
  practice: Repeat,
  ritual: Flame,
  ceremony: Users,
  festival: PartyPopper,
};

const TYPE_COLOR: Record<CultureItemTypeLabel, string> = {
  custom: colors.accentBrown,
  practice: colors.primary,
  ritual: colors.danger,
  ceremony: colors.accentGold,
  festival: colors.discovery.animals,
};

const HERO_ASPECT_RATIO_BY_CARD_SCALE = { large: 1.1, medium: 1.4, compact: 1.6, dense: 1.9 };
const ITEM_COLUMNS_BY_CARD_SCALE = { large: 1, medium: 2, compact: 2, dense: 1 };
const ITEM_TITLE_FONT_SIZE_BY_CARD_SCALE = { large: 18, medium: 15, compact: 14, dense: 14 };

/**
 * One reusable editorial detail screen for every Culture category (spec
 * "Create one reusable CultureCategoryDetailScreen driven by category
 * data... Do NOT create 10 separate screens"). Replaces the old flat
 * icon-tile grid with a full-bleed photo hero, an optional real-content
 * introduction, a featured interactive-experience card where one exists,
 * and an age-adaptive item list - same underlying `culture_items` data,
 * same navigation, same progress the whole way through.
 */
export function CultureCategoryDetailScreen({
  categoryId,
  categoryTitle,
  categoryImage,
  progress,
  items,
  isLoading,
  hasError,
  interactiveExperience,
  onPressBack,
  onPressItem,
  onPressInteractiveExperience,
}: CultureCategoryDetailScreenProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { config } = useAgeExperience();
  const { scrollHandler, heroStyle } = useHeroParallax();

  const intro = pickCategoryIntro(items, i18n.language as 'kg' | 'ru' | 'en', config.learningDepth);
  const heroAspectRatio = resolveByCardScale(config.cardScale, HERO_ASPECT_RATIO_BY_CARD_SCALE);
  const columns = resolveByCardScale(config.cardScale, ITEM_COLUMNS_BY_CARD_SCALE);
  const itemTitleFontSize = resolveByCardScale(config.cardScale, ITEM_TITLE_FONT_SIZE_BY_CARD_SCALE);
  const isAdult = config.characterProminence === 'subtle';

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <View style={[styles.hero, { aspectRatio: heroAspectRatio }]}>
          <Animated.Image source={categoryImage} style={[styles.heroImage, heroStyle]} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(19,32,24,0.15)', 'rgba(19,32,24,0.92)']}
            locations={[0.35, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.heroTopRow, { paddingTop: insets.top + spacing.sm }]}>
            <IconButton
              icon={ChevronLeft}
              shape="roundedSquare"
              variant="surface"
              accessibilityLabel={t('common.back')}
              onPress={onPressBack}
            />
          </View>
          <View style={styles.heroBottom}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {categoryTitle}
            </Text>
            <Pill label={`${progress.current} / ${progress.total}`} />
          </View>
        </View>

        {isLoading ? (
          <View style={styles.stateBlock}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : hasError ? (
          <View style={styles.stateBlock}>
            <Text style={styles.stateText}>{t('culture.loadError')}</Text>
          </View>
        ) : (
          <View style={styles.body}>
            {intro ? (
              <FadeSlideIn style={styles.section} index={0}>
                <Text style={styles.introText}>{intro}</Text>
              </FadeSlideIn>
            ) : null}

            {interactiveExperience ? (
              <FadeSlideIn style={styles.section} index={1}>
                <Text style={styles.sectionTitle}>{t('culture.interactive.title')}</Text>
                <AnimatedPressable
                  style={styles.interactiveCard}
                  onPress={() => onPressInteractiveExperience(interactiveExperience.id)}
                  hoverEffect
                  haptic="light"
                  accessibilityRole="button"
                  accessibilityLabel={t(interactiveExperience.titleKey)}
                >
                  <Image source={interactiveExperience.imageSource} style={styles.interactiveImage} resizeMode="cover" />
                  <LinearGradient colors={['transparent', colors.overlayEnd]} locations={[0.4, 1]} style={StyleSheet.absoluteFill} />
                  <View style={styles.interactiveContent}>
                    <Text style={styles.interactiveTitle}>{t(interactiveExperience.titleKey)}</Text>
                  </View>
                  <View style={styles.interactiveCta}>
                    <Play size={16} color={colors.textPrimary} strokeWidth={2.25} />
                  </View>
                </AnimatedPressable>
              </FadeSlideIn>
            ) : null}

            {items.length === 0 ? (
              <Text style={styles.stateText}>{t('culture.item.pendingResearch')}</Text>
            ) : (
              <FadeSlideIn style={styles.section} index={2}>
                <Text style={styles.sectionTitle}>{t('culture.categoryDetail.itemsTitle')}</Text>
                <View style={[styles.itemGrid, columns === 1 && styles.itemListSingleColumn]}>
                  {items.map((item, index) => {
                    const photo = cultureItemImages[item.id]?.[0];
                    const TileIcon = item.type_label ? TYPE_ICON[item.type_label] : null;
                    const tileColor = item.type_label ? TYPE_COLOR[item.type_label] : colors.textMuted;

                    return (
                      <FadeSlideIn
                        key={item.id}
                        style={columns === 1 ? styles.itemWrapFull : styles.itemWrapHalf}
                        index={index + 3}
                      >
                        <AnimatedPressable
                          style={[styles.itemCard, isAdult && styles.itemCardRow]}
                          onPress={() => onPressItem(item)}
                          hoverEffect
                          haptic="light"
                          accessibilityRole="button"
                          accessibilityLabel={item.title}
                        >
                          <View style={[styles.itemArt, isAdult && styles.itemArtRow]}>
                            {photo ? (
                              <Image source={photo} style={styles.itemArtImage} resizeMode="cover" />
                            ) : (
                              <View style={[styles.itemArtImage, styles.itemArtFallback]}>
                                {TileIcon ? (
                                  <TileIcon size={isAdult ? 20 : 28} color={tileColor} strokeWidth={1.75} />
                                ) : null}
                              </View>
                            )}
                            <View style={[styles.itemArtAccent, { backgroundColor: tileColor }]} />
                          </View>
                          <View style={[styles.itemBody, isAdult && styles.itemBodyRow]}>
                            <Text style={[styles.itemTitle, { fontSize: itemTitleFontSize }]} numberOfLines={isAdult ? 1 : 2}>
                              {item.title}
                            </Text>
                            {item.type_label ? (
                              <Text style={styles.itemType} numberOfLines={1}>
                                {t(`culture.item.type.${item.type_label}`)}
                                {isAdult ? ` · ${t(`culture.item.accuracy.${item.accuracy_level}`)}` : ''}
                              </Text>
                            ) : null}
                          </View>
                        </AnimatedPressable>
                      </FadeSlideIn>
                    );
                  })}
                </View>
              </FadeSlideIn>
            )}
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  hero: {
    width: '100%',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  heroImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  heroTopRow: {
    paddingHorizontal: spacing.md,
  },
  heroBottom: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  heroTitle: {
    ...typography.display,
    fontSize: 28,
    color: colors.textOnDark,
  },
  stateBlock: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  body: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  introText: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  interactiveCard: {
    width: '100%',
    aspectRatio: 2.2,
    borderRadius: radii.xxl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: colors.surfaceAlt,
  },
  interactiveImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  interactiveContent: {
    padding: spacing.md,
  },
  interactiveTitle: {
    ...typography.h1,
    color: colors.textOnDark,
  },
  interactiveCta: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  itemListSingleColumn: {
    flexDirection: 'column',
  },
  itemWrapHalf: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  itemWrapFull: {
    width: '100%',
  },
  itemCard: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
  },
  itemCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemArt: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  itemArtRow: {
    width: 64,
    aspectRatio: 1,
  },
  itemArtImage: {
    width: '100%',
    height: '100%',
  },
  itemArtFallback: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemArtAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
  },
  itemBody: {
    padding: spacing.xs,
    gap: 2,
    minHeight: 58,
  },
  itemBodyRow: {
    flex: 1,
    minHeight: undefined,
    justifyContent: 'center',
  },
  itemTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
    lineHeight: 18,
  },
  itemType: {
    ...typography.small,
    color: colors.textMuted,
  },
});
