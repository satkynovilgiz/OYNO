import { router } from 'expo-router';
import { NotebookPen } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { rememberCultureItemId, type JournalLinkType } from '@/features/journal/journalModel';
import { colors, radii, spacing, typography } from '@/theme';

/**
 * The quiet "Add to Journal" action on a detail screen - a small pill
 * beside the other secondary controls, never in the hero. Opens a new,
 * private journal entry already linked to this content.
 */
export function AddToJournalButton({ type, id, title }: { type: JournalLinkType; id: string; title: string }) {
  const { t } = useTranslation();
  return (
    <AnimatedPressable
      style={styles.button}
      onPress={() => {
        // Culture items come from the database; this one is on screen, so it's real.
        if (type === 'culture_item') rememberCultureItemId(id);
        router.push({ pathname: '/journal/new', params: { linkType: type, linkId: id, linkLabel: title } } as never);
      }}
      pressScale={0.97}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={t('journal.addToJournalA11y', { title })}
    >
      <NotebookPen size={15} color={colors.primary} strokeWidth={2} />
      <Text style={styles.label}>{t('journal.addToJournal')}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.surfaceAlt,
    backgroundColor: colors.surface,
  },
  label: { ...typography.caption, fontWeight: '600', color: colors.primary },
});
