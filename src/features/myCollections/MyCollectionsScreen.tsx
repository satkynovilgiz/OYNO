import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, radii, spacing, textStyles, typography } from '@/theme';

import { CollectionCover } from './CollectionCover';
import { coverFor, DESCRIPTION_MAX, NAME_MAX, resolveEntries, validateDescription, validateName } from './myCollectionsModel';
import { useCollectionActions, useContentResolver, useMyCollections } from './useMyCollections';
import { usePrivateSyncScope } from '@/services/sync/privateSync/usePrivateSyncScope';

export function myCollectionRoute(id: string): string {
  return `/profile/my-collections/${id}`;
}

/** /profile/my-collections - the user's own private collections (OYNO's
 * editorial Collections are separate and unchanged). */
export function MyCollectionsScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const syncScope = usePrivateSyncScope();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const { data, owner } = useMyCollections();
  const actions = useCollectionActions(owner);
  const { resolve } = useContentResolver();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const nameProblem = name.trim() ? validateName(name) : null;
  const descriptionProblem = validateDescription(description);
  const large = experience === 'child';
  const coverSize = large ? 88 : experience === 'adult' ? 56 : 68;

  function create() {
    if (validateName(name) || descriptionProblem) return;
    const collection = actions.create({ name, description });
    setName('');
    setDescription('');
    setCreating(false);
    router.push(myCollectionRoute(collection.id) as never);
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {t('myCollections.title')}
        </Text>
        <IconButton icon={Plus} shape="roundedSquare" accessibilityLabel={t('myCollections.new')} onPress={() => setCreating(true)} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.note}>{t('myCollections.intro')}</Text>

        {creating ? (
          <View style={styles.form}>
            <Text style={styles.formTitle}>{t('myCollections.create')}</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t('myCollections.namePlaceholder')} placeholderTextColor={colors.textMuted} autoFocus accessibilityLabel={t('myCollections.nameLabel')} />
            {nameProblem ? <Text style={styles.error}>{t(`myCollections.problem.${nameProblem}`, { max: NAME_MAX })}</Text> : null}
            <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} placeholder={t('myCollections.descriptionPlaceholder')} placeholderTextColor={colors.textMuted} multiline accessibilityLabel={t('myCollections.descriptionLabel')} />
            {descriptionProblem ? <Text style={styles.error}>{t(`myCollections.problem.${descriptionProblem}`, { max: DESCRIPTION_MAX })}</Text> : null}
            <View style={styles.formActions}>
              <Button label={t('myCollections.create')} onPress={create} disabled={!!validateName(name) || !!descriptionProblem} />
              <Button label={t('myCollections.cancel')} variant="secondary" onPress={() => setCreating(false)} />
            </View>
          </View>
        ) : null}

        {data.collections.length === 0 && !creating ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('myCollections.emptyList')}</Text>
            <Button label={t('myCollections.create')} onPress={() => setCreating(true)} />
          </View>
        ) : null}

        {data.collections.map((collection) => {
          const entries = resolveEntries(data, collection.id, resolve);
          const count = entries.length;
          return (
            <AnimatedPressable
              key={collection.id}
              style={[styles.row, large && styles.rowLarge]}
              onPress={() => router.push(myCollectionRoute(collection.id) as never)}
              accessibilityRole="button"
              accessibilityLabel={`${collection.name}. ${t('myCollections.itemCount', { count })}.`}
            >
              <CollectionCover source={coverFor(entries) as ImageSourcePropType | null} size={coverSize} radius={radii.md} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.name, large && styles.nameLarge]} numberOfLines={2}>
                  {collection.name}
                </Text>
                <Text style={styles.meta}>{t('myCollections.itemCount', { count })}</Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
            </AnimatedPressable>
          );
        })}
        <Text style={styles.footnote}>{t(syncScope === 'account' ? 'myCollections.accountNote' : 'myCollections.deviceNote')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm },
  note: { ...textStyles.small, color: colors.textSecondary },
  form: { gap: spacing.xs, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  formTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  input: { ...textStyles.body, color: colors.textPrimary, minHeight: 48, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: radii.md, paddingHorizontal: spacing.sm, backgroundColor: colors.background },
  multiline: { minHeight: 72, paddingTop: spacing.sm, textAlignVertical: 'top' },
  formActions: { gap: spacing.xs, marginTop: spacing.xs },
  error: { ...textStyles.small, color: colors.error },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  emptyText: { ...textStyles.body, color: colors.textSecondary, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  rowLarge: { padding: spacing.md },
  name: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  nameLarge: { fontSize: 18, lineHeight: 24 },
  meta: { ...textStyles.small, color: colors.textSecondary },
  footnote: { ...textStyles.small, color: colors.textMuted, marginTop: spacing.sm },
});
