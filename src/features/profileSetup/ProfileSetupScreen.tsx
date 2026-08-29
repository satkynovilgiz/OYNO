import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CharacterId } from '@/components/character';
import { Button, TextField } from '@/components/ui';
import { AvatarEditorScreen } from '@/features/avatar/AvatarEditorScreen';
import { CharacterSelectScreen } from '@/features/characterSelect/CharacterSelectScreen';
import { AVATAR_CATALOG } from '@/services/avatar/avatarCatalog';
import type { AvatarConfig } from '@/services/avatar/avatarConfig';
import { getUnlockedItemIds } from '@/services/avatar/avatarUnlocks';
import { createDefaultAvatarConfig } from '@/services/avatar/defaultAvatar';
import { colors, spacing, typography } from '@/theme';

// A brand-new account has zero progress by definition - this still
// correctly unlocks every `unlock:{type:'free'}` item (isItemUnlocked
// returns true for those regardless of the snapshot), it's only the 5
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
  onComplete: (input: { name: string; characterId: CharacterId; avatarConfig: AvatarConfig }) => void;
};

type Step = 'name' | 'character' | 'avatar';

/**
 * "Профилиңизди түзүңүз" (spec Section 18) - the name step is new, and
 * character choice reuses CharacterSelectScreen (the same "Каарманыңды
 * танда" component already used from Explore/Culture/Profile headers as
 * "change avatar" for the *story companion*) rather than rebuilding that
 * grid here. The avatar step is a separate, later addition - a brand new
 * account has zero progress, so every avatar item is free/unlocked and
 * this step needs no progress-store wiring; it's always skippable
 * (assigns the neutral default avatar) per spec section 28.
 */
export function ProfileSetupScreen({ defaultName, onComplete }: ProfileSetupScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState(defaultName);
  const [characterId, setCharacterId] = useState<CharacterId | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (step === 'avatar' && characterId) {
    return (
      <AvatarEditorScreen
        mode="onboarding"
        initialConfig={createDefaultAvatarConfig()}
        unlockedItemIds={ZERO_PROGRESS_UNLOCKED_ITEM_IDS}
        onComplete={(avatarConfig) => onComplete({ name: name.trim(), characterId, avatarConfig })}
        onSkip={() => onComplete({ name: name.trim(), characterId, avatarConfig: createDefaultAvatarConfig() })}
        onCancel={() => onComplete({ name: name.trim(), characterId, avatarConfig: createDefaultAvatarConfig() })}
      />
    );
  }

  if (step === 'character') {
    return (
      <CharacterSelectScreen
        onConfirm={(id) => {
          setCharacterId(id);
          setStep('avatar');
        }}
      />
    );
  }

  const handleContinue = () => {
    if (!name.trim()) {
      setError(t('profileSetup.nameError'));
      return;
    }
    setError(null);
    setStep('character');
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{t('profileSetup.title')}</Text>
      <Text style={styles.description}>{t('profileSetup.description')}</Text>

      <TextField
        label={t('profileSetup.nameLabel')}
        value={name}
        onChangeText={setName}
        error={error ?? undefined}
        placeholder={t('profileSetup.namePlaceholder')}
      />

      <Button label={t('profileSetup.continue')} onPress={handleContinue} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
