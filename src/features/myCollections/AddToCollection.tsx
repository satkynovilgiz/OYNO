import { Check, FolderPlus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { colors, radii, spacing, textStyles, typography } from '@/theme';

import { contains, itemsOf, NAME_MAX, validateName, type CollectionContentType } from './myCollectionsModel';
import { useCollectionActions, useMyCollections } from './useMyCollections';

type Props = { contentType: CollectionContentType; contentId: string; title: string; size?: number; iconSize?: number; elevated?: boolean };

/**
 * "Add to collection" - an action NEXT TO the existing Save (heart), never
 * replacing it. Opens a compact sheet: tick collections to add/remove this
 * item, or create a new one inline (it's added straight away).
 */
export function AddToCollectionButton({ contentType, contentId, title, size = 40, iconSize = 19, elevated }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton icon={FolderPlus} size={size} iconSize={iconSize} shape="roundedSquare" elevated={elevated} accessibilityLabel={t('myCollections.addNamed', { name: title })} onPress={() => setOpen(true)} />
      {open ? <AddToCollectionSheet contentType={contentType} contentId={contentId} title={title} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function AddToCollectionSheet({ contentType, contentId, title, onClose }: Omit<Props, 'size' | 'iconSize' | 'elevated'> & { onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data, owner } = useMyCollections();
  const actions = useCollectionActions(owner);
  const [creating, setCreating] = useState(data.collections.length === 0);
  const [name, setName] = useState('');
  const problem = name.trim() ? validateName(name) : null;

  function create() {
    if (validateName(name)) return;
    const collection = actions.create({ name });
    actions.add(collection.id, contentType, contentId);
    setName('');
    setCreating(false);
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('myCollections.close')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} accessibilityViewIsModal>
        <View style={styles.handle} />
        <Text style={styles.title} accessibilityRole="header">
          {t('myCollections.addTo')}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {title}
        </Text>
        <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: spacing.xs }} keyboardShouldPersistTaps="handled">
          {data.collections.map((collection) => {
            const inside = contains(data, collection.id, contentType, contentId);
            const count = itemsOf(data, collection.id).length;
            return (
              <AnimatedPressable
                key={collection.id}
                style={[styles.row, inside && styles.rowOn]}
                onPress={() => (inside ? actions.removeItem(collection.id, contentType, contentId) : actions.add(collection.id, contentType, contentId))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: inside }}
                aria-checked={inside}
                accessibilityLabel={`${collection.name}. ${t('myCollections.itemCount', { count })}. ${inside ? t('myCollections.added') : t('myCollections.notAdded')}`}
              >
                <View style={[styles.check, inside && styles.checkOn]}>{inside ? <Check size={14} color={colors.textOnDark} strokeWidth={3} /> : null}</View>
                <Text style={styles.rowName} numberOfLines={1}>
                  {collection.name}
                </Text>
                <Text style={styles.rowMeta}>{inside ? t('myCollections.added') : count}</Text>
              </AnimatedPressable>
            );
          })}
        </ScrollView>

        {creating ? (
          <View style={styles.create}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('myCollections.namePlaceholder')}
              placeholderTextColor={colors.textMuted}
              maxLength={NAME_MAX + 10}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={create}
              accessibilityLabel={t('myCollections.nameLabel')}
            />
            {problem ? <Text style={styles.error}>{t(`myCollections.problem.${problem}`, { max: NAME_MAX })}</Text> : null}
            <Button label={t('myCollections.createAndAdd')} onPress={create} disabled={!!validateName(name)} />
          </View>
        ) : (
          <AnimatedPressable style={styles.newRow} onPress={() => setCreating(true)} accessibilityRole="button" accessibilityLabel={t('myCollections.new')}>
            <Plus size={16} color={colors.primary} strokeWidth={2.5} />
            <Text style={styles.newText}>{t('myCollections.new')}</Text>
          </AnimatedPressable>
        )}
        <Text style={styles.note}>{t('myCollections.privateNote')}</Text>
        <Button label={t('myCollections.done')} variant="secondary" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,24,18,0.45)' },
  sheet: { gap: spacing.sm, padding: spacing.md, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, backgroundColor: colors.background },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderSubtle },
  title: { ...typography.h2, color: colors.textPrimary },
  subtitle: { ...textStyles.small, color: colors.textSecondary, marginTop: -spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surface },
  rowOn: { backgroundColor: colors.surfaceElevated },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  rowName: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  rowMeta: { ...textStyles.small, color: colors.textSecondary },
  create: { gap: spacing.xs },
  input: { ...textStyles.body, color: colors.textPrimary, minHeight: 48, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: radii.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surface },
  error: { ...textStyles.small, color: colors.error },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44 },
  newText: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.primary },
  note: { ...textStyles.small, color: colors.textMuted },
});
