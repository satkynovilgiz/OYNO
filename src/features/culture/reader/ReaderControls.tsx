import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button } from '@/components/ui';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { useReaderSettingsStore } from '@/store/useReaderSettingsStore';
import { cardRadii, colors, radii, spacing, textStyles, typography } from '@/theme';

import { LINE_SPACINGS, readerBodyStyle, TEXT_SIZES, type LineSpacingId, type TextSizeId } from './readerSettings';

/** The current reading presentation (loads the device preferences once). */
export function useReaderSettings() {
  const textSize = useReaderSettingsStore((state) => state.textSize);
  const lineSpacing = useReaderSettingsStore((state) => state.lineSpacing);
  const focusMode = useReaderSettingsStore((state) => state.focusMode);
  useEffect(() => {
    void useReaderSettingsStore.getState().load();
  }, []);
  return { textSize, lineSpacing, focusMode };
}

/** The compact "Aa" button for long-form Culture screens. */
export function ReaderButton({ isChild, elevated }: { isChild: boolean; elevated?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <AnimatedPressable style={[styles.aa, elevated && styles.aaElevated]} onPress={() => setOpen(true)} hitSlop={4} accessibilityRole="button" accessibilityLabel={t('readerSettings.title')}>
        <Text style={styles.aaText}>Aa</Text>
      </AnimatedPressable>
      {open ? <ReaderSettingsSheet isChild={isChild} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function ReaderSettingsSheet({ isChild, onClose }: { isChild: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { textSize, lineSpacing, focusMode } = useReaderSettings();
  const update = useReaderSettingsStore((state) => state.update);
  const preview = readerBodyStyle(isChild ? 17 : 16, { textSize, lineSpacing }, isChild);

  const option = <T extends string>(group: string, id: T, selected: boolean, onPress: () => void) => (
    <AnimatedPressable
      key={id}
      style={[styles.option, selected && styles.optionOn]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={`${t(`readerSettings.${group}.${id}`)}, ${t(`readerSettings.${group}.label`)}`}
    >
      <Text style={[styles.optionText, selected && styles.optionTextOn]}>{t(`readerSettings.${group}.${id}`)}</Text>
    </AnimatedPressable>
  );

  return (
    <Modal visible transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('readerSettings.done')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} accessibilityViewIsModal>
        <ScrollView contentContainerStyle={{ gap: spacing.md }}>
          <Text style={styles.title} accessibilityRole="header">
            {t('readerSettings.title')}
          </Text>
          {/* Demo sentence from the UI strings - never article content. */}
          <Text style={[styles.preview, preview]}>{t('readerSettings.preview')}</Text>

          <Text style={styles.groupLabel}>{t('readerSettings.size.label')}</Text>
          <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={t('readerSettings.size.label')}>
            {(Object.keys(TEXT_SIZES) as TextSizeId[]).map((id) => option('size', id, textSize === id, () => update({ textSize: id })))}
          </View>

          <Text style={styles.groupLabel}>{t('readerSettings.spacing.label')}</Text>
          <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={t('readerSettings.spacing.label')}>
            {(Object.keys(LINE_SPACINGS) as LineSpacingId[]).map((id) => option('spacing', id, lineSpacing === id, () => update({ lineSpacing: id })))}
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>{t('readerSettings.focus')}</Text>
              <Text style={styles.switchHint}>{t('readerSettings.focusHint')}</Text>
            </View>
            <Switch value={focusMode} onValueChange={(value) => update({ focusMode: value })} accessibilityLabel={t('readerSettings.focus')} />
          </View>

          <Button label={t('readerSettings.reset')} variant="secondary" onPress={() => useReaderSettingsStore.getState().reset()} />
          <Button label={t('readerSettings.done')} onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  aa: { minWidth: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  aaElevated: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  aaText: { ...typography.bodyBold, color: colors.primary },
  backdrop: { flex: 1, backgroundColor: 'rgba(20,24,18,0.45)' },
  sheet: { maxHeight: '85%', padding: spacing.md, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, backgroundColor: colors.background },
  title: { ...typography.h2, color: colors.textPrimary },
  preview: { color: colors.textPrimary, padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surface },
  groupLabel: { ...typography.overline, color: colors.accentTerracotta },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  option: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: cardRadii.chip, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  optionOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { ...textStyles.small, fontWeight: '700', color: colors.textPrimary },
  optionTextOn: { color: colors.textOnDark },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  switchLabel: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  switchHint: { ...textStyles.small, color: colors.textSecondary },
});
