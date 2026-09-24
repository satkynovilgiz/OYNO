import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { MediaCard, Skeleton } from '@/components/ui';
import { cultureCategoryImages } from '@/features/culture/data';
import type { CultureCategoryId } from '@/features/culture/types';
import type { TodayDiscovery } from '@/features/daily/useTodayDiscovery';
import type { AgeExperience } from '@/services/ageExperience/types';
import { cardRadii, colors, radii, spacing, textStyles } from '@/theme';

type TodayDiscoveryEntryCardProps = {
  discovery: TodayDiscovery | null;
  isLoading: boolean;
  experience: AgeExperience;
  onPress: () => void;
};

/** Wide editorial proportions (~16:9.5) - clearly secondary to the hero. */
const RATIO = 1.7;
const RATIO_CHILD = 1.45;

/**
 * Daily OYNO on Home - a wide media card with overlay content: TODAY label,
 * the item's real title, honest read-time + category, and a small Open
 * CTA at the right of the metadata row (or a quiet "done" mark once
 * completed - no streak pressure). Small source art is never stretched:
 * the same category's high-res photograph is used full-bleed instead.
 */
export function TodayDiscoveryEntryCard({ discovery, isLoading, experience, onPress }: TodayDiscoveryEntryCardProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isChild = experience === 'child';
  const minHeight = Math.round((width - spacing.md * 2) / (isChild ? RATIO_CHILD : RATIO));

  if (isLoading) return <Skeleton height={minHeight} borderRadius={cardRadii.media} />;
  if (!discovery) return null;

  const meta = [t('daily.minutes', { count: discovery.minutes }), discovery.categoryTitle].filter(Boolean).join(' · ');
  const backdrop = cultureCategoryImages[discovery.item.category_id as CultureCategoryId] ?? null;

  return (
    <MediaCard
      variant="landscape"
      minHeight={minHeight}
      source={discovery.imageSource}
      backdrop={backdrop}
      eyebrow={t('daily.entry.overline')}
      eyebrowIcon={<OymoOrnament size={10} color={colors.accentGold} strokeWidth={1.75} />}
      status={
        discovery.isCompleted ? (
          <View style={styles.done}>
            <Check size={13} color={colors.textPrimary} strokeWidth={3} />
            <Text style={styles.doneText} numberOfLines={1}>
              {t('daily.entry.done')}
            </Text>
          </View>
        ) : undefined
      }
      title={discovery.item.title}
      editorialTitle={experience === 'adult'}
      footer={
        isChild ? undefined : (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        )
      }
      cta={discovery.isCompleted ? undefined : t('daily.entry.open')}
      ctaSize={isChild ? 'md' : 'sm'}
      ctaPlacement="inline"
      onPress={onPress}
      accessibilityLabel={`${t('daily.entry.overline')}. ${discovery.item.title}. ${meta}. ${discovery.isCompleted ? t('daily.entry.done') : t('daily.entry.open')}`}
    />
  );
}

const styles = StyleSheet.create({
  meta: { ...textStyles.caption, color: colors.textOnDarkSecondary },
  done: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: colors.accentGold, flexShrink: 1 },
  doneText: { ...textStyles.small, color: colors.textPrimary },
});
