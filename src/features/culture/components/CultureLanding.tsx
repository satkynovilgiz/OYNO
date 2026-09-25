import { Headphones } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, MediaCard, ProgressBar, Rail, SectionHeader, useRailItemWidth } from '@/components/ui';
import type { AgeExperience } from '@/services/ageExperience/types';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

/** Culture landing building blocks (design system v2). Everything they
 * render is passed in from real data - collections, category item counts,
 * collection progress, daily history, bundled komuz tracks. */

export type FeaturedStory = { id: string; eyebrow: string; title: string; excerpt: string; image: ImageSourcePropType };

/** One cinematic featured story: real curated collection, its own intro
 * copy as the excerpt (never generated). */
export function FeaturedStoryCard({ story, experience, onPress }: { story: FeaturedStory; experience: AgeExperience; onPress: () => void }) {
  const { t } = useTranslation();
  const isChild = experience === 'child';
  return (
    <View style={styles.pad}>
      <MediaCard
        variant="hero"
        aspectRatio={isChild ? 1.05 : 1.2}
        source={story.image}
        eyebrow={story.eyebrow}
        eyebrowIcon={<OymoOrnament size={10} color={colors.accentGold} strokeWidth={1.75} />}
        title={story.title}
        editorialTitle={!isChild}
        subtitle={story.excerpt}
        subtitleLines={isChild ? 2 : 3}
        cta={t('culture.v2.read')}
        ctaSize={isChild ? 'lg' : 'md'}
        onPress={onPress}
        accessibilityLabel={`${story.eyebrow}: ${story.title}. ${story.excerpt}`}
      />
    </View>
  );
}

export type CategoryTileData = { id: string; title: string; image: ImageSourcePropType; count: number | null };

/** Categories as a two-column grid of medium photo tiles - every category
 * visible at a glance, no fake progress: the only number is the real count
 * of stories in that category (hidden while unknown). */
export function CategoryGrid({ categories, experience, onPressCategory }: { categories: CategoryTileData[]; experience: AgeExperience; onPressCategory: (id: string) => void }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const oneColumn = experience === 'child';
  const tileWidth = oneColumn ? width - spacing.md * 2 : Math.floor((width - spacing.md * 2 - spacing.sm) / 2);
  return (
    <View style={styles.section}>
      <SectionHeader title={t('culture.v2.categoriesTitle')} editorialTitle={experience === 'adult'} />
      <View style={styles.grid}>
        {categories.map((category) => (
          <MediaCard
            key={category.id}
            variant="compact"
            width={tileWidth}
            aspectRatio={oneColumn ? 2 : 1.2}
            source={category.image}
            title={category.title}
            subtitle={category.count ? t('culture.v2.stories', { count: category.count }) : undefined}
            chevron
            onPress={() => onPressCategory(category.id)}
            accessibilityLabel={category.count ? `${category.title}. ${t('culture.v2.stories', { count: category.count })}` : category.title}
          />
        ))}
      </View>
    </View>
  );
}

export type CollectionCardData = { id: string; title: string; intro: string; image: ImageSourcePropType; completed: number; total: number; status: string | undefined };

/** Curated collections: representative photo, title, one line of their own
 * intro, and real completed / total (count, not a percentage). */
export function CollectionsRail({ items, experience, onPress }: { items: CollectionCardData[]; experience: AgeExperience; onPress: (id: string) => void }) {
  const { t } = useTranslation();
  const width = useRailItemWidth('medium', experience === 'child' ? 0.8 : 0.74);
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionHeader title={t('collections.sectionTitle')} editorialTitle={experience === 'adult'} />
      <Rail itemWidth={width} snap>
        {items.map((item) => (
          <MediaCard
            key={item.id}
            variant="landscape"
            width={width}
            aspectRatio={1.25}
            source={item.image}
            eyebrow={item.status}
            title={item.title}
            subtitle={experience === 'child' ? undefined : item.intro}
            subtitleLines={1}
            footer={
              item.total > 0 ? (
                <View style={styles.collectionProgress}>
                  <Text style={styles.onDarkCaption}>{t('collections.progress', { completed: item.completed, total: item.total })}</Text>
                  <ProgressBar progress={item.completed / item.total} height={3} fillColor={colors.accentGold} trackColor="rgba(251,243,227,0.24)" />
                </View>
              ) : undefined
            }
            onPress={() => onPress(item.id)}
            accessibilityLabel={`${item.title}${item.total > 0 ? `. ${t('collections.progress', { completed: item.completed, total: item.total })}` : ''}`}
          />
        ))}
      </Rail>
    </View>
  );
}

export type ContinueRowData = { key: string; title: string; meta: string; image: ImageSourcePropType | null; route: string };

/** "Continue learning" - in-progress collections and real Daily history,
 * as light rows (thumbnail, title, one line of state). */
export function ContinueLearning({ rows, onPress }: { rows: ContinueRowData[]; onPress: (route: string) => void }) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;
  return (
    <View style={styles.sectionTight}>
      <SectionHeader title={t('culture.v2.continueTitle')} size="sm" />
      <View style={styles.list}>
        {rows.map((row) => (
          <AnimatedPressable key={row.key} style={styles.row} onPress={() => onPress(row.route)} press="soft" accessibilityRole="button" accessibilityLabel={`${row.title}. ${row.meta}`}>
            {row.image ? <Image source={row.image} style={styles.thumb} resizeMode="cover" /> : <View style={[styles.thumb, styles.thumbFallback]} />}
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {row.title}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {row.meta}
              </Text>
            </View>
          </AnimatedPressable>
        ))}
      </View>
    </View>
  );
}

/** Real bundled audio (komuz melodies) as one compact entry. */
export function ListenCard({ trackCount, image, onPress }: { trackCount: number; image: ImageSourcePropType; onPress: () => void }) {
  const { t } = useTranslation();
  if (trackCount === 0) return null;
  return (
    <View style={styles.sectionTight}>
      <SectionHeader title={t('culture.v2.listenTitle')} size="sm" />
      <AnimatedPressable style={[styles.row, styles.listen]} onPress={onPress} press="soft" accessibilityRole="button" accessibilityLabel={`${t('culture.v2.komuzTitle')}. ${t('culture.v2.tracks', { count: trackCount })}`}>
        <Image source={image} style={styles.thumbLarge} resizeMode="cover" />
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {t('culture.v2.komuzTitle')}
          </Text>
          <Text style={styles.rowMeta}>{t('culture.v2.tracks', { count: trackCount })}</Text>
        </View>
        <View style={styles.listenIcon}>
          <Headphones size={18} color={colors.textPrimary} strokeWidth={2.25} />
        </View>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.md },
  section: { gap: spacing.sm },
  sectionTight: { gap: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.md },
  collectionProgress: { gap: 5, maxWidth: 220 },
  onDarkCaption: { ...textStyles.caption, fontWeight: '600', color: colors.textOnDarkSecondary },
  list: { gap: spacing.xs, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.xs, paddingRight: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  thumb: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.surfaceMuted },
  thumbFallback: { backgroundColor: colors.primary },
  thumbLarge: { width: 60, height: 60, borderRadius: 16 },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { ...textStyles.title, fontSize: 16, color: colors.textPrimary },
  rowMeta: { ...textStyles.caption, color: colors.textSecondary },
  listen: { marginHorizontal: spacing.md },
  listenIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentGold },
});
