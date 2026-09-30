import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, TextField } from '@/components/ui';
import { callAdminRpc } from '@/services/admin/adminService';
import { colors, spacing, typography } from '@/theme';

import { ADMIN_REVIEW_NOTES_KEY, type AdminReviewNote } from '../useAdminData';

/** The one editor-only review note for this content (what still needs
 * checking, which source to consult). Never shown to readers. */
export function ReviewNotePanel({ contentType, contentId, notes, onDirtyChange }: { contentType: string; contentId: string; notes: readonly AdminReviewNote[]; onDirtyChange: (dirty: boolean) => void }) {
  const queryClient = useQueryClient();
  const saved = notes.find((note) => note.content_type === contentType && note.content_id === contentId) ?? null;
  const [value, setValue] = useState(saved?.note ?? '');
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const dirty = value.trim() !== (saved?.note ?? '').trim();

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const save = useMutation({
    mutationFn: () => callAdminRpc('admin_upsert_content_review_note', { p_content_type: contentType, p_content_id: contentId, p_note: value.trim() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_REVIEW_NOTES_KEY });
      setState('saved');
      setError(null);
    },
    onError: (err: Error) => {
      setState('error');
      setError(err.message);
    },
  });

  return (
    <View style={styles.wrap}>
      <TextField
        label="Review note (editors only)"
        value={value}
        onChangeText={(text) => {
          setValue(text);
          setState('idle');
        }}
        placeholder="What still needs checking, which source to consult"
        multiline
        numberOfLines={3}
        error={state === 'error' ? error : null}
      />
      <View style={styles.footer}>
        <Text style={styles.state} accessibilityLiveRegion="polite">
          {state === 'saved' ? 'Note saved.' : dirty ? 'Unsaved note' : saved?.updated_at ? `Last saved ${new Date(saved.updated_at).toLocaleDateString()}` : ''}
        </Text>
        <Button label="Save note" size="sm" variant="secondary" onPress={() => (value.trim() ? save.mutate() : setError('Write a note first.'))} disabled={!dirty || save.isPending} loading={save.isPending} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  state: { ...typography.small, color: colors.textMuted, flex: 1 },
});
