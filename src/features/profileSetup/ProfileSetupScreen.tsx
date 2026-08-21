import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
      setError('Атыңызды жазыңыз.');
      return;
    }
    setError(null);
    setStep('character');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.content}>
        <Text style={styles.title}>Профилиңизди түзүңүз</Text>
        <Text style={styles.description}>Башка оюнчулар сизди ушул ат менен көрүшөт.</Text>

        <TextField label="Аты-жөнү" value={name} onChangeText={setName} error={error ?? undefined} placeholder="Бек Асанов" />
      </View>

      <Button label="Улантуу" onPress={handleContinue} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  content: {
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
