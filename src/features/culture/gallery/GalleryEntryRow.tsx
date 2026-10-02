import { router } from 'expo-router';
import { ChevronRight, Images } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

/** One compact Culture entry into the image gallery (no new tab). */
export function GalleryEntryRow() {
  const { t } = useTranslation();
  return (
    <AnimatedPressable style={styles.row} onPress={() => router.push('/culture/gallery' as never)} press="soft" accessibilityRole="button" accessibilityLabel={`${t('cultureGallery.entry')}. ${t('cultureGallery.entryMeta')}`}>
      <Images size={18} color={colors.primary} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>{t('cultureGallery.entry')}</Text>
        <Text style={styles.meta}>{t('cultureGallery.entryMeta')}</Text>
      </View>
      <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  title: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
});
