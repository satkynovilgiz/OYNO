import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CharacterId } from '@/components/character';
import { Button, TextField } from '@/components/ui';
import { CharacterSelectScreen } from '@/features/characterSelect/CharacterSelectScreen';
import { colors, spacing, typography } from '@/theme';

type ProfileSetupScreenProps = {
  defaultName: string;
  onComplete: (input: { name: string; characterId: CharacterId }) => void;
};

type Step = 'name' | 'character';

/**
 * "Профилиңизди түзүңүз" (spec Section 18) - the name step is new, but
 * character choice reuses CharacterSelectScreen (the same "Каарманыңды
 * танда" component already used from Explore/Culture/Profile headers as
 * "change avatar") rather than rebuilding the character grid here.
 */
export function ProfileSetupScreen({ defaultName, onComplete }: ProfileSetupScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);

  if (step === 'character') {
    return (
      <CharacterSelectScreen
        onConfirm={(characterId) => onComplete({ name: name.trim(), characterId })}
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
