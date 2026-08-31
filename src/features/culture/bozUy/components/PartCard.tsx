import { Volume2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type PartCardProps = {
  nameKey: string;
  descriptionKey: string;
};

/** "Айтуу" (pronounce the vocabulary word) needs a real pre-recorded
 * native-speaker audio clip, which doesn't exist yet - pressing it shows
 * an honest inline notice instead of a silent no-op or fake/TTS audio.
 * Flagged as a required audio asset in the final report. */
export function PartCard({ nameKey, descriptionKey }: PartCardProps) {
  const { t } = useTranslation();
  const [showAudioNotice, setShowAudioNotice] = useState(false);

  return (
    <Card style={styles.card}>
      <Text style={styles.name}>{t(nameKey)}</Text>
      <Text style={styles.description}>{t(descriptionKey)}</Text>
      <Button
        label={t('culture.bozUy.pronounce')}
        variant="secondary"
        icon={<Volume2 size={16} color={colors.primary} strokeWidth={2.25} />}
        onPress={() => setShowAudioNotice(true)}
      />
      {showAudioNotice ? <Text style={styles.audioNotice}>{t('culture.bozUy.audioComingSoon')}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
  },
  name: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
  },
  audioNotice: {
    ...typography.small,
    color: colors.textMuted,
  },
});
