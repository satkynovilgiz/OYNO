import { router } from 'expo-router';
import { ChevronRight, FolderPlus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, SectionHeader } from '@/components/ui';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

import { itemsOf } from './myCollectionsModel';
import { myCollectionRoute } from './MyCollectionsScreen';
import { useMyCollections } from './useMyCollections';

const SHOWN = 3;

/** Compact "My Collections" block for Saved: up to three collections with
 * their item counts and See all - or one quiet row to start one. */
export function MyCollectionsSavedSection() {
  const { t } = useTranslation();
  const { data } = useMyCollections();

  if (data.collections.length === 0) {
    return (
      <AnimatedPressable style={styles.start} onPress={() => router.push('/profile/my-collections' as never)} press="soft" accessibilityRole="button" accessibilityLabel={`${t('myCollections.title')}. ${t('myCollections.startHint')}`}>
        <FolderPlus size={17} color={colors.primary} strokeWidth={2} />
        <View style={{ flex: 1 }}>
          <Text style={styles.startTitle}>{t('myCollections.title')}</Text>
          <Text style={styles.meta}>{t('myCollections.startHint')}</Text>
        </View>
        <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
      </AnimatedPressable>
    );
  }

  return (
    <View style={styles.section}>
      <SectionHeader title={t('myCollections.title')} count={data.collections.length} size="sm" inset={0} actionLabel={t('myCollections.seeAll')} onPressAction={() => router.push('/profile/my-collections' as never)} />
      {data.collections.slice(0, SHOWN).map((collection) => {
        const count = itemsOf(data, collection.id).length;
        return (
          <AnimatedPressable key={collection.id} style={styles.row} onPress={() => router.push(myCollectionRoute(collection.id) as never)} press="soft" accessibilityRole="button" accessibilityLabel={`${collection.name}. ${t('myCollections.itemCount', { count })}.`}>
            <Text style={styles.name} numberOfLines={1}>
              {collection.name}
            </Text>
            <Text style={styles.meta}>{count}</Text>
            <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs },
  start: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  startTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  name: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  meta: { ...textStyles.small, color: colors.textSecondary },
});
