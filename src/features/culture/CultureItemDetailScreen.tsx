import { Image as ExpoImage } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Image, type ImageSourcePropType, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, Badge } from '@/components/ui';
import type { KomuzTrack } from '@/features/culture/audioData';
import { KomuzPlaylist } from '@/features/culture/components';
import { SettingsScreenLayout } from '@/features/settings/components/SettingsScreenLayout';
import type { CultureItemRow } from '@/services/content/types';
import { colors, radii, shadows, spacing, typography } from '@/theme';

type CultureItemDetailScreenProps = {
  item: CultureItemRow;
  images?: ImageSourcePropType[];
  audioTracks?: KomuzTrack[];
  onPressBack: () => void;
};

const DETAIL_FIELDS: { key: keyof CultureItemRow; labelKey: string }[] = [
  { key: 'origin', labelKey: 'culture.item.originLabel' },
  { key: 'history', labelKey: 'culture.item.historyLabel' },
  { key: 'cultural_meaning', labelKey: 'culture.item.culturalMeaningLabel' },
  { key: 'when_used', labelKey: 'culture.item.whenUsedLabel' },
  { key: 'ingredients', labelKey: 'culture.item.ingredientsLabel' },
  { key: 'traditional_method', labelKey: 'culture.item.traditionalMethodLabel' },
  { key: 'who_participates', labelKey: 'culture.item.whoParticipatesLabel' },
  { key: 'objects_used', labelKey: 'culture.item.objectsUsedLabel' },
  { key: 'regional_notes', labelKey: 'culture.item.regionalNotesLabel' },
  { key: 'modern_status', labelKey: 'culture.item.modernStatusLabel' },
  { key: 'fun_facts', labelKey: 'culture.item.funFactsLabel' },
];

export function CultureItemDetailScreen({ item, images, audioTracks, onPressBack }: CultureItemDetailScreenProps) {
  const { t } = useTranslation();

  const filledFields = DETAIL_FIELDS.filter((field) => !!item[field.key]);
  const hasAudio = !!audioTracks && audioTracks.length > 0;

  return (
    <SettingsScreenLayout title={item.title} onPressBack={onPressBack}>
      <View style={styles.headerBlock}>
        {item.alt_names ? <Text style={styles.altNames}>{item.alt_names}</Text> : null}
        {item.type_label ? (
          <Badge label={t(`culture.item.type.${item.type_label}`)} color={colors.surfaceAlt} textColor={colors.primary} />
        ) : null}
        <Badge label={t(`culture.item.accuracy.${item.accuracy_level}`)} color={colors.surfaceAlt} textColor={colors.textSecondary} />
      </View>

      {(item.image_url || (images && images.length > 0)) ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
          {item.image_url ? (
            // Storage-backed (admin-uploaded, see admin_set_culture_item_image)
            // - expo-image gives this one real disk/memory caching, unlike
            // the bundled images below which are already local and don't
            // need it.
            <ExpoImage source={{ uri: item.image_url }} style={styles.galleryImage} contentFit="cover" cachePolicy="disk" />
          ) : null}
          {images?.map((source, index) => (
            <Image key={index} source={source} style={styles.galleryImage} resizeMode="cover" />
          ))}
        </ScrollView>
      ) : null}

      {hasAudio ? (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('culture.item.tracksLabel')}</Text>
          <KomuzPlaylist tracks={audioTracks} />
        </View>
      ) : null}

      {filledFields.length === 0 ? (
        hasAudio ? null : <Text style={styles.pending}>{t('culture.item.pendingResearch')}</Text>
      ) : (
        <View style={styles.fields}>
          {filledFields.map((field) => (
            <View key={field.key} style={styles.field}>
              <Text style={styles.fieldLabel}>{t(field.labelKey)}</Text>
              <Text style={styles.fieldValue}>{item[field.key] as string}</Text>
            </View>
          ))}
        </View>
      )}

      {item.sources && item.sources.length > 0 ? (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('culture.item.sourcesLabel')}</Text>
          {item.sources.map((url) => (
            <AnimatedPressable key={url} onPress={() => Linking.openURL(url)} accessibilityRole="link">
              <Text style={styles.sourceLink} numberOfLines={1}>
                {url}
              </Text>
            </AnimatedPressable>
          ))}
        </View>
      ) : null}
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  altNames: {
    ...typography.body,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  gallery: {
    gap: spacing.sm,
  },
  galleryImage: {
    width: 220,
    height: 160,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
  },
  pending: {
    ...typography.body,
    color: colors.textSecondary,
  },
  fields: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xxs,
  },
  fieldLabel: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  fieldValue: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 21,
  },
  sourceLink: {
    ...typography.small,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
