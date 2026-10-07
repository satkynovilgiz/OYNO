import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button, type ButtonVariant } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

type Choice = { label: string; onPress: () => void; variant: ButtonVariant; testID: string; loading?: boolean; disabled?: boolean };

/**
 * A bottom sheet with a stacked list of choices. `onDismiss` is what
 * Android back / Escape does - always the choice that loses nothing.
 * (Same sheet look and web dialog naming as ConfirmationModal.)
 */
function ChoiceSheet({ visible, title, message, choices, onDismiss, testID }: { visible: boolean; title: string; message: string; choices: Choice[]; onDismiss: () => void; testID: string }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss} {...({ 'aria-label': title } as object)}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID={testID}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            {choices.map((choice) => (
              <Button key={choice.testID} label={choice.label} variant={choice.variant} block onPress={choice.onPress} loading={choice.loading} disabled={choice.disabled} testID={choice.testID} />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Leaving a dirty editor: Save / Discard / Keep editing (back = keep editing). */
export function LeaveEditorModal({ visible, saving, onSave, onDiscard, onKeepEditing }: { visible: boolean; saving: boolean; onSave: () => void; onDiscard: () => void; onKeepEditing: () => void }) {
  const { t } = useTranslation();
  return (
    <ChoiceSheet
      visible={visible}
      testID="journal-leave-dialog"
      title={t('journal.draft.leaveTitle')}
      message={t('journal.draft.leaveBody')}
      onDismiss={onKeepEditing}
      choices={[
        { label: t('journal.draft.save'), variant: 'primary', onPress: onSave, loading: saving, testID: 'journal-leave-save' },
        { label: t('journal.draft.discardChanges'), variant: 'destructive', onPress: onDiscard, disabled: saving, testID: 'journal-leave-discard' },
        { label: t('journal.draft.keepEditing'), variant: 'secondary', onPress: onKeepEditing, disabled: saving, testID: 'journal-leave-keep' },
      ]}
    />
  );
}

/** Reopening with unfinished writing: Restore / Discard (back = restore - nothing is lost). */
export function RestoreDraftModal({ visible, isNew, entryChangedSince, onRestore, onDiscard }: { visible: boolean; isNew: boolean; entryChangedSince: boolean; onRestore: () => void; onDiscard: () => void }) {
  const { t } = useTranslation();
  return (
    <ChoiceSheet
      visible={visible}
      testID="journal-restore-dialog"
      title={t('journal.draft.restoreTitle')}
      message={entryChangedSince ? t('journal.draft.restoreChangedBody') : isNew ? t('journal.draft.restoreBodyNew') : t('journal.draft.restoreBody')}
      onDismiss={onRestore}
      choices={[
        { label: t('journal.draft.restore'), variant: 'primary', onPress: onRestore, testID: 'journal-restore' },
        { label: t('journal.draft.discard'), variant: 'destructive', onPress: onDiscard, testID: 'journal-restore-discard' },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,14,8,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.xl, gap: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary },
  message: { ...typography.body, color: colors.textSecondary },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
