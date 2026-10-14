import { Check, Eye, EyeOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { cardRadii, colors, controlStates, headings, layout, radii, spacing, text } from '@/theme';

import { anyGuideShown, GRID_SPACINGS, type GuideSettings } from './compositionGuides';

/**
 * Guides panel: which guides are shown, the grid spacing, snapping, and the
 * preview of the final artwork. Session state owned by the Creator - none of
 * it is part of the design (toggling never touches a layer).
 */
export function GuideControls({ settings, onChange, preview, onPreviewChange }: { settings: GuideSettings; onChange: (settings: GuideSettings) => void; preview: boolean; onPreviewChange: (preview: boolean) => void }) {
  const { t } = useTranslation();
  const shown = anyGuideShown(settings);
  const toggle = (key: 'grid' | 'axes' | 'margins' | 'snap', label: string, disabled = false) => {
    const on = settings[key];
    return (
      <AnimatedPressable
        key={key}
        style={[styles.option, on && !disabled && styles.optionOn, disabled && styles.optionDisabled]}
        onPress={() => (disabled ? undefined : onChange({ ...settings, [key]: !on }))}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on, disabled }}
        aria-checked={on}
        aria-disabled={disabled}
        accessibilityLabel={label}
        testID={`oymo-guide-${key}`}
      >
        <View style={[styles.check, on && !disabled && styles.checkOn]}>{on ? <Check size={14} color={disabled ? colors.textSecondary : controlStates.selected.fg} strokeWidth={3} /> : null}</View>
        <Text style={[styles.optionText, on && !disabled && styles.optionTextOn]}>{label}</Text>
      </AnimatedPressable>
    );
  };

  return (
    <View style={styles.panel} testID="oymo-guides-panel">
      <Text style={styles.title} accessibilityRole="header">
        {t('guides.title')}
      </Text>
      {preview ? (
        <Text style={styles.hint} testID="oymo-preview-note">
          {t('guides.previewNote')}
        </Text>
      ) : (
        <>
          <View style={styles.row} accessibilityRole="none">
            {toggle('grid', t('guides.grid'))}
            {toggle('axes', t('guides.axes'))}
            {toggle('margins', t('guides.margins'))}
          </View>
          {settings.grid ? (
            <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t('guides.spacing')}>
              {GRID_SPACINGS.map((value) => (
                <AnimatedPressable
                  key={value}
                  style={[styles.option, settings.spacing === value && styles.optionOn]}
                  onPress={() => onChange({ ...settings, spacing: value })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: settings.spacing === value }}
                  aria-checked={settings.spacing === value}
                  accessibilityLabel={t('guides.spacingValue', { count: value })}
                  testID={`oymo-grid-${value}`}
                >
                  <Text style={[styles.optionText, settings.spacing === value && styles.optionTextOn]}>{t('guides.spacingValue', { count: value })}</Text>
                </AnimatedPressable>
              ))}
            </View>
          ) : null}
          <View style={styles.row}>{toggle('snap', t('guides.snap'), !shown)}</View>
          <Text style={styles.hint}>{shown ? (Platform.OS === 'web' ? t('guides.freeHintWeb') : t('guides.freeHint')) : t('guides.snapNeedsGuide')}</Text>
        </>
      )}
      <AnimatedPressable
        style={[styles.option, styles.previewButton, preview && styles.optionOn]}
        onPress={() => onPreviewChange(!preview)}
        accessibilityRole="button"
        accessibilityLabel={preview ? t('guides.backToEditing') : t('guides.preview')}
        testID="oymo-preview-toggle"
      >
        {preview ? <EyeOff size={18} color={controlStates.selected.fg} /> : <Eye size={18} color={colors.textPrimary} />}
        <Text style={[styles.optionText, preview && styles.optionTextOn]}>{preview ? t('guides.backToEditing') : t('guides.preview')}</Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: layout.cardGap,
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: 480,
    marginHorizontal: 'auto',
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  title: { ...headings.label, color: colors.textSecondary, textAlign: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  option: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: cardRadii.chip, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  optionOn: { backgroundColor: controlStates.selected.bg, borderColor: controlStates.selected.border },
  optionDisabled: { backgroundColor: controlStates.disabled.bg, borderColor: controlStates.disabled.border },
  optionText: { ...text.meta, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  optionTextOn: { color: controlStates.selected.fg },
  check: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { borderColor: controlStates.selected.fg },
  previewButton: { alignSelf: 'center' },
  hint: { ...text.fine, color: colors.textSecondary, textAlign: 'center' },
});
