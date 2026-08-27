import { Image } from 'expo-image';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, ConfirmationModal, IconButton, TextField } from '@/components/ui';
import { callAdminRpc } from '@/services/admin/adminService';
import { pickAndUploadCultureItemImage } from '@/services/admin/mediaUpload';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import { rowToFormValues, type AdminFieldConfig, type AdminRow, type AdminSectionConfig } from './sections';

type AdminSectionScreenProps = {
  section: AdminSectionConfig;
  onPressBack: () => void;
};

function FieldInput({ field, value, onChange }: { field: AdminFieldConfig; value: string; onChange: (v: string) => void }) {
  if (field.type === 'select') {
    return (
      <View style={styles.selectWrap}>
        <Text style={styles.selectLabel}>{field.label}</Text>
        <View style={styles.selectOptions}>
          {field.options?.map((option) => (
            <AnimatedPressable
              key={option || '(empty)'}
              style={[styles.optionPill, value === option && styles.optionPillActive]}
              onPress={() => onChange(option)}
              accessibilityRole="button"
              accessibilityLabel={option || '(empty)'}
            >
              <Text style={[styles.optionLabel, value === option && styles.optionLabelActive]}>
                {option || '(empty)'}
              </Text>
            </AnimatedPressable>
          ))}
        </View>
      </View>
    );
  }

  return (
    <TextField
      label={field.label}
      value={value}
      onChangeText={onChange}
      keyboardType={field.type === 'number' ? 'numeric' : 'default'}
      multiline={field.type === 'textarea' || field.type === 'array'}
      numberOfLines={field.type === 'array' ? 4 : 6}
    />
  );
}

/** Generic list+create+edit+delete screen driven by an AdminSectionConfig
 * (features/admin/sections.ts) - one implementation covers all 6 content
 * tables instead of 6 bespoke screens, since they're all the same shape
 * (a table of rows, each edited through one admin_upsert_* RPC). */
export function AdminSectionScreen({ section, onPressBack }: AdminSectionScreenProps) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [editingRow, setEditingRow] = useState<AdminRow | 'new' | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const { data: rows, isLoading, error } = useQuery({
    queryKey: ['admin_section', section.id],
    queryFn: section.fetch,
  });

  const saveMutation = useMutation({
    mutationFn: (values: Record<string, string>) => callAdminRpc(section.upsertRpc, section.toParams(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_section', section.id] });
      setEditingRow(null);
      setSaveError(null);
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => callAdminRpc(section.deleteRpc, { p_id: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_section', section.id] });
      setPendingDeleteId(null);
    },
  });

  function openEdit(row: AdminRow) {
    setEditingRow(row);
    setFormValues(rowToFormValues(section, row));
    setSaveError(null);
    setImageUrl((row.image_url as string | null) ?? null);
    setImageError(null);
  }

  function openCreate() {
    setEditingRow('new');
    setFormValues(rowToFormValues(section, null));
    setSaveError(null);
    setImageUrl(null);
    setImageError(null);
  }

  async function handleUploadImage() {
    if (editingRow === 'new' || !editingRow) return;
    setIsUploadingImage(true);
    setImageError(null);
    try {
      const url = await pickAndUploadCultureItemImage(String(editingRow[section.idField]));
      if (url) {
        setImageUrl(url);
        queryClient.invalidateQueries({ queryKey: ['admin_section', section.id] });
      }
    } catch (err) {
      setImageError((err as Error).message);
    } finally {
      setIsUploadingImage(false);
    }
  }

  if (editingRow) {
    const isNew = editingRow === 'new';
    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel="Back" onPress={() => setEditingRow(null)} />
          <Text style={styles.title} numberOfLines={1}>{isNew ? 'New' : 'Edit'}</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {section.id === 'culture_items' && !isNew && (
            <View style={styles.imageBlock}>
              <Text style={styles.selectLabel}>Photo (content-media)</Text>
              {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.imagePreview} contentFit="cover" /> : null}
              {imageError && <Text style={styles.error}>{imageError}</Text>}
              <Button
                label={imageUrl ? 'Replace photo' : 'Upload photo'}
                variant="secondary"
                onPress={handleUploadImage}
                loading={isUploadingImage}
              />
            </View>
          )}

          {section.fields.map((field) => (
            <FieldInput
              key={field.key}
              field={field}
              value={formValues[field.key] ?? ''}
              onChange={(v) => setFormValues((prev) => ({ ...prev, [field.key]: v }))}
            />
          ))}

          {saveError && <Text style={styles.error}>{saveError}</Text>}

          <Button
            label={isNew ? 'Create' : 'Save'}
            onPress={() => saveMutation.mutate(formValues)}
            loading={saveMutation.isPending}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel="Back" onPress={onPressBack} />
        <Text style={styles.title} numberOfLines={1}>{section.label}</Text>
        <IconButton icon={Plus} shape="roundedSquare" accessibilityLabel="New" onPress={openCreate} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{(error as Error).message}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {(rows ?? []).map((row) => {
            const id = String(row[section.idField]);
            return (
              <View key={id} style={styles.row}>
                <AnimatedPressable style={styles.rowMain} onPress={() => openEdit(row)} accessibilityRole="button" accessibilityLabel={id}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{String(row[section.titleField] ?? id)}</Text>
                  <Text style={styles.rowId} numberOfLines={1}>{id}</Text>
                </AnimatedPressable>
                <IconButton icon={Trash2} shape="roundedSquare" accessibilityLabel="Delete" onPress={() => setPendingDeleteId(id)} />
              </View>
            );
          })}
          {!rows?.length && <Text style={styles.empty}>No rows yet - tap + to create one.</Text>}
        </ScrollView>
      )}

      <ConfirmationModal
        visible={!!pendingDeleteId}
        title="Delete this row?"
        message="This can't be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        isConfirming={deleteMutation.isPending}
        onConfirm={() => pendingDeleteId && deleteMutation.mutate(pendingDeleteId)}
        onCancel={() => setPendingDeleteId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  rowId: {
    ...typography.small,
    color: colors.textMuted,
  },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  error: {
    ...typography.body,
    color: colors.danger,
  },
  imageBlock: {
    gap: spacing.xs,
  },
  imagePreview: {
    width: '100%',
    height: 160,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceAlt,
  },
  selectWrap: {
    gap: spacing.xxs,
  },
  selectLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  selectOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  optionPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  optionPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionLabel: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  optionLabelActive: {
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
});
