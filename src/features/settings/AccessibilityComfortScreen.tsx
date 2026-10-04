import { BookOpenText, Contrast, Hand, MousePointerClick, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { Button, Chip } from '@/components/ui';
import { ReaderSettingsSheet } from '@/features/culture/reader/ReaderControls';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import type { HapticsMode } from '@/services/comfort/comfort';
import { highContrastActive } from '@/services/comfort/earlyContrast';
import { hapticSelection } from '@/services/comfort/haptics';
import { restartApp } from '@/services/comfort/restartApp';
import { useComfortStore } from '@/services/comfort/useComfortStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { SettingsRow, SettingsSection } from './components/SettingsRow';
import { SettingsScreenLayout } from './components/SettingsScreenLayout';

const HAPTIC_MODES: HapticsMode[] = ['standard', 'reduced', 'off'];

/**
 * /settings/accessibility - real comfort controls that work WITH the
 * system's accessibility settings (system Reduce Motion stays authoritative;
 * Dynamic Type is untouched). Device-level; Reset leaves age mode, language
 * and Reader settings alone.
 */
export function AccessibilityComfortScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const { experience } = useAgeExperience();
  const prefs = useComfortStore((state) => state.prefs);
  const update = useComfortStore((state) => state.update);
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);

  useEffect(() => {
    void useComfortStore.getState().load();
    void AccessibilityInfo.isReduceMotionEnabled().then(setSystemReduceMotion).catch(() => undefined);
  }, []);

  const contrastPending = prefs.highContrast !== highContrastActive;

  return (
    <SettingsScreenLayout title={t('comfort.title')} onPressBack={onPressBack}>
      <View style={styles.stack}>
        <Text style={styles.intro}>{t('comfort.intro')}</Text>

        <SettingsSection title={t('comfort.motionTitle')} footer={systemReduceMotion ? t('comfort.systemMotionOn') : t('comfort.motionFooter')}>
          <SettingsRow icon={Sparkles} label={t('comfort.reduceMotion')} subtitle={systemReduceMotion ? t('comfort.onBySystem') : undefined} toggle={{ value: prefs.reduceMotion || systemReduceMotion, onChange: (value) => update({ reduceMotion: value }) }} />
        </SettingsSection>

        <View style={{ gap: spacing.xs }}>
          <Text style={styles.section} accessibilityRole="header">
            {t('comfort.hapticsTitle')}
          </Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {HAPTIC_MODES.map((mode) => (
              <Chip
                key={mode}
                label={t(`comfort.haptics.${mode}`)}
                selected={prefs.haptics === mode}
                onPress={() => {
                  update({ haptics: mode });
                  void hapticSelection();
                }}
              />
            ))}
          </View>
          <Text style={styles.meta}>{t(`comfort.hapticsHint.${prefs.haptics}`)}</Text>
        </View>

        <SettingsSection footer={experience === 'child' ? t('comfort.largerChildNote') : t('comfort.largerFooter')}>
          <SettingsRow icon={MousePointerClick} label={t('comfort.largerControls')} toggle={{ value: prefs.largerControls, onChange: (value) => update({ largerControls: value }) }} />
        </SettingsSection>

        <SettingsSection footer={t('comfort.contrastFooter')}>
          <SettingsRow icon={Contrast} label={t('comfort.highContrast')} toggle={{ value: prefs.highContrast, onChange: (value) => update({ highContrast: value }) }} />
        </SettingsSection>
        {contrastPending ? (
          <View style={styles.pending} accessibilityLiveRegion="polite">
            <Text style={styles.meta}>{t('comfort.restartNeeded')}</Text>
            <Button label={t('comfort.restartNow')} variant="secondary" onPress={() => void restartApp()} />
          </View>
        ) : null}

        <SettingsSection title={t('comfort.readingTitle')}>
          <SettingsRow icon={BookOpenText} label={t('comfort.readingSettings')} subtitle={t('comfort.readingSubtitle')} onPress={() => setReaderOpen(true)} />
        </SettingsSection>

        <SettingsSection footer={t('comfort.resetFooter')}>
          <SettingsRow icon={Hand} label={t('comfort.reset')} onPress={() => useComfortStore.getState().reset()} showChevron={false} />
        </SettingsSection>
      </View>
      {readerOpen ? <ReaderSettingsSheet isChild={experience === 'child'} onClose={() => setReaderOpen(false)} /> : null}
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  intro: { ...textStyles.body, color: colors.textSecondary },
  section: { ...typography.overline, color: colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  meta: { ...textStyles.small, color: colors.textSecondary },
  pending: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt },
});
