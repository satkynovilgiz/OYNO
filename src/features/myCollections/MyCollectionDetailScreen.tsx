import { router } from 'expo-router';
import { ArrowDown, ArrowUp, ChevronLeft, Pencil, Share2, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { contentTypeMeta } from '@/components/library/contentTypeMeta';
import { NotFoundState } from '@/components/system/NotFoundState';
import { AnimatedPressable, Button, ConfirmationModal, IconButton } from '@/components/ui';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import type { CatalogContentType } from '@/services/content/contentCatalog';
import { useShareCard } from '@/services/share/useShareCard';
import { colors, editorial, radii, spacing, textStyles, typography } from '@/theme';

import { CollectionCover } from './CollectionCover';
import { buildMyCollectionShareCard } from './myCollectionShare';
import { coverFor, DESCRIPTION_MAX, filterEntries, NAME_MAX, resolveEntries, SEARCH_MIN_ITEMS, validateDescription, validateName, type CollectionEntry } from './myCollectionsModel';
import { useCollectionActions, useContentResolver, useMyCollections } from './useMyCollections';

/**
 * /profile/my-collections/[id] - one private collection: name, optional
 * description, items (each with its type), reorder by Move up / Move down,
 * remove a membership (never the content, Saved or progress), rename,
 * delete with confirmation. Missing content shows "Content unavailable"
 * and can be removed.
 */
export function MyCollectionDetailScreen({ collectionId, onPressBack }: { collectionId: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const { data, owner, isLoaded } = useMyCollections();
  const actions = useCollectionActions(owner);
  const { resolve, ready } = useContentResolver();
  const { share, shareHost } = useShareCard();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [query, setQuery] = useState('');
  const collection = data.collections.find((candidate) => candidate.id === collectionId) ?? null;
  const isChild = experience === 'child';
  const isAdult = experience === 'adult';

  if (!isLoaded) return <View style={styles.root} />;
  if (!collection) return <NotFoundState onPressBack={onPressBack} />;

  const entries = resolveEntries(data, collection.id, resolve);
  const shown = entries.length >= SEARCH_MIN_ITEMS ? filterEntries(entries, query) : entries;
  const nameProblem = editing && name.trim() ? validateName(name) : null;
  const descriptionProblem = editing ? validateDescription(description) : null;

  function startEdit() {
    setName(collection!.name);
    setDescription(collection!.description ?? '');
    setEditing(true);
  }

  function saveEdit() {
    if (validateName(name) || validateDescription(description)) return;
    actions.edit(collection!.id, { name, description });
    setEditing(false);
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <View style={{ flex: 1 }} />
        <IconButton
          icon={Share2}
          shape="roundedSquare"
          accessibilityLabel={t('myCollections.share')}
          onPress={() => void share(buildMyCollectionShareCard({ name: collection.name, itemCountLabel: t('myCollections.itemCount', { count: entries.length }), label: t('myCollections.title'), cover: coverFor(entries) as ImageSourcePropType | null }), collection.name)}
        />
        <IconButton icon={Pencil} shape="roundedSquare" accessibilityLabel={t('myCollections.edit')} onPress={startEdit} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <CollectionCover source={coverFor(entries) as ImageSourcePropType | null} size={isChild ? 96 : 72} radius={radii.lg} />
          <View style={{ flex: 1, gap: 4 }}>
            {/* User text is shown exactly as typed - never translated. */}
            <Text style={[styles.name, isAdult && styles.nameEditorial]} accessibilityRole="header">
              {collection.name}
            </Text>
            <Text style={styles.count}>{t('myCollections.itemCount', { count: entries.length })}</Text>
          </View>
        </View>
        {collection.description ? <Text style={styles.description}>{collection.description}</Text> : null}

        {editing ? (
          <View style={styles.form}>
            <Text style={styles.formTitle}>{t('myCollections.edit')}</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} accessibilityLabel={t('myCollections.nameLabel')} />
            {nameProblem ? <Text style={styles.error}>{t(`myCollections.problem.${nameProblem}`, { max: NAME_MAX })}</Text> : null}
            <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} multiline placeholder={t('myCollections.descriptionPlaceholder')} placeholderTextColor={colors.textMuted} accessibilityLabel={t('myCollections.descriptionLabel')} />
            {descriptionProblem ? <Text style={styles.error}>{t(`myCollections.problem.${descriptionProblem}`, { max: DESCRIPTION_MAX })}</Text> : null}
            <Button label={t('myCollections.save')} onPress={saveEdit} disabled={!!validateName(name) || !!descriptionProblem} />
            <Button label={t('myCollections.cancel')} variant="secondary" onPress={() => setEditing(false)} />
            <AnimatedPressable style={styles.delete} onPress={() => setConfirmDelete(true)} accessibilityRole="button" accessibilityLabel={t('myCollections.delete')}>
              <Trash2 size={16} color={colors.error} strokeWidth={2.25} />
              <Text style={styles.deleteText}>{t('myCollections.delete')}</Text>
            </AnimatedPressable>
          </View>
        ) : null}

        {entries.length >= SEARCH_MIN_ITEMS ? (
          <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder={t('myCollections.search')} placeholderTextColor={colors.textMuted} accessibilityLabel={t('myCollections.search')} />
        ) : null}

        {entries.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('myCollections.emptyTitle')}</Text>
            <Text style={styles.emptyText}>{t('myCollections.emptyBody')}</Text>
            <Button label={t('myCollections.browse')} onPress={() => router.push('/home' as never)} />
          </View>
        ) : (
          <View style={{ gap: spacing.xs }}>
            {shown.map((entry) => {
              const index = entries.indexOf(entry);
              return (
                <EntryRow
                  key={`${entry.item.contentType}:${entry.item.contentId}`}
                  entry={entry}
                  loading={!ready}
                  large={isChild}
                  collectionName={collection.name}
                  canMoveUp={index > 0 && !query}
                  canMoveDown={index < entries.length - 1 && !query}
                  onMove={(delta) => actions.move(collection.id, index, delta)}
                  onRemove={() => actions.removeItem(collection.id, entry.item.contentType, entry.item.contentId)}
                />
              );
            })}
          </View>
        )}
        <Text style={styles.footnote}>{t('myCollections.deviceNote')}</Text>
      </ScrollView>

      <ConfirmationModal
        visible={confirmDelete}
        title={t('myCollections.deleteTitle')}
        message={t('myCollections.deleteBody')}
        confirmLabel={t('myCollections.delete')}
        cancelLabel={t('myCollections.cancel')}
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          actions.remove(collection.id);
          onPressBack();
        }}
      />
      {shareHost}
    </View>
  );
}

function EntryRow({
  entry,
  loading,
  large,
  collectionName,
  canMoveUp,
  canMoveDown,
  onMove,
  onRemove,
}: {
  entry: CollectionEntry;
  loading: boolean;
  large: boolean;
  collectionName: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const meta = contentTypeMeta(entry.item.contentType as CatalogContentType);
  const typeLabel = t(meta.labelKey);
  const content = entry.content;
  const title = content?.title ?? (loading ? '…' : t('myCollections.unavailable'));
  const thumb = (content?.thumbnail as ImageSourcePropType | null) ?? null;

  return (
    <View style={[styles.entry, large && styles.entryLarge]}>
      <AnimatedPressable
        style={styles.entryMain}
        onPress={() => content?.route && router.push(content.route as never)}
        disabled={!content?.route}
        accessibilityRole={content?.route ? 'button' : undefined}
        accessibilityLabel={`${title}. ${typeLabel}.`}
      >
        <View style={[styles.thumb, { backgroundColor: meta.tone }]}>
          <CollectionCover source={thumb} size={large ? 64 : 48} radius={radii.md} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.entryType, { color: meta.tone }]}>{typeLabel}</Text>
          <Text style={[styles.entryTitle, !content && !loading && styles.unavailable]} numberOfLines={2}>
            {title}
          </Text>
        </View>
      </AnimatedPressable>
      {!large ? (
        <>
          <IconButton icon={ArrowUp} size={32} iconSize={14} elevated={false} disabled={!canMoveUp} accessibilityLabel={t('myCollections.moveUpNamed', { name: title })} onPress={() => onMove(-1)} />
          <IconButton icon={ArrowDown} size={32} iconSize={14} elevated={false} disabled={!canMoveDown} accessibilityLabel={t('myCollections.moveDownNamed', { name: title })} onPress={() => onMove(1)} />
        </>
      ) : null}
      <IconButton icon={X} size={32} iconSize={14} elevated={false} accessibilityLabel={t('myCollections.removeNamed', { name: title, collection: collectionName })} onPress={onRemove} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { ...typography.h1, color: colors.textPrimary },
  nameEditorial: { ...editorial(typography.h1) },
  count: { ...textStyles.small, color: colors.textSecondary },
  description: { ...textStyles.body, color: colors.textSecondary },
  form: { gap: spacing.xs, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  formTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  input: { ...textStyles.body, color: colors.textPrimary, minHeight: 48, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: radii.md, paddingHorizontal: spacing.sm, backgroundColor: colors.background },
  multiline: { minHeight: 72, paddingTop: spacing.sm, textAlignVertical: 'top' },
  error: { ...textStyles.small, color: colors.error },
  delete: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44, alignSelf: 'flex-start' },
  deleteText: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.error },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, paddingHorizontal: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface },
  emptyTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  emptyText: { ...textStyles.small, color: colors.textSecondary, textAlign: 'center' },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: spacing.xs, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  entryLarge: { padding: spacing.sm },
  entryMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  thumb: { borderRadius: radii.md, overflow: 'hidden' },
  entryType: { ...typography.overline, fontSize: 10 },
  entryTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  unavailable: { color: colors.textMuted, fontStyle: 'italic' },
  footnote: { ...textStyles.small, color: colors.textMuted },
});
