import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CharacterId } from '@/components/character';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { Button, TextField } from '@/components/ui';
import { AvatarEditorScreen } from '@/features/avatar/AvatarEditorScreen';
import { CharacterSelectScreen } from '@/features/characterSelect/CharacterSelectScreen';
import { AVATAR_CATALOG } from '@/services/avatar/avatarCatalog';
import type { AvatarConfig } from '@/services/avatar/avatarConfig';
import { getUnlockedItemIds } from '@/services/avatar/avatarUnlocks';
import { createDefaultAvatarConfig } from '@/services/avatar/defaultAvatar';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, editorial, spacing, textStyles } from '@/theme';

import { displayNameError, stepNumber, type ProfileSetupStep } from './profileSetupModel';
import { SetupSteps } from './SetupSteps';

// A brand-new account has zero progress by definition - this still
// correctly unlocks every `unlock:{type:'free'}` item (isItemUnlocked
// returns true for those regardless of the snapshot), it's only the
// specifically-gated items that stay locked here, exactly as they should.
const ZERO_PROGRESS_UNLOCKED_ITEM_IDS = getUnlockedItemIds(AVATAR_CATALOG, {
  gamesPlayed: 0,
  cultureDiscoveryCount: 0,
  questFoundCount: 0,
  streakDays: 0,
  xp: 0,
});

type ProfileSetupScreenProps = {
  defaultName: string;
  /** Saves name + companion + avatar through the existing stores; resolves
   * false when something could not be saved (the avatar step then shows an
   * honest error with Retry instead of silently moving on). */
  onComplete: (input: { name: string; characterId: CharacterId; avatarConfig: AvatarConfig }) => Promise<boolean>;
};

/**
 * Profile setup - three clearly different things:
 *   1 name       your display name
 *   2 guide      the Story Companion who shows you around OYNO (not you)
 *   3 avatar     "now create yourself" - the picture that represents you
 * Skip on step 3 saves the real default avatar, never a half-edited draft.
 */
export function ProfileSetupScreen({ defaultName, onComplete }: ProfileSetupScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const [step, setStep] = useState<ProfileSetupStep>('name');
  const [name, setName] = useState(defaultName);
  const [characterId, setCharacterId] = useState<CharacterId | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const finish = async (avatarConfig: AvatarConfig) => {
    if (isSaving || !characterId) return;
    setIsSaving(true);
    setSaveFailed(false);
    const ok = await onComplete({ name: name.trim(), characterId, avatarConfig });
    setIsSaving(false);
    if (!ok) setSaveFailed(true);
  };

  if (step === 'avatar' && characterId) {
    return (
      <AvatarEditorScreen
        mode="onboarding"
        setupStep={stepNumber('avatar')}
        initialConfig={createDefaultAvatarConfig()}
        unlockedItemIds={ZERO_PROGRESS_UNLOCKED_ITEM_IDS}
        isSaving={isSaving}
        saveError={saveFailed ? 'save' : null}
        onComplete={(avatarConfig) => void finish(avatarConfig)}
        onSkip={() => void finish(createDefaultAvatarConfig())}
        onCancel={() => setStep('character')}
      />
    );
  }

  if (step === 'character') {
    return (
      <CharacterSelectScreen
        context="setup"
        setupStep={stepNumber('character')}
        initialCharacterId={characterId}
        onBack={() => setStep('name')}
        onConfirm={(id) => {
          setCharacterId(id);
          setStep('avatar');
        }}
      />
    );
  }

  const handleContinue = () => {
    const error = displayNameError(name);
    setNameError(error);
    if (!error) setStep('character');
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <SetupSteps current={stepNumber('name')} />
        <View style={styles.medallion}>
          <OymoOrnament size={experience === 'child' ? 64 : 52} color={colors.accentGoldPressed} strokeWidth={1.4} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {t('profileSetup.v2.name.title')}
        </Text>
        <Text style={styles.body}>{t('profileSetup.v2.name.body')}</Text>

        <TextField
          label={t('profileSetup.v2.name.label')}
          value={name}
          onChangeText={(value) => {
            setName(value);
            if (nameError) setNameError(null);
          }}
          error={nameError ? t(nameError) : null}
          placeholder={t('profileSetup.namePlaceholder')}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="nickname"
          returnKeyType="next"
          onSubmitEditing={handleContinue}
          large={experience === 'child'}
        />

        <View style={styles.footer}>
          <Button label={t('profileSetup.continue')} size="lg" block onPress={handleContinue} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, gap: spacing.md },
  medallion: { alignSelf: 'flex-start', width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle, marginTop: spacing.sm },
  title: { ...editorial(textStyles.h1), color: colors.textPrimary },
  body: { ...textStyles.body, color: colors.textSecondary },
  footer: { marginTop: 'auto', paddingTop: spacing.lg },
});
