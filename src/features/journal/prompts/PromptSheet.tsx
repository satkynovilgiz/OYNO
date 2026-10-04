import { router } from 'expo-router';
import { Lightbulb, RefreshCw } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { Chip } from '@/components/ui/Chip';
import { track } from '@/services/analytics/analytics';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { localDateKey } from '@/services/daily/dailyDiscovery';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { cardRadii, colors, editorial, radii, spacing, textStyles, typography } from '@/theme';

import { nextPrompt, PROMPT_CATEGORIES, promptsFor, type PromptCategory } from './journalPrompts';

/** Opens the existing editor; the prompt travels only as a route param (never into the note). */
export function openEditorWithPrompt(promptId: string | null) {
  if (promptId) track('journal_prompt_used', { prompt_id: promptId });
  router.push((promptId ? { pathname: '/journal/new', params: { prompt: promptId } } : '/journal/new') as never);
}

/**
 * "Need an idea?" - one authored prompt at a time:
 * [Use this prompt] [Another prompt] [Write without prompt].
 * Analytics: the sheet opening, and the prompt id when one is used - never
 * the prompt text, the note, its title or anything the person writes.
 */
export function PromptSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { experience } = useAgeExperience();
  const isChild = experience === 'child';
  const [category, setCategory] = useState<PromptCategory | null>(null);
  const seed = localDateKey();
  const pool = useMemo(() => promptsFor(experience, category), [experience, category]);
  const [currentId, setCurrentId] = useState<string | null>(() => nextPrompt(pool, null, seed)?.id ?? null);
  const current = pool.find((candidate) => candidate.id === currentId) ?? nextPrompt(pool, null, seed);

  useEffect(() => {
    track('journal_prompt_opened');
  }, []);

  const pickCategory = (next: PromptCategory | null) => {
    setCategory(next);
    setCurrentId(nextPrompt(promptsFor(experience, next), null, seed)?.id ?? null);
  };

  return (
    <Modal visible transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} accessibilityViewIsModal>
        <Text style={styles.title} accessibilityRole="header">
          {t('journalPrompts.title')}
        </Text>
        {!isChild ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
            <Chip label={t('journalPrompts.all')} selected={category === null} onPress={() => pickCategory(null)} accessibilityRole="tab" />
            {PROMPT_CATEGORIES.map((option) => (
              <Chip key={option} label={t(`journalPrompts.categories.${option}`)} selected={category === option} onPress={() => pickCategory(option)} accessibilityRole="tab" />
            ))}
          </ScrollView>
        ) : null}
        {current ? (
          // Plain text card - read as-is by screen readers.
          <View style={[styles.card, isChild && styles.cardChild]} accessible accessibilityLabel={`${t(`journalPrompts.categories.${current.category}`)}. ${t(current.textKey)}`}>
            <View style={styles.cardHead}>
              <Lightbulb size={16} color={colors.accentTerracotta} strokeWidth={2.25} />
              <Text style={styles.kicker}>{t(`journalPrompts.categories.${current.category}`)}</Text>
            </View>
            <Text style={[styles.prompt, isChild && styles.promptChild, experience === 'adult' && styles.promptEditorial]}>{t(current.textKey)}</Text>
          </View>
        ) : null}
        <Button
          label={t('journalPrompts.use')}
          variant="accent"
          size={isChild ? 'lg' : 'md'}
          block
          disabled={!current}
          onPress={() => {
            onClose();
            openEditorWithPrompt(current?.id ?? null);
          }}
        />
        <Button
          label={t('journalPrompts.another')}
          icon={<RefreshCw size={16} color={colors.primary} strokeWidth={2.25} />}
          variant="secondary"
          block
          disabled={pool.length < 2}
          accessibilityHint={t('journalPrompts.anotherHint')}
          onPress={() => setCurrentId(nextPrompt(pool, current?.id ?? null, seed)?.id ?? null)}
        />
        <Button
          label={t('journalPrompts.without')}
          variant="text"
          block
          onPress={() => {
            onClose();
            openEditorWithPrompt(null);
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,24,18,0.45)' },
  sheet: { gap: spacing.sm, padding: spacing.md, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, backgroundColor: colors.background },
  title: { ...typography.h2, color: colors.textPrimary },
  chips: { gap: spacing.xs },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt },
  cardChild: { padding: spacing.lg },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  kicker: { ...typography.overline, color: colors.accentTerracotta },
  prompt: { ...textStyles.title, fontSize: 19, lineHeight: 26, color: colors.textPrimary },
  promptChild: { fontSize: 22, lineHeight: 30 },
  promptEditorial: { ...editorial(textStyles.title) },
});
