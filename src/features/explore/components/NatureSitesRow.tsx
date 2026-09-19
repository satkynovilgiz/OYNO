import { ChevronRight } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AnimatedPressable, FadeSlideIn } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

export type NatureSiteItem = {
  id: string;
  name: string;
  tagline: string;
};

/** Matches styles.card's fixed width so the row snaps one card at a time. */
const NATURE_CARD_WIDTH = 160;

type NatureSitesRowProps = {
  sites: NatureSiteItem[];
  onPressSite?: (id: string) => void;
};

/** The 6 nature-site rows in explore_regions (Сон-Көл, Суусамыр, Алай,
 * Сары-Челек, Арсланбоб, Ала-Тоо) have real, sourced content and already
 * work at /explore/[id] (LocationDetailScreen doesn't care about `kind`),
 * but nothing in the UI ever surfaced them - the map only places pins for
 * the 8 `region`-kind rows, since map_terrain.png's baked-in pin art only
 * covers those. This gives them a real entry point without needing new
 * map art. Flat-color cards, same fallback convention as DiscoveriesRow,
 * since there's no per-site photo asset yet. */
export function NatureSitesRow({ sites, onPressSite }: NatureSitesRowProps) {
  const { t } = useTranslation();

  if (sites.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('explore.natureSites.title')}</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        snapToInterval={NATURE_CARD_WIDTH + spacing.sm}
        snapToAlignment="start"
        decelerationRate="fast"
      >
        {sites.map((site, index) => (
          <FadeSlideIn key={site.id} index={index}>
            <AnimatedPressable
              style={styles.card}
              onPress={() => onPressSite?.(site.id)}
              hoverEffect
              accessibilityRole="button"
              accessibilityLabel={site.name}
            >
              <Text style={styles.name} numberOfLines={1}>{site.name}</Text>
              <Text style={styles.tagline} numberOfLines={2}>{site.tagline}</Text>
              <ChevronRight size={16} color={colors.textOnDark} strokeWidth={2.25} />
            </AnimatedPressable>
          </FadeSlideIn>
        ))}
      </ScrollView>
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
    gap: spacing.sm,
  },
  card: {
    width: 160,
    height: 110,
    borderRadius: radii.xl,
    padding: spacing.sm,
    justifyContent: 'space-between',
    backgroundColor: colors.discovery.nature,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
  },
  name: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  tagline: {
    ...typography.small,
    color: colors.textOnDark,
    opacity: 0.9,
  },
});
