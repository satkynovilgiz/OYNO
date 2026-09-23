import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Check } from 'lucide-react-native';
import { Image, type ImageSourcePropType, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, FadeSlideIn } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import { LOCATION_TONES } from '../data';

export type NatureSiteItem = {
  id: string;
  name: string;
  tagline: string;
  /** Real photo of this destination (natureSiteImages), or null. */
  imageSource: ImageSourcePropType | null;
  /** Position among all nature rows - picks the same fallback tone the
   * destination's detail hero uses when there's no photo. */
  toneIndex: number;
  /** From useProgressStore.visitedRegionIds - never inferred. */
  visited: boolean;
};

type NatureSitesRowProps = {
  sites: NatureSiteItem[];
  onPressSite?: (id: string) => void;
};

const GAP = spacing.sm;

/** Card width tracks the screen so every phone shows one full card plus an
 * intentional peek of the next (≈0.6 of the width), clamped so it never
 * gets cramped at 375 or oversized at 430. */
function useCardSize() {
  const { width } = useWindowDimensions();
  const cardWidth = Math.round(Math.min(Math.max(width * 0.6, 216), 264));
  return { cardWidth, cardHeight: Math.round(cardWidth * 1.18) };
}

/**
 * The 6 nature destinations in explore_regions (Сон-Көл, Суусамыр, Алай,
 * Сары-Челек, Арсланбоб, Ала-Тоо), presented as places rather than text
 * tiles: a full-bleed destination photo with a controlled bottom gradient,
 * the name, its short tagline and an arrow into the existing detail
 * screen. When a site has no real photo yet (see natureSiteImages), it gets
 * a clean fallback - the same tone and oymo mark its detail hero shows, plus
 * a quiet ridge line - rather than a stretched placeholder. A visited site
 * (real progress only) gets a small gold "Discovered" seal.
 */
export function NatureSitesRow({ sites, onPressSite }: NatureSitesRowProps) {
  const { t } = useTranslation();
  const { cardWidth, cardHeight } = useCardSize();

  if (sites.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('explore.natureSites.title')}</Text>

      {/* Plain smooth scrolling on purpose - no snapToInterval. Its snap
          grid starts at content x=0, not after `list`'s leading gutter, so
          snaps land off-grid (previous-card sliver) and the last card can
          become unreachable; the app-wide fix in 0304192 removed it from
          every carousel (see docs/AGE_ADAPTIVE_EXPERIENCE.md). */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
        {sites.map((site, index) => (
          <FadeSlideIn key={site.id} index={index} style={shadows.card}>
            <AnimatedPressable
              style={[styles.card, { width: cardWidth, height: cardHeight }]}
              onPress={() => onPressSite?.(site.id)}
              pressScale={0.98}
              hoverEffect
              accessibilityRole="button"
              accessibilityLabel={site.visited ? `${site.name}, ${t('explore.filters.options.discovered')}` : site.name}
            >
              {site.imageSource ? (
                <>
                  <Image source={site.imageSource} style={styles.fill} resizeMode="cover" />
                  <LinearGradient
                    colors={['rgba(19,32,24,0)', 'rgba(19,32,24,0.35)', 'rgba(19,32,24,0.9)']}
                    locations={[0.35, 0.6, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                </>
              ) : (
                <SiteFallback tone={LOCATION_TONES[site.toneIndex % LOCATION_TONES.length]} />
              )}

              {site.visited ? (
                <View style={styles.visitedSeal}>
                  <Check size={11} color={colors.textPrimary} strokeWidth={3} />
                  <Text style={styles.visitedText}>{t('explore.filters.options.discovered')}</Text>
                </View>
              ) : null}

              <View style={styles.content}>
                <Text style={styles.name} numberOfLines={2}>
                  {site.name}
                </Text>
                <View style={styles.bottomRow}>
                  <Text style={styles.tagline} numberOfLines={2}>
                    {site.tagline}
                  </Text>
                  <View style={styles.arrow}>
                    <ArrowRight size={15} color={colors.textPrimary} strokeWidth={2.5} />
                  </View>
                </View>
              </View>
            </AnimatedPressable>
          </FadeSlideIn>
        ))}
      </ScrollView>
    </View>
  );
}

/** Photo-less destination: its detail-hero tone, a soft light falloff, the
 * detail hero's faint oymo mark, and a quiet mountain ridge - a deliberate
 * designed card, not an empty green box or a fake photo. */
function SiteFallback({ tone }: { tone: string }) {
  return (
    <View style={[styles.fill, { backgroundColor: tone }]}>
      <LinearGradient colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.35)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.fallbackOrnament}>
        <OymoOrnament size={56} color="rgba(255,255,255,0.16)" strokeWidth={1.25} />
      </View>
      <Svg style={styles.ridge} viewBox="0 0 200 60" preserveAspectRatio="none">
        <Path d="M0 60 L0 38 L28 22 L46 32 L74 8 L98 30 L118 18 L146 40 L170 24 L200 36 L200 60 Z" fill="rgba(255,255,255,0.07)" />
        <Path d="M0 60 L0 48 L34 36 L60 46 L92 28 L126 44 L158 34 L200 48 L200 60 Z" fill="rgba(0,0,0,0.12)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    gap: GAP,
  },
  card: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: colors.surfaceFeature,
  },
  // Explicit width/height with the absolute-fill insets - same reason as
  // EditorialCard's artwork style (insets alone can size an Image by its
  // intrinsic pixels on some platforms).
  fill: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  fallbackOrnament: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
  },
  ridge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '55%',
  },
  visitedSeal: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.accentGold,
  },
  visitedText: {
    ...typography.small,
    color: colors.textPrimary,
  },
  content: {
    padding: spacing.md,
    gap: spacing.xxs,
  },
  name: {
    ...typography.h1,
    fontSize: 21,
    color: colors.textOnDark,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  tagline: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    flex: 1,
  },
  arrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
