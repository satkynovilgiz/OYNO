import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { MediaCard, Rail, SectionHeader, useRailItemWidth } from '@/components/ui';
import type { AgeExperience } from '@/services/ageExperience/types';
import { spacing } from '@/theme';

import type { CultureTile } from '../types';

/** Share of the content width for one card: ~70% so the next category
 * clearly peeks; children get slightly wider cards and fewer words. */
const SHARE: Record<AgeExperience, number> = { child: 0.78, preteen: 0.72, teen: 0.68, adult: 0.7 };

/**
 * "Explore OYNO" - the existing category destinations as medium cinematic
 * cards on the shared Rail: photo-led, a short title (two lines allowed so
 * Kyrgyz words never split), a one/two-line subtitle and a small chevron.
 * The whole card is the target - no circular arrow buttons.
 */
export function CategoryCarousel({ tiles, experience, onPressTile }: { tiles: CultureTile[]; experience: AgeExperience; onPressTile: (tile: CultureTile) => void }) {
  const { t } = useTranslation();
  const width = useRailItemWidth('medium', SHARE[experience]);

  return (
    <View style={styles.section}>
      <SectionHeader title={t('home.sections.explore')} />
      <Rail itemWidth={width} snap>
        {tiles.map((tile) => (
          <MediaCard
            key={tile.id}
            variant="portrait"
            width={width}
            aspectRatio={1.12}
            source={tile.imageSource}
            title={tile.title}
            subtitle={experience === 'child' ? undefined : tile.subtitle}
            subtitleLines={2}
            chevron
            editorialTitle={experience === 'adult'}
            onPress={() => onPressTile(tile)}
            accessibilityLabel={`${tile.title}. ${tile.subtitle}`}
          />
        ))}
      </Rail>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
});
