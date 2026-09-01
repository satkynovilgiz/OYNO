import { ChevronLeft, Info } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton, Toggle } from '@/components/ui';
import { useIsTablet } from '@/hooks/useIsTablet';
import { track } from '@/services/analytics/analytics';
import { useShyrdakCreation } from '@/services/content/shyrdakCreationService';
import {
  DEFAULT_SHYRDAK_CONFIG,
  setBaseColor,
  setPattern,
  setSecondaryColor,
  setSymmetryMode,
  toggleBorder,
  type ShyrdakConfig,
} from '@/services/culture/shyrdakConfig';
import { useAuthStore } from '@/store/useAuthStore';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, spacing, typography } from '@/theme';

import { ColorSwatches } from '../oymo/components/ColorSwatches';
import { SymmetryControl } from '../oymo/components/SymmetryControl';
import { PatternGrid } from './components/PatternGrid';
import { ShyrdakCanvas } from './components/ShyrdakCanvas';
import { WhatIsThisModal } from './components/WhatIsThisModal';

type ShyrdakCreatorScreenProps = {
  onPressBack: () => void;
};

export function ShyrdakCreatorScreen({ onPressBack }: ShyrdakCreatorScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isTablet = useIsTablet();
  const { data: savedCreation } = useShyrdakCreation();
  const isGuest = useAuthStore((state) => state.status === 'guest');

  const [config, setConfig] = useState<ShyrdakConfig>(DEFAULT_SHYRDAK_CONFIG);
  const [showWhatIsThis, setShowWhatIsThis] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const hasLoadedSaved = useRef(false);

  useEffect(() => {
    track('shyrdak_creator_open');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (savedCreation && !hasLoadedSaved.current) {
      hasLoadedSaved.current = true;
      setConfig({
        baseColor: savedCreation.base_color,
        secondaryColor: savedCreation.secondary_color,
        patternId: savedCreation.pattern_id,
        borderEnabled: savedCreation.border_enabled,
        symmetryMode: savedCreation.symmetry_mode,
      });
    }
  }, [savedCreation]);

  async function handleSave() {
    setIsSaving(true);
    setSaveError(false);
    const success = await useProgressStore.getState().saveShyrdakCreation({
      baseColor: config.baseColor,
      secondaryColor: config.secondaryColor,
      patternId: config.patternId,
      borderEnabled: config.borderEnabled,
      symmetryMode: config.symmetryMode,
    });
    setIsSaving(false);
    if (success) {
      setSaved(true);
      hasLoadedSaved.current = true;
    } else if (!isGuest) {
      setSaveError(true);
    }
  }

  const controls = (
    <View style={[styles.controls, isTablet && styles.controlsTablet]}>
      <View style={styles.controlSection}>
        <Text style={styles.controlLabel}>{t('culture.shyrdak.patternSection')}</Text>
        <PatternGrid selectedPatternId={config.patternId} onSelectPattern={(id) => setConfig((c) => setPattern(c, id))} color={config.secondaryColor} />
      </View>

      <View style={styles.controlSection}>
        <Text style={styles.controlLabel}>{t('culture.shyrdak.baseColorSection')}</Text>
        <ColorSwatches selectedColor={config.baseColor} onSelectColor={(color) => setConfig((c) => setBaseColor(c, color))} />
      </View>

      <View style={styles.controlSection}>
        <Text style={styles.controlLabel}>{t('culture.shyrdak.secondaryColorSection')}</Text>
        <ColorSwatches selectedColor={config.secondaryColor} onSelectColor={(color) => setConfig((c) => setSecondaryColor(c, color))} />
      </View>

      <View style={[styles.controlSection, styles.borderRow]}>
        <Text style={styles.controlLabel}>{t('culture.shyrdak.borderSection')}</Text>
        <Toggle value={config.borderEnabled} onValueChange={() => setConfig((c) => toggleBorder(c))} accessibilityLabel={t('culture.shyrdak.borderSection')} />
      </View>

      <View style={styles.controlSection}>
        <Text style={styles.controlLabel}>{t('culture.oymo.symmetrySection')}</Text>
        <SymmetryControl mode={config.symmetryMode} onChangeMode={(mode) => setConfig((c) => setSymmetryMode(c, mode))} />
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>{t('culture.shyrdak.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('culture.shyrdak.subtitle')}</Text>
        </View>
        <IconButton icon={Info} shape="roundedSquare" accessibilityLabel={t('culture.shyrdak.whatIsThis')} onPress={() => setShowWhatIsThis(true)} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        <View style={isTablet ? styles.tabletRow : undefined}>
          <View style={styles.canvasColumn}>
            <ShyrdakCanvas
              baseColor={config.baseColor}
              secondaryColor={config.secondaryColor}
              patternId={config.patternId}
              borderEnabled={config.borderEnabled}
              symmetryMode={config.symmetryMode}
            />
            <Button
              label={saved ? t('culture.shyrdak.saved') : t('culture.oymo.save.confirm')}
              onPress={handleSave}
              loading={isSaving}
            />
            {isGuest && !saved && <Text style={styles.saveHint}>{t('culture.oymo.save.guestHint')}</Text>}
            {!isGuest && saveError && <Text style={styles.saveError}>{t('culture.oymo.save.error')}</Text>}
          </View>

          {isTablet && controls}
        </View>

        {!isTablet && controls}
      </ScrollView>

      <WhatIsThisModal visible={showWhatIsThis} onClose={() => setShowWhatIsThis(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  headerTitleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  tabletRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  canvasColumn: {
    flex: 1,
    gap: spacing.sm,
    alignItems: 'center',
  },
  saveHint: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  saveError: {
    ...typography.small,
    color: colors.danger,
    textAlign: 'center',
  },
  controls: {
    gap: spacing.lg,
  },
  controlsTablet: {
    width: 220,
  },
  controlSection: {
    gap: spacing.xs,
  },
  controlLabel: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  borderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
