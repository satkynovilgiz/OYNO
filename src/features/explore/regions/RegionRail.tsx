import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { CompactContentCard, Rail, SectionHeader } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import type { AgeExperience } from '@/services/ageExperience/types';
import type { ExploreRegionRow } from '@/services/content/types';
import { spacing } from '@/theme';

import { buildRegionRailItems } from './regionRailItems';
import { useRegionSignals } from './useRegionSignals';

const CARD_WIDTH: Record<AgeExperience, number> = { child: 176, preteen: 168, teen: 160, adult: 150 };

/** Compact "Explore by region" rail under the map: one small card per
 * Region Hub with its real progress; a completed region says so in text
 * (✓ + label), not by colour alone. Renders nothing without regions. */
export function RegionRail({ regions, experience }: { regions: readonly ExploreRegionRow[]; experience: AgeExperience }) {
  const { t, i18n } = useTranslation();
  const signals = useRegionSignals();
  const items = buildRegionRailItems(regions, i18n.language as SupportedLanguage, signals);
  if (items.length === 0) return null;
  const width = CARD_WIDTH[experience];

  return (
    <View style={styles.section}>
      <SectionHeader title={t('explore.regions.title')} size="sm" editorialTitle={experience === 'adult'} />
      <Rail itemWidth={width}>
        {items.map((item) => {
          const progressText = t('regionHub.progress', { completed: item.progress.completed, total: item.progress.total });
          const meta = item.completed ? `✓ ${t('explore.regions.completed')}` : progressText;
          return (
            <CompactContentCard
              key={item.id}
              width={width}
              imageSource={item.imageSource}
              fallbackTone={item.tone}
              title={item.name}
              meta={meta}
              accessibilityLabel={[item.name, progressText, item.completed ? t('explore.regions.completed') : null].filter(Boolean).join('. ')}
              onPress={() => router.push(item.route as never)}
            />
          );
        })}
      </Rail>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
});
