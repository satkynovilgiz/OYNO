import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button } from '@/components/ui';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { cardRadii, colors, controlStates, elevation, overlays, spacing, textStyles } from '@/theme';

import { CARD_STYLE_IDS, defaultStyle, STYLEABLE, type CardStyleId } from './cardContent';

import { ShareCard, shareCardSize, type ShareCardContent } from './ShareCard';

export type ShareImageChoice = { key: string; label: string; image: ImageSourcePropType | null };

/**
 * Bottom sheet shown before anything leaves the phone: the exact card at
 * preview size, an optional picture choice (Journal: OYNO artwork / my
 * photo / none), then Share · Save · Cancel. Nothing is captured until the
 * user presses Share or Save.
 */
export function SharePreviewSheet({
  content,
  choices,
  busy,
  canSave,
  onShare,
  onSave,
  onCancel,
  onShareLink,
}: {
  content: ShareCardContent;
  choices: ShareImageChoice[] | null;
  busy: 'share' | 'save' | null;
  canSave: boolean;
  onShare: (content: ShareCardContent) => void;
  onSave: (content: ShareCardContent) => void;
  onCancel: () => void;
  /** Public content only: shares "Title - OYNO" + its oyno:// link as text. */
  onShareLink?: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const [choiceKey, setChoiceKey] = useState<string | null>(choices?.[0]?.key ?? null);
  const chosen = choices?.find((choice) => choice.key === choiceKey);
  // Card styles where the artwork or the figures are the subject (cardContent.ts) - the same choice goes to the export.
  const styleable = STYLEABLE.includes(content.variant ?? 'story');
  const [cardStyle, setCardStyle] = useState<CardStyleId>(content.cardStyle ?? defaultStyle(content.variant ?? 'story'));
  const card: ShareCardContent = { ...(chosen ? { ...content, imageSource: chosen.image } : content), ...(styleable ? { cardStyle } : null) };

  // Preview size: fits the sheet at 375-430 pt without dominating it.
  const size = shareCardSize(card);
  const previewWidth = Math.min(width - spacing.xxl * 2, 280, (height * 0.46 * size.width) / size.height);
  const scale = previewWidth / size.width;

  return (
    <Modal visible transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onCancel} statusBarTranslucent {...(Platform.OS === 'web' ? ({ 'aria-label': t('journal.v2.previewTitle') } as object) : null)}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityRole="button" accessibilityLabel={t('journal.cancel')} />
      {/* iOS: keep VoiceOver inside the sheet. On web the Modal is already the dialog; aria-modal without a role is invalid there. */}
      <View style={[styles.sheet, elevation.floating, { paddingBottom: insets.bottom + spacing.md }]} accessibilityViewIsModal={Platform.OS !== 'web'}>
        <View style={styles.handle} />
        <Text style={styles.title} accessibilityRole="header">
          {t('journal.v2.previewTitle')}
        </Text>
        <ScrollView contentContainerStyle={styles.body} bounces={false}>
          <View style={[styles.previewBox, { width: previewWidth, height: previewWidth * (size.height / size.width) }]} accessible accessibilityLabel={`${card.label}. ${card.title}`} testID="share-preview-card">
            <View style={{ transform: [{ scale }], transformOrigin: 'top left' as never, width: size.width, height: size.height }}>
              <ShareCard {...card} />
            </View>
          </View>
          {choices && choices.length > 1 ? <ChoiceRow label={t('shareCards.picture')} options={choices.map((choice) => ({ key: choice.key, label: choice.label }))} selected={choiceKey} onSelect={setChoiceKey} testID="share-picture" /> : null}
          {styleable ? <ChoiceRow label={t('shareCards.style')} options={CARD_STYLE_IDS.map((id) => ({ key: id, label: t(`shareCards.styles.${id}`) }))} selected={cardStyle} onSelect={(key) => setCardStyle(key as CardStyleId)} testID="share-style" /> : null}
        </ScrollView>
        {onShareLink ? (
          <View style={styles.linkRow}>
            <Button label={t('contentLinks.shareLink')} variant="text" onPress={onShareLink} disabled={!!busy} />
          </View>
        ) : null}
        <View style={styles.actions}>
          <Button label={t('journal.cancel')} variant="text" onPress={onCancel} disabled={!!busy} />
          <View style={styles.actionsRight}>
            {canSave ? <Button label={t('journal.v2.saveImage')} variant="secondary" onPress={() => onSave(card)} loading={busy === 'save'} disabled={busy === 'share'} /> : null}
            <Button label={t('journal.share')} variant="accent" onPress={() => onShare(card)} loading={busy === 'share'} disabled={busy === 'save'} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** A labelled radio group (real radios - a chip's aria-selected is not allowed on a button). */
function ChoiceRow({ label, options, selected, onSelect, testID }: { label: string; options: { key: string; label: string }[]; selected: string | null; onSelect: (key: string) => void; testID: string }) {
  return (
    <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const on = option.key === selected;
        return (
          <AnimatedPressable key={option.key} style={[styles.choice, on && styles.choiceOn]} onPress={() => onSelect(option.key)} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={option.label} testID={`${testID}-${option.key}`}>
            <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{option.label}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  choice: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: cardRadii.chip, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surfaceElevated },
  choiceOn: { backgroundColor: controlStates.selected.bg, borderColor: controlStates.selected.border },
  choiceText: { ...textStyles.caption, fontWeight: '700', color: colors.textPrimary },
  choiceTextOn: { color: controlStates.selected.fg },
  linkRow: { alignItems: 'center' },
  backdrop: { flex: 1, backgroundColor: overlays.half },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '92%', paddingTop: spacing.xs, paddingHorizontal: spacing.md, gap: spacing.sm, borderTopLeftRadius: cardRadii.hero, borderTopRightRadius: cardRadii.hero, backgroundColor: colors.background },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderSubtle, marginBottom: spacing.xs },
  title: { ...textStyles.title, color: colors.textPrimary, textAlign: 'center' },
  body: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  previewBox: { borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  choices: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  actionsRight: { flexDirection: 'row', gap: spacing.xs },
});
