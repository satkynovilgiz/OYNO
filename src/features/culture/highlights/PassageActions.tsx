import { Bookmark, BookmarkCheck } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { colors, spacing, textStyles } from '@/theme';

import { highlightId, type HighlightContentType } from './highlightsModel';
import { NoteSheet } from './NoteSheet';
import { useHighlightActions, useHighlights } from './useHighlights';

/** A quiet "Save passage" under one authored section; once saved:
 * "Saved" + Add/Edit note (children: save only, no note complexity). */
export function PassageActions({
  contentType,
  contentId,
  sectionKey,
  sectionLabel,
  title,
  text,
  language,
  simple,
}: {
  contentType: HighlightContentType;
  contentId: string;
  sectionKey: string;
  sectionLabel: string;
  title: string;
  text: string;
  language: string;
  simple: boolean;
}) {
  const { t } = useTranslation();
  const { data, owner } = useHighlights();
  const actions = useHighlightActions(owner);
  const [editing, setEditing] = useState(false);
  const id = highlightId(contentType, contentId, sectionKey, language);
  const saved = data[id];

  if (!saved) {
    return (
      <AnimatedPressable style={styles.action} onPress={() => actions.save({ contentType, contentId, sectionKey, language, title, text })} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('highlights.saveNamed', { section: sectionLabel })}>
        <Bookmark size={14} color={colors.textSecondary} strokeWidth={2} />
        <Text style={styles.actionText}>{t('highlights.savePassage')}</Text>
      </AnimatedPressable>
    );
  }
  return (
    <View style={styles.row}>
      <View style={styles.action} accessible accessibilityLabel={`${sectionLabel}: ${t('highlights.saved')}`}>
        <BookmarkCheck size={14} color={colors.primary} strokeWidth={2.25} />
        <Text style={[styles.actionText, styles.savedText]}>{t('highlights.saved')}</Text>
      </View>
      {!simple ? (
        <AnimatedPressable style={styles.action} onPress={() => setEditing(true)} hitSlop={6} accessibilityRole="button" accessibilityLabel={saved.note ? t('highlights.editNote') : t('highlights.addNote')}>
          <Text style={[styles.actionText, styles.link]}>{saved.note ? t('highlights.editNote') : t('highlights.addNote')}</Text>
        </AnimatedPressable>
      ) : null}
      {editing ? (
        <NoteSheet
          initial={saved.note}
          onClose={() => setEditing(false)}
          onSave={(note) => {
            actions.setNote(saved.id, note);
            setEditing(false);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, alignSelf: 'flex-start' },
  actionText: { ...textStyles.small, color: colors.textSecondary, fontWeight: '600' },
  savedText: { color: colors.primary, fontWeight: '700' },
  link: { color: colors.primary, textDecorationLine: 'underline' },
});
