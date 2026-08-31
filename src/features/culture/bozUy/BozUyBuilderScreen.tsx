import { ChevronLeft, HelpCircle, PartyPopper, RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UserAvatar } from '@/components/avatar';
import { Button, Card, ConfirmationModal, IconButton } from '@/components/ui';
import { useIsTablet } from '@/hooks/useIsTablet';
import { track } from '@/services/analytics/analytics';
import { BOZ_UY_STEPS, clampStepIndex, isLastStep } from '@/services/culture/bozUySteps';
import { useAppStore } from '@/store/useAppStore';
import { useAvatarStore } from '@/store/useAvatarStore';
import { BOZ_UY_REWARD, useProgressStore } from '@/store/useProgressStore';
import { colors, radii, spacing, typography } from '@/theme';

import { BozUyPartIllustration } from './components/BozUyPartIllustration';
import { LearnCard } from './components/LearnCard';
import { PartCard } from './components/PartCard';
import { StepIndicator } from './components/StepIndicator';
import { StreakCard } from './components/StreakCard';
import { TipCard } from './components/TipCard';
import { TipsModal } from './components/TipsModal';

type BozUyBuilderScreenProps = {
  onPressBack: () => void;
};

export function BozUyBuilderScreen({ onPressBack }: BozUyBuilderScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isTablet = useIsTablet();
  const streakDays = useProgressStore((state) => state.streakDays);
  const characterId = useAppStore((state) => state.characterId) ?? 'bek';
  const avatarConfig = useAvatarStore((state) => (state.hasEverSaved ? state.config : null));

  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  const step = BOZ_UY_STEPS[stepIndex];

  function handleNext() {
    if (isLastStep(stepIndex)) {
      setCompleted(true);
      track('boz_uy_build_completed');
      void useProgressStore.getState().visitBozUy();
      return;
    }
    setStepIndex((current) => clampStepIndex(current + 1));
  }

  function handleRestart() {
    setStepIndex(0);
    setShowRestartConfirm(false);
  }

  if (completed) {
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={[styles.completionContent, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.completionIconWrap}>
            <PartyPopper size={40} color={colors.accentGoldPressed} strokeWidth={2} />
          </View>
          <Text style={styles.completionTitle}>{t('culture.bozUy.completion.title')}</Text>
          <UserAvatar characterId={characterId} avatarConfig={avatarConfig} size="large" />
          <Text style={styles.completionReward}>{t('culture.bozUy.completion.reward', { xp: BOZ_UY_REWARD.xp })}</Text>
          <Button label={t('culture.bozUy.completion.continue')} onPress={onPressBack} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>{t('culture.bozUy.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('culture.bozUy.subtitle')}</Text>
        </View>
        <View style={styles.tipsButton}>
          <Button
            label={t('culture.bozUy.tipsButton')}
            variant="secondary"
            icon={<HelpCircle size={16} color={colors.primary} strokeWidth={2.25} />}
            onPress={() => setShowTips(true)}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        <StepIndicator stepCount={BOZ_UY_STEPS.length} currentStepIndex={stepIndex} />

        <View style={isTablet ? styles.tabletRow : undefined}>
          {isTablet ? (
            <View style={styles.sidebar}>
              <LearnCard />
              <StreakCard streakDays={streakDays} />
            </View>
          ) : (
            <View style={styles.phoneRow}>
              <LearnCard />
              <StreakCard streakDays={streakDays} />
            </View>
          )}

          <View style={styles.mainColumn}>
            <Card style={styles.sceneCard}>
              <Text style={styles.stepName}>{t(step.nameKey)}</Text>
              <BozUyPartIllustration stepId={step.id} size={140} />
            </Card>

            <View style={isTablet ? styles.tabletBottomRow : styles.phoneBottomStack}>
              <PartCard nameKey={step.nameKey} descriptionKey={step.descriptionKey} />
              <TipCard tipKey={step.tipKey} />
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <View style={styles.restartButton}>
            <Button
              label={t('culture.bozUy.restart')}
              variant="secondary"
              icon={<RotateCcw size={16} color={colors.primary} strokeWidth={2.25} />}
              onPress={() => setShowRestartConfirm(true)}
            />
          </View>
          <View style={styles.nextButton}>
            <Button label={t('culture.bozUy.next')} onPress={handleNext} />
          </View>
        </View>
      </ScrollView>

      <TipsModal visible={showTips} onClose={() => setShowTips(false)} />

      <ConfirmationModal
        visible={showRestartConfirm}
        title={t('culture.bozUy.restartConfirm.title')}
        message={t('culture.bozUy.restartConfirm.message')}
        confirmLabel={t('culture.bozUy.restartConfirm.confirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleRestart}
        onCancel={() => setShowRestartConfirm(false)}
      />
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
  tipsButton: {
    flexShrink: 0,
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
    gap: spacing.md,
  },
  tabletRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  sidebar: {
    width: 180,
    gap: spacing.sm,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  mainColumn: {
    flex: 1,
    gap: spacing.sm,
  },
  sceneCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  stepName: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  tabletBottomRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  phoneBottomStack: {
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  restartButton: {
    flexShrink: 0,
  },
  nextButton: {
    flex: 1,
  },
  completionContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  completionIconWrap: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionTitle: {
    ...typography.display,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  completionReward: {
    ...typography.h2,
    color: colors.accentGoldPressed,
  },
});
