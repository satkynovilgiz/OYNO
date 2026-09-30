import { Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { IconButton, TextField } from '@/components/ui';
import { describeSource } from '@/services/content/verification';
import { colors, radii, spacing, typography } from '@/theme';

import { isValidSourceUrl, splitLines } from '../adminModel';

/**
 * Sources as a list: each entry shows its publisher (from the URL itself -
 * nothing invented) and can be removed; new entries are checked for a real
 * http(s) address before they're added. Links are never opened from here.
 * Stored as the same newline-separated value the section's toParams reads.
 */
export function SourcesEditor({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const sources = splitLines(value);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  function add() {
    const url = draft.trim();
    if (!isValidSourceUrl(url)) return setError('Enter a full web address, e.g. https://ich.unesco.org/...');
    if (sources.includes(url)) return setError('This source is already listed.');
    onChange([...sources, url].join('\n'));
    setDraft('');
    setError(null);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {sources.length === 0 ? <Text style={styles.empty}>No sources yet. "Verified" needs at least one.</Text> : null}
      {sources.map((url) => {
        const info = describeSource(url);
        const valid = isValidSourceUrl(url);
        return (
          <View key={url} style={[styles.row, !valid && styles.rowInvalid]}>
            <View style={styles.rowText}>
              <Text style={styles.name} numberOfLines={1}>
                {valid ? (info?.name ?? url) : 'Invalid URL'}
              </Text>
              <Text style={styles.url} numberOfLines={2} selectable>
                {url}
              </Text>
            </View>
            <IconButton icon={Trash2} size={36} iconSize={16} shape="roundedSquare" elevated={false} accessibilityLabel={`Remove source ${info?.name ?? url}`} onPress={() => onChange(sources.filter((entry) => entry !== url).join('\n'))} />
          </View>
        );
      })}
      <View style={styles.addRow}>
        <View style={styles.addInput}>
          <TextField
            label="Add source URL"
            value={draft}
            onChangeText={(text) => {
              setDraft(text);
              setError(null);
            }}
            error={error}
            keyboardType="url"
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={add}
          />
        </View>
        <IconButton icon={Plus} size={44} iconSize={18} shape="roundedSquare" accessibilityLabel="Add source" onPress={add} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  empty: { ...typography.small, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.xs, paddingLeft: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  rowInvalid: { borderColor: colors.danger },
  rowText: { flex: 1, minWidth: 0 },
  name: { ...typography.caption, fontWeight: '700', color: colors.textPrimary },
  url: { ...typography.small, color: colors.textMuted },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  addInput: { flex: 1 },
});
