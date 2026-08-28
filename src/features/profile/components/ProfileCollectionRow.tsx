import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, TextButton } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import type { ProfileCollectionItem } from '../types';

type ProfileCollectionRowProps = {
  items: ProfileCollectionItem[];
  onPressItem?: (item: ProfileCollectionItem) => void;
  onPressSeeAll?: () => void;
};

export function ProfileCollectionRow({ items, onPressItem, onPressSeeAll }: ProfileCollectionRowProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>{t('profile.collection.title')}</Text>
        <TextButton
          label={t('common.seeAll')}
          onPress={onPressSeeAll}
          trailingIcon={<ChevronRight size={14} color={colors.primary} strokeWidth={2.25} />}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
        {items.map((item) => (
          <AnimatedPressable
            key={item.id}
            style={styles.card}
            onPress={() => onPressItem?.(item)}
            accessibilityRole="button"
            accessibilityLabel={item.title}
          >
            <Image source={item.imageSource} style={styles.image} resizeMode="cover" />
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.progress}>
              {item.current} / {item.total}
            </Text>
          </AnimatedPressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  list: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  card: {
    width: 92,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xxs,
    gap: 2,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
  },
  image: {
    width: 84,
    height: 84,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
  },
  title: {
    ...typography.small,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: 2,
  },
  progress: {
    ...typography.small,
    color: colors.textMuted,
  },
});
