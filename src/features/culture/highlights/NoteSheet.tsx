import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { colors, radii, spacing, textStyles, typography } from '@/theme';

import { NOTE_MAX, validateNote } from './highlightsModel';
import { usePrivateSyncScope } from '@/services/sync/privateSync/usePrivateSyncScope';

/** Private note editor (max 500). Empty + Save removes the note only. */
export function NoteSheet({ initial, onSave, onClose }: { initial: string | null; onSave: (note: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const syncScope = usePrivateSyncScope();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [note, setNote] = useState(initial ?? '');
  const problem = validateNote(note);
  return (
    <Modal visible transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('highlights.cancel')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} accessibilityViewIsModal>
        <Text style={styles.title} accessibilityRole="header">
          {initial ? t('highlights.editNote') : t('highlights.addNote')}
        </Text>
        <TextInput
          style={styles.input}
          value={note}
          onChangeText={setNote}
          multiline
          autoFocus
          placeholder={t('highlights.notePlaceholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('highlights.noteLabel')}
        />
        <Text style={[styles.counter, problem && styles.error]}>{note.trim().length}/{NOTE_MAX}</Text>
        <Text style={styles.private}>{t(syncScope === 'account' ? 'highlights.notePrivateAccount' : 'highlights.notePrivate')}</Text>
        <Button label={t('highlights.saveNote')} onPress={() => onSave(note)} disabled={!!problem} />
        {initial ? <Button label={t('highlights.removeNote')} variant="secondary" onPress={() => onSave('')} /> : null}
        <Button label={t('highlights.cancel')} variant="secondary" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,24,18,0.45)' },
  sheet: { gap: spacing.sm, padding: spacing.md, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, backgroundColor: colors.background },
  title: { ...typography.h2, color: colors.textPrimary },
  input: { ...textStyles.body, color: colors.textPrimary, minHeight: 120, padding: spacing.sm, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: radii.md, backgroundColor: colors.surface, textAlignVertical: 'top' },
  counter: { ...textStyles.small, color: colors.textMuted, alignSelf: 'flex-end' },
  error: { color: colors.error },
  private: { ...textStyles.small, color: colors.textMuted },
});
